import * as core from '@actions/core';
import * as fuzzball from 'fuzzball';
import type { Signal, IssueContext } from '../types';
import { SIGNALS } from '../scoring/signals';

const SIMILARITY_THRESHOLD = 85;

/**
 * Detect if the current issue is a duplicate of an existing one.
 * Uses fuzzy string matching via fuzzball.
 * @param ctx - Issue analysis context
 * @returns array of detected signals
 */
export async function detectDuplicates(
  ctx: IssueContext,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  try {
    const result = checkDuplicateIssue(ctx);
    if (result) signals.push(result);
  } catch (err) {
    core.warning(`duplicate-detector check failed: ${String(err)}`);
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

function checkDuplicateIssue(ctx: IssueContext): Signal | null {
  if (ctx.existingIssues.length === 0) return null;

  const currentText = `${ctx.title} ${ctx.body}`.slice(0, 1000);
  let bestScore = 0;
  let bestMatch = -1;

  for (const existing of ctx.existingIssues) {
    const existingText = `${existing.title} ${existing.body}`.slice(0, 1000);
    const score = fuzzball.ratio(currentText, existingText);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = existing.number;
    }
  }

  if (bestScore < SIMILARITY_THRESHOLD) return null;

  return {
    id: SIGNALS.DUPLICATE_ISSUE.id,
    category: SIGNALS.DUPLICATE_ISSUE.category,
    score: SIGNALS.DUPLICATE_ISSUE.defaultScore,
    confidence: bestScore / 100,
    detail: `${bestScore}% similar to issue #${bestMatch}.`,
    evidence: `#${bestMatch} (${bestScore}% match)`,
  };
}
