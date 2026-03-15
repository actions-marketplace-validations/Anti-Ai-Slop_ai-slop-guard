import type { AnalysisContext, SlopScore, Signal } from '../types';

const COMMENT_SIGNATURE = '<!-- ai-slop-guard-review -->';

/** Per-signal actionable suggestions */
const SUGGESTIONS: Readonly<Record<string, string>> = {
  'cosmetic-only-diff':
    'Add functional changes or explain why formatting matters here.',
  'massive-unfocused-diff':
    'Consider splitting this into smaller, focused pull requests.',
  'dead-code-injection': 'Remove unused functions or add call sites.',
  'import-tsunami':
    'Remove unused imports or add code that uses them.',
  'suspicious-dependency':
    'Remove unused dependencies or add code that uses them.',
  'config-churn':
    'Explain why this config change is needed.',
  'test-free-feature': 'Include tests for the new behavior.',
  'inconsistent-style': 'Normalize indentation (tabs vs. spaces).',
  'duplicate-code-in-diff':
    'Extract duplicated code into a shared helper.',
  'high-comment-ratio':
    'Reduce inline comments — let the code speak for itself.',
  'ai-fluff-language':
    'Simplify the description — focus on concrete changes.',
  'missing-why':
    'Add a sentence explaining *why* this change is needed.',
  'template-ignored': 'Fill out the PR template sections.',
  'over-explained': 'Trim the description to the essentials.',
  'emoji-abuse': 'Reduce emoji usage in the description.',
  'bullet-vomit': 'Consolidate bullet points into prose.',
  'self-praise':
    'Let reviewers judge quality — remove self-praising language.',
  'generic-commit-msg':
    'Use descriptive commit messages (e.g., "fix: handle null user in auth").',
  'single-commit-dump':
    'Break the work into logical commits.',
  'author-mismatch':
    'Verify that commit authorship is correct.',
  'hallucinated-file':
    "The stack trace references files that don't exist. Please verify.",
  'hallucinated-function':
    'The referenced function does not exist. Please check.',
  'hallucinated-line':
    'Line numbers in the stack trace seem too high. Please verify.',
  'no-reproduction-steps':
    'Add steps to reproduce the issue.',
  'version-mismatch':
    'Double-check the version number — it may not exist.',
  'overly-formal-issue':
    'Use a conversational tone — just describe the problem.',
  'duplicate-issue':
    'Search existing issues before opening a new one.',
  'no-functional-value':
    'Explain the functional value this change adds.',
};

/**
 * Build the educational comment markdown.
 * @param ctx - analysis context
 * @param score - calculated slop score
 * @returns markdown string
 */
export function buildComment(
  ctx: AnalysisContext,
  score: SlopScore,
): string {
  const itemType =
    'eventType' in ctx && ctx.eventType === 'pull_request'
      ? 'PR'
      : 'issue';

  // Show top 5 signals sorted by weighted score
  const topSignals = [...score.signals]
    .sort((a, b) => b.score * b.confidence - a.score * a.confidence)
    .slice(0, 5);

  const rows = topSignals
    .map((s) => buildRow(s))
    .join('\n');

  const suggestions = topSignals
    .map((s) => SUGGESTIONS[s.id])
    .filter(Boolean)
    .map((s) => `- ${s}`)
    .join('\n');

  let body = `### ai-slop-guard review

This ${itemType} was automatically flagged for review. Here's what we found:

| Check | Status | Detail |
|-------|--------|--------|
${rows}

**Slop Score: ${score.total}** — _${score.verdict}_`;

  if (score.verdict === 'suspicious' && suggestions) {
    body += `

**What you can do:**
${suggestions}
- If this is a legitimate contribution, a maintainer can add the \`${ctx.config.exemptLabels[0] ?? 'human-verified'}\` label to bypass.`;
  }

  if (score.verdict === 'likely-slop') {
    body += `

This was automatically closed. If this is a mistake, a maintainer can reopen it and add the \`${ctx.config.exemptLabels[0] ?? 'human-verified'}\` label.`;
  }

  body +=
    '\n\n---\n<sub>Automated by <a href="https://github.com/anthropics/ai-slop-guard">ai-slop-guard</a></sub>';

  return body;
}

/**
 * Post the educational comment on the PR/issue.
 * @param ctx - analysis context
 * @param score - calculated slop score
 */
export async function postComment(
  ctx: AnalysisContext,
  score: SlopScore,
): Promise<void> {
  const body = buildComment(ctx, score);

  const { data: existingComments } = await ctx.octokit.rest.issues.listComments({
    owner: ctx.owner,
    repo: ctx.repo,
    issue_number: ctx.number,
    per_page: 30,
  });

  const alreadyCommented = existingComments.some((c) =>
    c.body?.includes(COMMENT_SIGNATURE),
  );

  if (alreadyCommented) {
    return;
  }

  await ctx.octokit.rest.issues.createComment({
    owner: ctx.owner,
    repo: ctx.repo,
    issue_number: ctx.number,
    body: `${COMMENT_SIGNATURE}\n${body}`,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRow(signal: Signal): string {
  const icon = signal.score >= 4 ? '❌' : '⚠️';
  const detail = signal.detail.length > 80
    ? signal.detail.slice(0, 77) + '...'
    : signal.detail;
  return `| ${signal.id} | ${icon} | ${detail} |`;
}
