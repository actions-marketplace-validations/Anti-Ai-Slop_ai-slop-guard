import * as core from '@actions/core';
import type { Signal, IssueContext } from '../types';
import { SIGNALS } from '../scoring/signals';
import { countFluffWords, countFormalPhrases } from '../utils/patterns';
import { hasReproductionSteps } from '../utils/text-utils';

/**
 * Analyze issue content for quality signals.
 * @param ctx - Issue analysis context
 * @returns array of detected signals
 */
export async function analyzeIssueContent(
  ctx: IssueContext,
): Promise<Signal[]> {
  const signals: Signal[] = [];
  const text = `${ctx.title}\n${ctx.body}`;

  if (!text.trim()) return signals;

  const checks: Array<() => Signal | null | Promise<Signal | null>> = [
    () => checkNoReproductionSteps(ctx),
    () => checkOverlyFormal(text),
    () => checkVersionMismatch(ctx),
  ];

  for (const check of checks) {
    try {
      const result = await check();
      if (result) signals.push(result);
    } catch (err) {
      core.warning(`issue-content check failed: ${String(err)}`);
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkNoReproductionSteps(ctx: IssueContext): Signal | null {
  const isBugReport =
    ctx.labels.some((l) => /bug|defect|error/i.test(l)) ||
    /\b(?:bug|error|crash|fail|broken|not working)\b/i.test(ctx.title);

  if (!isBugReport) return null;
  if (hasReproductionSteps(ctx.body)) return null;

  return {
    id: SIGNALS.NO_REPRODUCTION_STEPS.id,
    category: SIGNALS.NO_REPRODUCTION_STEPS.category,
    score: SIGNALS.NO_REPRODUCTION_STEPS.defaultScore,
    confidence: 0.75,
    detail: 'Bug report without steps to reproduce.',
  };
}

function checkOverlyFormal(text: string): Signal | null {
  const fluffCount = countFluffWords(text);
  const formalCount = countFormalPhrases(text);
  const totalIndicators = fluffCount + formalCount;
  const wordCount = text.split(/\s+/).length;

  if (wordCount < 50) return null;
  const density = totalIndicators / wordCount;
  if (totalIndicators < 3) return null;

  // Scale score with indicator density — heavy formalism is a stronger signal
  const score = totalIndicators >= 8
    ? 5
    : totalIndicators >= 5
      ? 4
      : SIGNALS.OVERLY_FORMAL_ISSUE.defaultScore;

  return {
    id: SIGNALS.OVERLY_FORMAL_ISSUE.id,
    category: SIGNALS.OVERLY_FORMAL_ISSUE.category,
    score,
    confidence: Math.min(0.5 + density * 5 + formalCount * 0.05, 0.95),
    detail: `Issue uses unusually formal language (${formalCount} formal phrases, ${fluffCount} filler words).`,
  };
}

/**
 * Check if issue references software versions that don't exist in releases.
 */
async function checkVersionMismatch(ctx: IssueContext): Promise<Signal | null> {
  const versionPattern = /\b[vV]?(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)\b/g;
  const mentionedVersions = [...ctx.body.matchAll(versionPattern)].map((m) => m[1] ?? '');

  if (mentionedVersions.length === 0) return null;

  let releaseVersions: string[];
  try {
    const { data: releases } = await ctx.octokit.rest.repos.listReleases({
      owner: ctx.owner,
      repo: ctx.repo,
      per_page: 100,
    });
    releaseVersions = releases.map((r) => r.tag_name.replace(/^[vV]/, ''));
  } catch {
    return null;
  }

  if (releaseVersions.length === 0) return null;

  const nonExistent = mentionedVersions.filter(
    (v) => !releaseVersions.some((rv) => rv === v || rv.startsWith(v) || v.startsWith(rv)),
  );

  if (nonExistent.length === 0) return null;

  return {
    id: SIGNALS.VERSION_MISMATCH.id,
    category: SIGNALS.VERSION_MISMATCH.category,
    score: SIGNALS.VERSION_MISMATCH.defaultScore,
    confidence: 0.75,
    detail: `References version(s) not found in releases: ${nonExistent.slice(0, 3).join(', ')}`,
    evidence: `Known: ${releaseVersions.slice(0, 5).join(', ')}${releaseVersions.length > 5 ? '...' : ''}`,
  };
}
