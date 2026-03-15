import * as core from '@actions/core';
import type { SlopScore, OctokitClient, GuardConfig, Verdict } from '../types';

const KNOWN_BOTS = [
  'dependabot[bot]', 'renovate[bot]', 'github-actions[bot]',
  'mergify[bot]', 'depfu[bot]', 'snyk-bot', 'greenkeeper[bot]',
];

/**
 * Apply a score multiplier based on contributor history.
 * New contributors (0 merged PRs) get a higher multiplier.
 *
 * Returns the original score unchanged when:
 * - contributor-history-check is disabled
 * - the contributor is a known bot
 * - the contributor is exempt
 * - the API call fails (fail open)
 * - the contributor has 3+ merged PRs (multiplier 1.0)
 */
export async function applyContributorMultiplier(
  score: SlopScore,
  octokit: OctokitClient,
  owner: string,
  repo: string,
  author: string,
  config: GuardConfig,
): Promise<{ score: SlopScore; multiplier: number; mergedCount: number }> {
  if (!config.contributorHistoryCheck) {
    return { score, multiplier: 1.0, mergedCount: -1 };
  }

  // Skip bots
  if (KNOWN_BOTS.some((b) => b.toLowerCase() === author.toLowerCase())) {
    return { score, multiplier: 1.0, mergedCount: -1 };
  }

  // Skip exempt users
  if (config.exemptUsers.some((u) => u.toLowerCase() === author.toLowerCase())) {
    return { score, multiplier: 1.0, mergedCount: -1 };
  }

  let mergedCount: number;
  try {
    const { data: pulls } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    });

    mergedCount = pulls.filter(
      (p) =>
        p.user?.login?.toLowerCase() === author.toLowerCase() &&
        p.merged_at !== null,
    ).length;
  } catch (err) {
    core.debug(`Contributor history check failed: ${String(err)}`);
    return { score, multiplier: 1.0, mergedCount: -1 };
  }

  let multiplier: number;
  if (mergedCount === 0) {
    multiplier = config.newContributorWeightMultiplier;
  } else if (mergedCount <= 2) {
    multiplier = 1.25;
  } else {
    multiplier = 1.0;
  }

  if (multiplier === 1.0) {
    return { score, multiplier, mergedCount };
  }

  const newTotal = Math.round(score.total * multiplier * 100) / 100;
  const warnThreshold = config.slopScoreWarn;
  const closeThreshold = config.slopScoreClose;

  let verdict: Verdict = 'clean';
  if (newTotal >= closeThreshold) verdict = 'likely-slop';
  else if (newTotal >= warnThreshold) verdict = 'suspicious';

  return {
    score: { ...score, total: newTotal, verdict },
    multiplier,
    mergedCount,
  };
}
