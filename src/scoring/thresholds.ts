import type { SlopScore, Verdict } from '../types';

/**
 * If any single signal has score >= 5, enforce at least "suspicious" verdict.
 * This ensures critical signals (like hallucinated files) are never ignored.
 */
export function applyMinimumRules(score: SlopScore): SlopScore {
  if (score.verdict !== 'clean') return score;

  const hasCriticalSignal = score.signals.some(
    (s) => s.score >= 5 && s.confidence >= 0.7,
  );

  if (!hasCriticalSignal) return score;

  return { ...score, verdict: 'suspicious' };
}

/**
 * If all signals have low confidence (< 0.6), demote the verdict by one level.
 * likely-slop → suspicious, suspicious → clean
 */
export function applyConfidencePenalty(score: SlopScore): SlopScore {
  if (score.signals.length === 0) return score;
  if (score.verdict === 'clean') return score;

  const allLowConfidence = score.signals.every((s) => s.confidence < 0.6);
  if (!allLowConfidence) return score;

  const demoted = demoteVerdict(score.verdict);
  return { ...score, verdict: demoted };
}

/**
 * Demote a verdict by one level.
 */
function demoteVerdict(verdict: Verdict): Verdict {
  switch (verdict) {
    case 'likely-slop':
      return 'suspicious';
    case 'suspicious':
      return 'clean';
    case 'clean':
      return 'clean';
  }
}
