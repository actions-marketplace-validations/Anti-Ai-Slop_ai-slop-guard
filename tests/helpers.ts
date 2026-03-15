import type {
  PRContext,
  IssueContext,
  GuardConfig,
  DiffData,
  DiffFile,
  OctokitClient,
} from '../src/types';
import type { LLMConfig } from '../src/llm/types';

/**
 * Create a default GuardConfig for testing.
 */
export function createDefaultConfig(
  overrides?: Partial<GuardConfig>,
): GuardConfig {
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
    ollamaModel: 'test-model',
    llm: {
      provider: 'ollama',
      model: 'test-model',
      maxTokens: 1024,
      temperature: 0.1,
      timeoutMs: 60000,
    } as LLMConfig,
    exemptUsers: [],
    exemptLabels: ['human-verified'],
    ...overrides,
  };
}

/**
 * Create a minimal empty DiffData for testing.
 */
export function createEmptyDiff(
  overrides?: Partial<DiffData>,
): DiffData {
  return {
    files: [],
    totalAdditions: 0,
    totalDeletions: 0,
    totalFilesChanged: 0,
    truncated: false,
    ...overrides,
  };
}

/**
 * Create a DiffFile for testing.
 */
export function createDiffFile(
  overrides?: Partial<DiffFile>,
): DiffFile {
  return {
    oldPath: 'src/app.ts',
    newPath: 'src/app.ts',
    status: 'modified',
    isBinary: false,
    language: 'typescript',
    isTest: false,
    isConfig: false,
    hunks: [],
    additions: [],
    deletions: [],
    ...overrides,
  };
}

/**
 * Create a mock PRContext for testing.
 */
export function createMockPRContext(
  overrides?: Partial<PRContext>,
): PRContext {
  return {
    eventType: 'pull_request',
    owner: 'test-owner',
    repo: 'test-repo',
    number: 1,
    author: 'test-user',
    title: 'Test PR',
    body: '',
    labels: [],
    diff: createEmptyDiff(),
    commits: [],
    baseBranch: 'main',
    headBranch: 'feat/test',
    config: createDefaultConfig(),
    octokit: createMockOctokit(),
    ...overrides,
  };
}

/**
 * Create a mock IssueContext for testing.
 */
export function createMockIssueContext(
  overrides?: Partial<IssueContext>,
): IssueContext {
  return {
    eventType: 'issues',
    owner: 'test-owner',
    repo: 'test-repo',
    number: 1,
    author: 'test-user',
    title: 'Test Issue',
    body: '',
    labels: [],
    repoFiles: [],
    repoFileContents: new Map<string, string>(),
    existingIssues: [],
    config: createDefaultConfig(),
    octokit: createMockOctokit(),
    ...overrides,
  };
}

/**
 * Create a mock Octokit for unit tests.
 * The mock does not make real API calls.
 */
export function createMockOctokit(): OctokitClient {
  return {} as OctokitClient;
}
