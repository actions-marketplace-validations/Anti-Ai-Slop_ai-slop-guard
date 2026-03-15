import * as core from '@actions/core';
import type { Signal, PRContext } from '../types';
import { SIGNALS } from '../scoring/signals';
import { isGenericCommitMessage } from '../utils/patterns';

/**
 * Analyze PR commit messages for quality issues.
 * @param ctx - PR analysis context
 * @returns array of detected signals
 */
export async function analyzePrCommits(ctx: PRContext): Promise<Signal[]> {
  const signals: Signal[] = [];

  if (ctx.commits.length === 0) return signals;

  const checks: Array<() => Signal | null> = [
    () => checkGenericMessages(ctx),
    () => checkSingleCommitDump(ctx),
    () => checkAuthorMismatch(ctx),
  ];

  for (const check of checks) {
    try {
      const result = check();
      if (result) signals.push(result);
    } catch (err) {
      core.warning(`pr-commits check failed: ${String(err)}`);
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkGenericMessages(ctx: PRContext): Signal | null {
  const genericCount = ctx.commits.filter((c) =>
    isGenericCommitMessage(c.message),
  ).length;

  // Flag if majority of commits are generic
  if (genericCount === 0) return null;
  const ratio = genericCount / ctx.commits.length;
  if (ratio < 0.5 && genericCount < 2) return null;

  return {
    id: SIGNALS.GENERIC_COMMIT_MSG.id,
    category: SIGNALS.GENERIC_COMMIT_MSG.category,
    score: SIGNALS.GENERIC_COMMIT_MSG.defaultScore,
    confidence: Math.min(0.6 + ratio * 0.3, 0.95),
    detail: `${genericCount}/${ctx.commits.length} commit messages are generic.`,
    evidence: ctx.commits
      .filter((c) => isGenericCommitMessage(c.message))
      .slice(0, 2)
      .map((c) => `"${c.message.slice(0, 50)}"`)
      .join(', '),
  };
}

function checkSingleCommitDump(ctx: PRContext): Signal | null {
  if (ctx.commits.length !== 1) return null;

  const totalChanges = ctx.diff.totalAdditions + ctx.diff.totalDeletions;
  if (totalChanges < 200) return null;

  return {
    id: SIGNALS.SINGLE_COMMIT_DUMP.id,
    category: SIGNALS.SINGLE_COMMIT_DUMP.category,
    score: SIGNALS.SINGLE_COMMIT_DUMP.defaultScore,
    confidence: 0.7,
    detail: `Entire PR (${totalChanges} line changes) in a single commit.`,
  };
}

function checkAuthorMismatch(ctx: PRContext): Signal | null {
  const mismatchedCommits = ctx.commits.filter(
    (c) => c.author.toLowerCase() !== ctx.author.toLowerCase(),
  );

  if (mismatchedCommits.length === 0) return null;

  const ratio = mismatchedCommits.length / ctx.commits.length;
  if (ratio < 0.5) return null;

  return {
    id: SIGNALS.AUTHOR_MISMATCH.id,
    category: SIGNALS.AUTHOR_MISMATCH.category,
    score: SIGNALS.AUTHOR_MISMATCH.defaultScore,
    confidence: 0.6,
    detail: `${mismatchedCommits.length}/${ctx.commits.length} commits by different author(s).`,
    evidence: [
      ...new Set(mismatchedCommits.map((c) => c.author)),
    ]
      .slice(0, 3)
      .join(', '),
  };
}
