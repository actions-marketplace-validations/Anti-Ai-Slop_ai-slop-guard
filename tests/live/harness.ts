/**
 * Test harness — simula l'Action senza chiamate GitHub.
 *
 * Cosa fa:
 * - Riceve un payload finto (PR o Issue)
 * - Esegue l'intero pipeline (parsing -> analysis -> scoring -> action gen)
 * - Ritorna il risultato completo SENZA postare su GitHub
 *
 * Cosa NON fa:
 * - Non chiama GitHub API
 * - Non posta commenti
 * - Non aggiunge label
 * - Non chiude nulla
 */

// Silence @actions/core output — must run before any src imports
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const actionsCore = require('@actions/core');
actionsCore.info = () => {};
actionsCore.warning = () => {};
actionsCore.error = () => {};
actionsCore.debug = () => {};
actionsCore.notice = () => {};
actionsCore.getInput = () => '';
actionsCore.setOutput = () => {};
actionsCore.setFailed = () => {};

import { parseDiff } from '../../src/parsers/diff-parser';
import { runPrPipeline } from '../../src/analyzers/pr-pipeline';
import { runIssuePipeline } from '../../src/analyzers/issue-pipeline';
import { calculateSlopScore } from '../../src/scoring/calculator';
import { buildComment } from '../../src/actions/comment';
import type {
  PRContext,
  IssueContext,
  GuardConfig,
  SlopScore,
  Signal,
  OctokitClient,
} from '../../src/types';
import type { LLMConfig } from '../../src/llm/types';

// Known bots — mirrors src/index.ts KNOWN_BOTS
const KNOWN_BOTS = [
  'dependabot[bot]', 'renovate[bot]', 'github-actions[bot]',
  'mergify[bot]', 'depfu[bot]', 'snyk-bot', 'greenkeeper[bot]',
];

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface SimulatedPR {
  title: string;
  body: string;
  diff: string;
  commits: Array<{ message: string; author: string }>;
  author: string;
  labels?: string[];
  headBranch?: string;
}

export interface SimulatedIssue {
  title: string;
  body: string;
  author: string;
  labels?: string[];
}

export interface LiveTestResult {
  score: SlopScore;
  comment: string;
  wouldLabel: boolean;
  wouldClose: boolean;
  signals: Signal[];
  duration: number;
}

// ---------------------------------------------------------------------------
// Default config builder
// ---------------------------------------------------------------------------

function buildConfig(overrides?: Partial<GuardConfig>): GuardConfig {
  return {
    checkPrs: true,
    checkIssues: true,
    slopScoreWarn: 6,
    slopScoreClose: 12,
    onWarn: ['label', 'comment'],
    onClose: ['label', 'comment', 'close'],
    warnLabel: 'needs-review',
    slopLabel: 'likely-slop',
    semanticAnalysis: false,
    ollamaModel: '',
    llm: {
      provider: 'ollama',
      model: '',
      maxTokens: 1024,
      temperature: 0.1,
      timeoutMs: 60000,
    } as LLMConfig,
    exemptUsers: ['dependabot[bot]', 'renovate[bot]'],
    exemptLabels: ['trusted-contributor'],
    generateDashboard: false,
    ...overrides,
  } as GuardConfig;
}

// ---------------------------------------------------------------------------
// Exemption check — mirrors src/index.ts isExempt()
// ---------------------------------------------------------------------------

function isExempt(
  author: string,
  labels: string[],
  config: GuardConfig,
): boolean {
  const authorLower = author.toLowerCase();
  if (KNOWN_BOTS.some((b) => b.toLowerCase() === authorLower)) return true;
  if (config.exemptUsers.some((u) => u.toLowerCase() === authorLower)) return true;
  if (config.exemptLabels.some((exempt) => labels.includes(exempt))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Empty score for exempt results
// ---------------------------------------------------------------------------

function emptyScore(): SlopScore {
  return {
    total: 0,
    signals: [],
    verdict: 'clean',
    breakdown: {
      'diff-structure': 0,
      'diff-quality': 0,
      'description': 0,
      'commits': 0,
      'stacktrace': 0,
      'duplicate': 0,
      'semantic': 0,
    },
    analyzedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// testPR
// ---------------------------------------------------------------------------

export async function testPR(
  pr: SimulatedPR,
  configOverrides?: Partial<GuardConfig>,
): Promise<LiveTestResult> {
  const start = Date.now();
  const config = buildConfig(configOverrides);

  // Check exemption first — like src/index.ts does
  if (isExempt(pr.author, pr.labels ?? [], config)) {
    const score = emptyScore();
    return {
      score,
      comment: '',
      wouldLabel: false,
      wouldClose: false,
      signals: [],
      duration: Date.now() - start,
    };
  }

  const diff = parseDiff(pr.diff);

  const ctx: PRContext = {
    owner: 'test-owner',
    repo: 'test-repo',
    eventType: 'pull_request',
    number: 1,
    author: pr.author,
    title: pr.title,
    body: pr.body,
    diff,
    commits: pr.commits.map((c, i) => ({
      sha: `fake${i}`,
      message: c.message,
      author: c.author,
    })),
    labels: pr.labels ?? [],
    baseBranch: 'main',
    headBranch: pr.headBranch ?? 'feat/test',
    config,
    octokit: {} as OctokitClient,
  };

  const signals = await runPrPipeline(ctx);
  const score = calculateSlopScore(
    signals,
    config.slopScoreWarn,
    config.slopScoreClose,
  );

  const comment = score.verdict !== 'clean'
    ? buildComment(ctx, score)
    : '';

  return {
    score,
    comment,
    wouldLabel: score.verdict !== 'clean',
    wouldClose: score.verdict === 'likely-slop',
    signals,
    duration: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// testIssue
// ---------------------------------------------------------------------------

export async function testIssue(
  issue: SimulatedIssue,
  repoFiles: string[],
  configOverrides?: Partial<GuardConfig>,
): Promise<LiveTestResult> {
  const start = Date.now();
  const config = buildConfig(configOverrides);

  // Check exemption first
  if (isExempt(issue.author, issue.labels ?? [], config)) {
    const score = emptyScore();
    return {
      score,
      comment: '',
      wouldLabel: false,
      wouldClose: false,
      signals: [],
      duration: Date.now() - start,
    };
  }

  const ctx: IssueContext = {
    owner: 'test-owner',
    repo: 'test-repo',
    eventType: 'issues',
    number: 42,
    author: issue.author,
    title: issue.title,
    body: issue.body,
    labels: issue.labels ?? [],
    config,
    octokit: {} as OctokitClient,
    repoFiles,
    repoFileContents: new Map<string, string>(),
    existingIssues: [],
  };

  const signals = await runIssuePipeline(ctx);
  const score = calculateSlopScore(
    signals,
    config.slopScoreWarn,
    config.slopScoreClose,
  );

  const comment = score.verdict !== 'clean'
    ? buildComment(ctx, score)
    : '';

  return {
    score,
    comment,
    wouldLabel: score.verdict !== 'clean',
    wouldClose: score.verdict === 'likely-slop',
    signals,
    duration: Date.now() - start,
  };
}
