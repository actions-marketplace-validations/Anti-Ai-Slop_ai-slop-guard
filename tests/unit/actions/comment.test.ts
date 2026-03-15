import { describe, it, expect } from 'vitest';
import { buildComment } from '@/actions/comment';
import { createMockPRContext } from '../../helpers';
import type { SlopScore, Signal } from '@/types';

function makeScore(overrides: Partial<SlopScore> = {}): SlopScore {
  return {
    total: 8.5,
    signals: [
      {
        id: 'ai-fluff-language',
        category: 'description',
        score: 2,
        confidence: 0.9,
        detail: 'Uses phrases like "comprehensive" and "robust"',
      },
    ],
    verdict: 'suspicious',
    breakdown: {
      'diff-structure': 0,
      'diff-quality': 0,
      description: 1.8,
      commits: 0,
      stacktrace: 0,
      duplicate: 0,
      semantic: 0,
    },
    analyzedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildComment', () => {
  const ctx = createMockPRContext();

  it('includes signal IDs', () => {
    const comment = buildComment(ctx, makeScore());
    expect(comment).toContain('ai-fluff-language');
  });

  it('includes the total score', () => {
    const comment = buildComment(ctx, makeScore({ total: 8.5 }));
    expect(comment).toContain('8.5');
  });

  it('includes the verdict', () => {
    const comment = buildComment(ctx, makeScore({ verdict: 'suspicious' }));
    expect(comment).toContain('suspicious');
  });

  it('includes "What you can do" for suspicious verdict', () => {
    const comment = buildComment(ctx, makeScore({ verdict: 'suspicious' }));
    expect(comment).toContain('What you can do');
  });

  it('includes "automatically closed" for likely-slop verdict', () => {
    const signals: Signal[] = [
      { id: 'massive-unfocused-diff', category: 'diff-structure', score: 5, confidence: 1.0, detail: 'Huge diff' },
      { id: 'ai-fluff-language', category: 'description', score: 3, confidence: 1.0, detail: 'Fluff' },
    ];
    const comment = buildComment(
      ctx,
      makeScore({ total: 14, signals, verdict: 'likely-slop' }),
    );
    expect(comment.toLowerCase()).toContain('closed');
  });

  it('does NOT contain standalone "AI" (only in signal IDs)', () => {
    const comment = buildComment(ctx, makeScore());
    const withoutIds = comment
      .replace(/ai-slop[:\-][\w-]*/gi, '')  // eslint-disable-line no-useless-escape
      .replace(/ai-fluff-language/gi, '')
      .replace(/ai-slop-guard/gi, '');
    expect(withoutIds).not.toMatch(/\bAI\b/);
  });

  it('produces a comment under 3000 chars', () => {
    const comment = buildComment(ctx, makeScore());
    expect(comment.length).toBeLessThan(3000);
  });

  it('shows at most 5 signals', () => {
    const signals: Signal[] = Array.from({ length: 7 }, (_, i) => ({
      id: `signal-${i}`,
      category: 'diff-structure' as const,
      score: 3,
      confidence: 0.8,
      detail: `Detail ${i}`,
    }));
    const comment = buildComment(
      ctx,
      makeScore({ signals, total: 15, verdict: 'likely-slop' }),
    );
    // Count table rows with signal IDs
    const rows = comment.split('\n').filter((l) => l.startsWith('| signal-'));
    expect(rows.length).toBeLessThanOrEqual(5);
  });
});
