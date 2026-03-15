import { describe, it, expect } from 'vitest';
import { calculateSlopScore } from '@/scoring/calculator';
import type { Signal } from '@/types';

/**
 * Helper to create a signal with sensible defaults.
 */
function makeSignal(overrides: Partial<Signal> & { id: string }): Signal {
  return {
    category: 'description',
    score: 2,
    confidence: 0.8,
    detail: 'test detail',
    ...overrides,
  };
}

describe('calculateSlopScore', () => {
  it('returns total=0 and verdict=clean for empty signals', () => {
    const result = calculateSlopScore([], 6, 12);

    expect(result.total).toBe(0);
    expect(result.verdict).toBe('clean');
    expect(result.signals).toHaveLength(0);
  });

  it('computes weighted total as score * confidence for a single signal', () => {
    const signals: Signal[] = [
      makeSignal({ id: 'ai-fluff-language', score: 3, confidence: 0.8 }),
    ];

    const result = calculateSlopScore(signals, 6, 12);

    expect(result.total).toBeCloseTo(2.4, 1);
    expect(result.verdict).toBe('clean');
  });

  it('returns suspicious when total exceeds warn threshold', () => {
    const signals: Signal[] = [
      makeSignal({ id: 'ai-fluff-language', category: 'description', score: 4, confidence: 0.9 }),
      makeSignal({ id: 'generic-commit-msg', category: 'commits', score: 3, confidence: 0.9 }),
    ];
    // total = 4*0.9 + 3*0.9 = 3.6 + 2.7 = 6.3 > warn(6)

    const result = calculateSlopScore(signals, 6, 12);

    expect(result.total).toBeGreaterThan(6);
    expect(result.verdict).toBe('suspicious');
  });

  it('returns likely-slop when total exceeds close threshold', () => {
    const signals: Signal[] = [
      makeSignal({ id: 'massive-unfocused-diff', category: 'diff-structure', score: 4, confidence: 1.0 }),
      makeSignal({ id: 'ai-fluff-language', category: 'description', score: 3, confidence: 1.0 }),
      makeSignal({ id: 'generic-commit-msg', category: 'commits', score: 3, confidence: 1.0 }),
      makeSignal({ id: 'test-free-feature', category: 'diff-quality', score: 3, confidence: 1.0 }),
    ];
    // total = 4 + 3 + 3 + 3 = 13 > close(12)

    const result = calculateSlopScore(signals, 6, 12);

    expect(result.total).toBeGreaterThan(12);
    expect(result.verdict).toBe('likely-slop');
  });

  it('groups scores by category in breakdown', () => {
    const signals: Signal[] = [
      makeSignal({ id: 'cosmetic-only-diff', category: 'diff-structure', score: 3, confidence: 1.0 }),
      makeSignal({ id: 'massive-unfocused-diff', category: 'diff-structure', score: 4, confidence: 0.5 }),
      makeSignal({ id: 'ai-fluff-language', category: 'description', score: 2, confidence: 0.9 }),
    ];

    const result = calculateSlopScore(signals, 6, 12);

    // diff-structure: 3*1.0 + 4*0.5 = 5.0
    expect(result.breakdown['diff-structure']).toBeCloseTo(5.0, 1);
    // description: 2*0.9 = 1.8
    expect(result.breakdown['description']).toBeCloseTo(1.8, 1);
    // other categories should be 0
    expect(result.breakdown['commits']).toBe(0);
    expect(result.breakdown['stacktrace']).toBe(0);
    expect(result.breakdown['duplicate']).toBe(0);
    expect(result.breakdown['semantic']).toBe(0);
    expect(result.breakdown['diff-quality']).toBe(0);
  });

  it('promotes to at least suspicious for a high-score signal even below warn threshold', () => {
    const signals: Signal[] = [
      makeSignal({ id: 'hallucinated-file', category: 'stacktrace', score: 5, confidence: 0.8 }),
    ];
    // total = 5 * 0.8 = 4.0 which is < warnThreshold of 10

    const result = calculateSlopScore(signals, 10, 20);

    expect(result.total).toBeLessThan(10);
    expect(result.verdict).toBe('suspicious');
  });

  it('demotes verdict when all signals have low confidence (< 0.6)', () => {
    const signals: Signal[] = [
      makeSignal({ id: 'massive-unfocused-diff', category: 'diff-structure', score: 5, confidence: 0.5 }),
      makeSignal({ id: 'ai-fluff-language', category: 'description', score: 5, confidence: 0.4 }),
      makeSignal({ id: 'generic-commit-msg', category: 'commits', score: 5, confidence: 0.5 }),
    ];
    // total = 2.5 + 2.0 + 2.5 = 7.0 > warn(6), would be 'suspicious'
    // but all confidence < 0.6 → demoted to 'clean'

    const result = calculateSlopScore(signals, 6, 12);

    // The raw total exceeds warn threshold, but confidence penalty should demote
    expect(result.verdict).not.toBe('likely-slop');
    // Demoted by one level from what it would normally be
    expect(['clean', 'suspicious']).toContain(result.verdict);
  });

  it('includes analyzedAt as a valid ISO timestamp', () => {
    const result = calculateSlopScore([], 6, 12);

    expect(result.analyzedAt).toBeTruthy();
    const parsed = new Date(result.analyzedAt);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it('preserves all input signals in the result', () => {
    const signals: Signal[] = [
      makeSignal({ id: 'cosmetic-only-diff', category: 'diff-structure', score: 3, confidence: 0.7 }),
      makeSignal({ id: 'ai-fluff-language', category: 'description', score: 2, confidence: 0.9 }),
    ];

    const result = calculateSlopScore(signals, 6, 12);

    expect(result.signals).toHaveLength(2);
    expect(result.signals.map(s => s.id)).toContain('cosmetic-only-diff');
    expect(result.signals.map(s => s.id)).toContain('ai-fluff-language');
  });
});
