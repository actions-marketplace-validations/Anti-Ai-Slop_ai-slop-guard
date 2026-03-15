import type { GitHub } from '@actions/github/lib/utils';
import type { LLMConfig } from './llm/types';

// ---------------------------------------------------------------------------
// Octokit
// ---------------------------------------------------------------------------

/** Octokit instance type from @actions/github */
export type OctokitClient = InstanceType<typeof GitHub>;

// ---------------------------------------------------------------------------
// Signal types — output of every analyzer
// ---------------------------------------------------------------------------

/** Categories that group related signals */
export type SignalCategory =
  | 'diff-structure'
  | 'diff-quality'
  | 'description'
  | 'commits'
  | 'metadata'
  | 'stacktrace'
  | 'duplicate'
  | 'semantic';

/** A single detection signal emitted by an analyzer */
export interface Signal {
  readonly id: string;
  readonly category: SignalCategory;
  /** Weight of this signal (0-5) */
  readonly score: number;
  /** How certain the detection is (0.0-1.0) */
  readonly confidence: number;
  /** Human-readable explanation for the contributor */
  readonly detail: string;
  /** Short code/text snippet as evidence */
  readonly evidence?: string;
}

/** Static definition of a signal in the registry */
export interface SignalDefinition {
  readonly id: string;
  readonly category: SignalCategory;
  readonly defaultScore: number;
  readonly name: string;
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Scoring types — aggregated result
// ---------------------------------------------------------------------------

/** Final verdict after scoring */
export type Verdict = 'clean' | 'suspicious' | 'likely-slop';

/** Aggregated analysis result */
export interface SlopScore {
  readonly total: number;
  readonly signals: readonly Signal[];
  readonly verdict: Verdict;
  readonly breakdown: Readonly<Record<SignalCategory, number>>;
  readonly analyzedAt: string;
}

// ---------------------------------------------------------------------------
// Diff types — parsed diff data
// ---------------------------------------------------------------------------

/** A single changed line in a diff */
export interface DiffLine {
  readonly lineNumber: number;
  readonly content: string;
}

/** A hunk within a diff file */
export interface DiffHunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly additions: readonly DiffLine[];
  readonly deletions: readonly DiffLine[];
  readonly context: readonly DiffLine[];
}

/** Status of a file in the diff */
export type DiffFileStatus = 'added' | 'deleted' | 'modified' | 'renamed';

/** A single file in the diff */
export interface DiffFile {
  readonly oldPath: string;
  readonly newPath: string;
  readonly status: DiffFileStatus;
  readonly isBinary: boolean;
  readonly language: string | null;
  readonly isTest: boolean;
  readonly isConfig: boolean;
  readonly hunks: readonly DiffHunk[];
  readonly additions: readonly DiffLine[];
  readonly deletions: readonly DiffLine[];
}

/** Complete parsed diff */
export interface DiffData {
  readonly files: readonly DiffFile[];
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly totalFilesChanged: number;
  readonly truncated: boolean;
}

// ---------------------------------------------------------------------------
// Stack trace types
// ---------------------------------------------------------------------------

/** A single frame in a stack trace */
export interface StackFrame {
  readonly filePath: string;
  readonly lineNumber: number;
  readonly column?: number;
  readonly functionName?: string;
  readonly format: StackTraceFormat;
}

/** Supported stack trace formats */
export type StackTraceFormat =
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'unknown';

// ---------------------------------------------------------------------------
// Commit types
// ---------------------------------------------------------------------------

/** Metadata about a single commit */
export interface CommitInfo {
  readonly sha: string;
  readonly message: string;
  readonly author: string;
}

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

/** Actions the tool can take */
export type ActionType = 'label' | 'comment' | 'close';

/** Resolved configuration from action.yml inputs */
export interface GuardConfig {
  readonly checkPrs: boolean;
  readonly checkIssues: boolean;
  readonly slopScoreWarn: number;
  readonly slopScoreClose: number;
  readonly onWarn: readonly ActionType[];
  readonly onClose: readonly ActionType[];
  readonly warnLabel: string;
  readonly slopLabel: string;
  readonly semanticAnalysis: boolean;
  readonly ollamaModel: string;
  readonly llm: LLMConfig;
  readonly exemptUsers: readonly string[];
  readonly exemptLabels: readonly string[];
  readonly blockedSourceBranches: readonly string[];
  readonly honeypotTerms: readonly string[];
  readonly maxNegativeReactions: number;
  readonly checkLanguageMismatch: boolean;
  readonly contributorHistoryCheck: boolean;
  readonly newContributorWeightMultiplier: number;
  readonly gracePeriodHours: number;
}

// ---------------------------------------------------------------------------
// Analyzer context types
// ---------------------------------------------------------------------------

/** Base context shared by all analyzers */
export interface AnalysisContext {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  readonly author: string;
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
  readonly config: GuardConfig;
  readonly octokit: OctokitClient;
}

/** Context for PR analysis */
export interface PRContext extends AnalysisContext {
  readonly eventType: 'pull_request';
  readonly diff: DiffData;
  readonly commits: readonly CommitInfo[];
  readonly baseBranch: string;
  readonly headBranch: string;
}

/** Context for issue analysis */
export interface IssueContext extends AnalysisContext {
  readonly eventType: 'issues';
  readonly repoFiles: readonly string[];
  readonly repoFileContents: ReadonlyMap<string, string>;
  readonly existingIssues: readonly ExistingIssue[];
}

/** Minimal representation of an existing issue for duplicate detection */
export interface ExistingIssue {
  readonly number: number;
  readonly title: string;
  readonly body: string;
}

// ---------------------------------------------------------------------------
// Action result types
// ---------------------------------------------------------------------------

/** Result of a single action execution */
export interface ActionResult {
  readonly action: ActionType;
  readonly success: boolean;
  readonly error?: string;
}

/** Complete run result */
export interface RunResult {
  readonly score: SlopScore;
  readonly actionsTaken: readonly ActionType[];
  readonly errors: readonly string[];
}
