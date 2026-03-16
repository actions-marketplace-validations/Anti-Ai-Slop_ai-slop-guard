import * as core from '@actions/core';
import type { SlopScore, OctokitClient, GuardConfig, Verdict, DispatchOptions } from '../types';

const KNOWN_BOTS = [
  'dependabot[bot]', 'renovate[bot]', 'github-actions[bot]',
  'mergify[bot]', 'depfu[bot]', 'snyk-bot', 'greenkeeper[bot]',
];

export interface ContributorResult {
  readonly score: SlopScore;
  readonly multiplier: number;
  readonly mergedCount: number;
  readonly options: DispatchOptions;
}

// ── Helpers ────────────────────────────────────────────────────────────

function resolveVerdict(total: number, config: GuardConfig): Verdict {
  if (total >= config.slopScoreClose) return 'likely-slop';
  if (total >= config.slopScoreWarn) return 'suspicious';
  return 'clean';
}

function applyMultiplier(
  score: SlopScore,
  multiplier: number,
  config: GuardConfig,
  extra: { mergedCount?: number; options: DispatchOptions },
): ContributorResult {
  if (multiplier === 1.0) {
    return { score, multiplier, mergedCount: extra.mergedCount ?? -1, options: extra.options };
  }
  const newTotal = Math.round(score.total * multiplier * 100) / 100;
  return {
    score: { ...score, total: newTotal, verdict: resolveVerdict(newTotal, config) },
    multiplier,
    mergedCount: extra.mergedCount ?? -1,
    options: extra.options,
  };
}

function matchesUser(list: readonly string[], author: string): boolean {
  const lower = author.toLowerCase();
  return list.some((u) => u.toLowerCase() === lower);
}

// ── API checks ─────────────────────────────────────────────────────────

async function checkCollaborator(
  octokit: OctokitClient, owner: string, repo: string, author: string,
): Promise<boolean> {
  try {
    await octokit.rest.repos.checkCollaborator({ owner, repo, username: author });
    return true;
  } catch {
    return false;
  }
}

async function countPastSlopClosures(
  octokit: OctokitClient, owner: string, repo: string, author: string, slopLabel: string,
): Promise<number> {
  try {
    const { data } = await octokit.rest.search.issuesAndPullRequests({
      q: `repo:${owner}/${repo} author:${author} label:"${slopLabel}" is:closed`,
      per_page: 1,
    });
    return data.total_count;
  } catch (err) {
    core.debug(`Repeat offender check failed: ${String(err)}`);
    return 0;
  }
}

async function countMergedPRs(
  octokit: OctokitClient, owner: string, repo: string, author: string,
): Promise<number> {
  const { data: pulls } = await octokit.rest.pulls.list({
    owner, repo, state: 'closed', sort: 'updated', direction: 'desc', per_page: 100,
  });
  return pulls.filter(
    (p) => p.user?.login?.toLowerCase() === author.toLowerCase() && p.merged_at !== null,
  ).length;
}

// ── Main ───────────────────────────────────────────────────────────────

/**
 * Apply score multipliers based on contributor reputation.
 *
 * Evaluation order:
 * 1. Blocked users → flag for immediate close
 * 2. Known bots / exempt users → skip
 * 3. Trusted users → reduced multiplier (0.5)
 * 4. Repo collaborators → skip
 * 5. Repeat offenders → escalated multiplier
 * 6. New contributor history → standard multiplier
 */
export async function applyContributorMultiplier(
  score: SlopScore,
  octokit: OctokitClient,
  owner: string,
  repo: string,
  author: string,
  config: GuardConfig,
): Promise<ContributorResult> {
  const skip: ContributorResult = { score, multiplier: 1.0, mergedCount: -1, options: {} };

  // 1. Blocked users
  if (matchesUser(config.blockedUsers, author)) {
    return {
      score: { ...score, total: 99, verdict: 'likely-slop' },
      multiplier: 99,
      mergedCount: -1,
      options: { isBlockedUser: true },
    };
  }

  if (!config.contributorHistoryCheck) return skip;
  if (matchesUser(KNOWN_BOTS, author)) return skip;
  if (matchesUser(config.exemptUsers, author)) return skip;

  // 2. Trusted users
  if (matchesUser(config.trustedUsers, author)) {
    return applyMultiplier(score, 0.5, config, { options: { isTrustedUser: true } });
  }

  // 3. Repo collaborators
  if (config.excludeCollaborators && await checkCollaborator(octokit, owner, repo, author)) {
    core.info(`"${author}" is a repo collaborator — skipping analysis.`);
    return { ...skip, options: { isCollaborator: true } };
  }

  // 4. Repeat offender check
  let pastSlopCount = 0;
  let isRepeatOffender = false;
  if (config.repeatOffenderThreshold > 0) {
    pastSlopCount = await countPastSlopClosures(octokit, owner, repo, author, config.slopLabel);
    if (pastSlopCount >= config.repeatOffenderThreshold) {
      isRepeatOffender = true;
      core.info(`"${author}" has ${pastSlopCount} past slop closures — score multiplied by ${config.repeatOffenderMultiplier}`);
      return applyMultiplier(score, config.repeatOffenderMultiplier, config, {
        options: { isRepeatOffender, pastSlopCount },
      });
    }
  }

  // 5. Standard new contributor check
  let mergedCount: number;
  try {
    mergedCount = await countMergedPRs(octokit, owner, repo, author);
  } catch (err) {
    core.debug(`Contributor history check failed: ${String(err)}`);
    return { ...skip, options: { pastSlopCount, isRepeatOffender } };
  }

  let multiplier: number;
  if (mergedCount === 0) multiplier = config.newContributorWeightMultiplier;
  else if (mergedCount <= 2) multiplier = 1.25;
  else multiplier = 1.0;

  return applyMultiplier(score, multiplier, config, {
    mergedCount,
    options: { pastSlopCount, isRepeatOffender },
  });
}
