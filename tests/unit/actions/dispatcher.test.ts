import { describe, it, expect, vi } from 'vitest';

vi.mock('@actions/core', () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  getInput: vi.fn(),
}));

import { dispatchActions } from '@/actions/dispatcher';
import { createMockPRContext } from '../../helpers';
import type { SlopScore } from '@/types';

function makeCleanScore(): SlopScore {
  return {
    total: 0,
    signals: [],
    verdict: 'clean',
    breakdown: {
      'diff-structure': 0,
      'diff-quality': 0,
      description: 0,
      commits: 0,
      metadata: 0,
      stacktrace: 0,
      duplicate: 0,
      semantic: 0,
    },
    analyzedAt: new Date().toISOString(),
  };
}

describe('dispatchActions', () => {
  it('is a function', () => {
    expect(typeof dispatchActions).toBe('function');
  });

  it('returns empty array for clean verdict', async () => {
    const ctx = createMockPRContext();
    const result = await dispatchActions(makeCleanScore(), ctx);
    expect(result).toEqual([]);
  });
});
