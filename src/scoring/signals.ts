import type { SignalDefinition, SignalCategory } from '../types';

/**
 * Create a signal definition with compile-time type checking
 */
function def(
  id: string,
  category: SignalCategory,
  defaultScore: number,
  name: string,
  description: string,
): SignalDefinition {
  return { id, category, defaultScore, name, description };
}

/**
 * Central registry of all signals the system can produce.
 * Every analyzer references this registry to create Signal instances.
 */
export const SIGNALS = {
  // ── PR — Diff structure ──────────────────────────────────────────────
  COSMETIC_ONLY_DIFF: def(
    'cosmetic-only-diff',
    'diff-structure',
    3,
    'Cosmetic-only diff',
    'Only whitespace/formatting changes, zero functional impact',
  ),
  MASSIVE_UNFOCUSED_DIFF: def(
    'massive-unfocused-diff',
    'diff-structure',
    4,
    'Massive unfocused diff',
    '>500 lines, >10 files, no coherent theme',
  ),
  DEAD_CODE_INJECTION: def(
    'dead-code-injection',
    'diff-structure',
    3,
    'Dead code injection',
    'Functions added but never called in the diff',
  ),
  IMPORT_TSUNAMI: def(
    'import-tsunami',
    'diff-structure',
    3,
    'Import tsunami',
    'Imports added but not used in modified code',
  ),
  SUSPICIOUS_DEPENDENCY: def(
    'suspicious-dependency',
    'diff-structure',
    4,
    'Suspicious dependency',
    'Dependency added to package.json but not used in diff',
  ),
  CONFIG_CHURN: def(
    'config-churn',
    'diff-structure',
    2,
    'Config churn',
    'Config file modified without functional reason',
  ),

  // ── PR — Diff quality ────────────────────────────────────────────────
  TEST_FREE_FEATURE: def(
    'test-free-feature',
    'diff-quality',
    2,
    'Test-free feature',
    'New feature without tests',
  ),
  INCONSISTENT_STYLE: def(
    'inconsistent-style',
    'diff-quality',
    1,
    'Inconsistent style',
    'Mix of tabs/spaces, inconsistent naming',
  ),
  DUPLICATE_CODE_IN_DIFF: def(
    'duplicate-code-in-diff',
    'diff-quality',
    3,
    'Duplicate code in diff',
    'Code duplicated from existing codebase',
  ),
  HIGH_COMMENT_RATIO: def(
    'high-comment-ratio',
    'diff-quality',
    2,
    'High comment ratio',
    'Comments >40% of added code',
  ),

  // ── PR — Description ─────────────────────────────────────────────────
  AI_FLUFF_LANGUAGE: def(
    'ai-fluff-language',
    'description',
    2,
    'Fluff language',
    'Overuse of words like "comprehensive", "robust", "streamlined"',
  ),
  MISSING_WHY: def(
    'missing-why',
    'description',
    2,
    'Missing "why"',
    'Describes what changed but not why',
  ),
  TEMPLATE_IGNORED: def(
    'template-ignored',
    'description',
    3,
    'Template ignored',
    'PR template present but sections left empty',
  ),
  OVER_EXPLAINED: def(
    'over-explained',
    'description',
    1,
    'Over-explained',
    'Description >800 characters',
  ),
  EMOJI_ABUSE: def(
    'emoji-abuse',
    'description',
    1,
    'Emoji abuse',
    '5+ emoji in the description',
  ),
  BULLET_VOMIT: def(
    'bullet-vomit',
    'description',
    2,
    'Bullet vomit',
    '8+ consecutive bullet points',
  ),
  SELF_PRAISE: def(
    'self-praise',
    'description',
    2,
    'Self-praise',
    '"Elegant solution", "clean implementation"',
  ),

  // ── PR — Commits ─────────────────────────────────────────────────────
  GENERIC_COMMIT_MSG: def(
    'generic-commit-msg',
    'commits',
    2,
    'Generic commit message',
    '"update", "fix", "improve" without specifics',
  ),
  SINGLE_COMMIT_DUMP: def(
    'single-commit-dump',
    'commits',
    2,
    'Single-commit dump',
    'Entire PR in a single large commit',
  ),
  AUTHOR_MISMATCH: def(
    'author-mismatch',
    'commits',
    1,
    'Author mismatch',
    'Commit author differs from PR author',
  ),

  // ── Issue — Stack trace ──────────────────────────────────────────────
  HALLUCINATED_FILE: def(
    'hallucinated-file',
    'stacktrace',
    5,
    'Hallucinated file',
    'Stack trace references a file that does not exist in the repo',
  ),
  HALLUCINATED_FUNCTION: def(
    'hallucinated-function',
    'stacktrace',
    5,
    'Hallucinated function',
    'Function does not exist in the referenced file',
  ),
  HALLUCINATED_LINE: def(
    'hallucinated-line',
    'stacktrace',
    4,
    'Hallucinated line number',
    'Line number exceeds the file length',
  ),

  // ── Issue — Content ──────────────────────────────────────────────────
  NO_REPRODUCTION_STEPS: def(
    'no-reproduction-steps',
    'description',
    3,
    'No reproduction steps',
    'Bug report without steps to reproduce',
  ),
  VERSION_MISMATCH: def(
    'version-mismatch',
    'description',
    4,
    'Version mismatch',
    'Referenced version does not exist in releases',
  ),
  OVERLY_FORMAL_ISSUE: def(
    'overly-formal-issue',
    'description',
    2,
    'Overly formal issue',
    'Issue written in press-release tone',
  ),

  // ── Issue — Duplicate ────────────────────────────────────────────────
  DUPLICATE_ISSUE: def(
    'duplicate-issue',
    'duplicate',
    3,
    'Duplicate issue',
    'Similar to an existing issue (fuzzy match >85%)',
  ),

  // ── PR — Metadata ──────────────────────────────────────────────────
  BLOCKED_SOURCE_BRANCH: def(
    'blocked-source-branch',
    'metadata',
    4,
    'Blocked source branch',
    'PR was opened from a blocked branch (e.g. main, master)',
  ),
  HONEYPOT_TRIGGERED: def(
    'honeypot-triggered',
    'metadata',
    5,
    'Honeypot triggered',
    'PR body contains a hidden honeypot term from the PR template',
  ),
  COMMUNITY_FLAGGED: def(
    'community-flagged',
    'metadata',
    3,
    'Community flagged',
    'PR received excessive negative reactions from the community',
  ),
  LANGUAGE_MISMATCH: def(
    'language-mismatch',
    'metadata',
    3,
    'Language mismatch',
    'Most added files use a language foreign to this repository',
  ),

  // ── Semantic (optional, LLM) ─────────────────────────────────────────
  NO_FUNCTIONAL_VALUE: def(
    'no-functional-value',
    'semantic',
    4,
    'No functional value',
    'LLM determines the PR adds no functional value',
  ),
} as const satisfies Record<string, SignalDefinition>;

/** All signal IDs as a union type */
export type SignalId = (typeof SIGNALS)[keyof typeof SIGNALS]['id'];

/** Get all signal definitions as an array */
export function getAllSignals(): readonly SignalDefinition[] {
  return Object.values(SIGNALS);
}
