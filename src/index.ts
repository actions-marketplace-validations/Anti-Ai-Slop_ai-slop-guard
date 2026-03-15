import * as core from '@actions/core';
import * as github from '@actions/github';
import { resolveConfig } from './config/schema';
import { parseDiff } from './parsers/diff-parser';
import { runPrPipeline } from './analyzers/pr-pipeline';
import { fetchReferencedFileContents } from './utils/github-fetch';
import { runIssuePipeline } from './analyzers/issue-pipeline';
import { calculateSlopScore } from './scoring/calculator';
import { applyContributorMultiplier } from './scoring/contributor';
import { dispatchActions } from './actions/dispatcher';
import type {
  PRContext,
  IssueContext,
  CommitInfo,
  GuardConfig,
  OctokitClient,
} from './types';

const KNOWN_BOTS = [
  'dependabot[bot]', 'renovate[bot]', 'github-actions[bot]',
  'mergify[bot]', 'depfu[bot]', 'snyk-bot', 'greenkeeper[bot]',
];

/**
 * Main entry point for the GitHub Action.
 */
async function run(): Promise<void> {
  try {
    const configResult = resolveConfig();
    if (configResult.isErr()) {
      core.setFailed(`Config error: ${configResult.error}`);
      return;
    }

    const config = configResult.value;
    const { eventName, payload } = github.context;
    const token =
      core.getInput('github-token') || process.env['GITHUB_TOKEN'] || '';

    if (!token) {
      core.setFailed('No GitHub token provided.');
      return;
    }

    const octokit = github.getOctokit(token);
    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;

    if (
      (eventName === 'pull_request' ||
        eventName === 'pull_request_target') &&
      config.checkPrs
    ) {
      await handlePullRequest(octokit, owner, repo, payload, config);
    } else if (eventName === 'issues' && config.checkIssues) {
      await handleIssue(octokit, owner, repo, payload, config);
    } else {
      core.info(`Event "${eventName}" — skipping.`);
    }
  } catch (error) {
    core.setFailed(
      `ai-slop-guard failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handlePullRequest(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  payload: typeof github.context.payload,
  config: GuardConfig,
): Promise<void> {
  const pr = payload['pull_request'];
  if (!pr) {
    core.info('No pull_request in payload — skipping.');
    return;
  }

  const author = String((pr as Record<string, Record<string, unknown>>)['user']?.['login'] ?? '');
  const prNumber = Number(pr['number']);

  if (isExempt(author, pr['labels'], config)) {
    core.info(`PR #${prNumber} is exempt — skipping.`);
    return;
  }

  const { data: diffRaw } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  });
  const diff = parseDiff(typeof diffRaw === 'string' ? diffRaw : String(diffRaw));

  const { data: commitsData } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  const commits: CommitInfo[] = commitsData.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.author?.login ?? c.commit.author?.name ?? 'unknown',
  }));

  const rawLabels = pr['labels'] as Array<{ name?: string }> | undefined;
  const labels = (rawLabels ?? [])
    .map((l) => l.name ?? '')
    .filter(Boolean);

  const ctx: PRContext = {
    eventType: 'pull_request',
    owner,
    repo,
    number: prNumber,
    author,
    title: String(pr['title'] ?? ''),
    body: String(pr['body'] ?? ''),
    labels,
    diff,
    commits,
    baseBranch: String((pr as Record<string, Record<string, unknown>>)['base']?.['ref'] ?? 'main'),
    headBranch: String((pr as Record<string, Record<string, unknown>>)['head']?.['ref'] ?? ''),
    config,
    octokit,
  };

  const signals = await runPrPipeline(ctx);
  let score = calculateSlopScore(signals, config.slopScoreWarn, config.slopScoreClose);

  const { score: adjustedScore, multiplier, mergedCount } =
    await applyContributorMultiplier(score, octokit, owner, repo, author, config);
  score = adjustedScore;

  if (multiplier > 1.0) {
    core.info(
      `PR #${ctx.number}: contributor "${author}" has ${mergedCount} merged PRs — score multiplied by ${multiplier}`,
    );
  }

  core.info(`PR #${ctx.number}: score=${score.total}, verdict=${score.verdict}, signals=${score.signals.length}`);
  await dispatchActions(score, ctx, { contributorMultiplier: multiplier, mergedPrCount: mergedCount });
}

async function handleIssue(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  payload: typeof github.context.payload,
  config: GuardConfig,
): Promise<void> {
  const issue = payload['issue'];
  if (!issue) {
    core.info('No issue in payload — skipping.');
    return;
  }

  const author = String((issue as Record<string, Record<string, unknown>>)['user']?.['login'] ?? '');
  const issueNumber = Number(issue['number']);

  if (isExempt(author, issue['labels'], config)) {
    core.info(`Issue #${issueNumber} is exempt — skipping.`);
    return;
  }

  let repoFiles: string[] = [];
  try {
    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: 'true',
    });
    repoFiles = tree.tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path ?? '')
      .filter(Boolean);
  } catch {
    core.warning('Could not fetch repo file tree.');
  }

  let existingIssues: Array<{
    number: number;
    title: string;
    body: string;
  }> = [];
  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'open',
      per_page: 50,
    });
    existingIssues = issues
      .filter((i) => i.number !== issueNumber)
      .map((i) => ({
        number: i.number,
        title: i.title,
        body: i.body ?? '',
      }));
  } catch {
    core.warning('Could not fetch existing issues.');
  }

  const rawLabels = issue['labels'] as
    | Array<{ name?: string } | string>
    | undefined;
  const labels = (rawLabels ?? [])
    .map((l) => (typeof l === 'string' ? l : l.name ?? ''))
    .filter(Boolean);

  const issueBody = String(issue['body'] ?? '');
  const repoFileContents = await fetchReferencedFileContents(
    octokit, owner, repo, issueBody, repoFiles,
  );

  const ctx: IssueContext = {
    eventType: 'issues',
    owner,
    repo,
    number: issueNumber,
    author,
    title: String(issue['title'] ?? ''),
    body: issueBody,
    labels,
    repoFiles,
    repoFileContents,
    existingIssues,
    config,
    octokit,
  };

  const signals = await runIssuePipeline(ctx);
  const score = calculateSlopScore(signals, config.slopScoreWarn, config.slopScoreClose);
  core.info(`Issue #${ctx.number}: score=${score.total}, verdict=${score.verdict}, signals=${score.signals.length}`);
  await dispatchActions(score, ctx);
}

function isExempt(
  author: string,
  labels: unknown,
  config: GuardConfig,
): boolean {
  const authorLower = author.toLowerCase();
  if (KNOWN_BOTS.some((b) => b.toLowerCase() === authorLower)) return true;
  if (config.exemptUsers.some((u) => u.toLowerCase() === authorLower)) return true;

  if (Array.isArray(labels)) {
    const labelNames = (labels as unknown[]).map((l) =>
      typeof l === 'string' ? l : String((l as Record<string, unknown>)?.['name'] ?? ''),
    );
    if (config.exemptLabels.some((exempt) => labelNames.some((l) => l.toLowerCase() === exempt.toLowerCase()))) {
      return true;
    }
  }

  return false;
}

void run();
