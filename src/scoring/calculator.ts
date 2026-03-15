import type { Signal, SignalCategory, SlopScore, Verdict } from '../types';
import { applyMinimumRules, applyConfidencePenalty } from './thresholds';

const ALL_CATEGORIES: readonly SignalCategory[] = [
  'diff-structure',
  'diff-quality',
  'description',
  'commits',
  'stacktrace',
  'duplicate',
  'semantic',
];

/**
 * Calculate the aggregate slop score from detected signals.
 * Formula: total = Σ(score × confidence)
 * @param signals - detected signals from analyzers
 * @param warnThreshold - score threshold for "suspicious" verdict
 * @param closeThreshold - score threshold for "likely-slop" verdict
 * @returns aggregated SlopScore with verdict and breakdown
 */
export function calculateSlopScore(
  signals: readonly Signal[],
  warnThreshold: number,
  closeThreshold: number,
): SlopScore {
  const total = signals.reduce(
    (sum, s) => sum + s.score * s.confidence,
    0,
  );

  const breakdown = buildBreakdown(signals);
  const verdict = determineVerdict(total, warnThreshold, closeThreshold);

  let score: SlopScore = {
    total: Math.round(total * 100) / 100,
    signals,
    verdict,
    breakdown,
    analyzedAt: new Date().toISOString(),
  };

  score = applyMinimumRules(score);
  score = applyConfidencePenalty(score);

  return score;
}

/**
 * Build a breakdown of scores per signal category.
 */
function buildBreakdown(
  signals: readonly Signal[],
): Readonly<Record<SignalCategory, number>> {
  const breakdown = {} as Record<SignalCategory, number>;

  for (const cat of ALL_CATEGORIES) {
    breakdown[cat] = 0;
  }

  for (const signal of signals) {
    breakdown[signal.category] += signal.score * signal.confidence;
  }

  // Round values
  for (const cat of ALL_CATEGORIES) {
    breakdown[cat] = Math.round((breakdown[cat] ?? 0) * 100) / 100;
  }

  return breakdown;
}

/**
 * Determine verdict based on total score and thresholds.
 */
function determineVerdict(
  total: number,
  warnThreshold: number,
  closeThreshold: number,
): Verdict {
  if (total >= closeThreshold) return 'likely-slop';
  if (total >= warnThreshold) return 'suspicious';
  return 'clean';
}
