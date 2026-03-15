import { describe, it, expect, vi } from 'vitest';
import { applyContributorMultiplier } from '@/scoring/contributor';
import { createDefaultConfig } from '../../helpers';
import type { SlopScore, OctokitClient } from '@/types';

function makeScore(total: number, verdict: 'clean' | 'suspicious' | 'likely-slop'): SlopScore {
  return {
    total,
    verdict,
    signals: [],
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

function mockOctokit(pulls: Array<{ user: { login: string }; merged_at: string | null }>): OctokitClient {
  return {
    rest: {
      pulls: {
        list: vi.fn().mockResolvedValue({ data: pulls }),
      },
    },
  } as unknown as OctokitClient;
}

describe('applyContributorMultiplier', () => {
  it('should multiply score by 1.5 for users with 0 merged PRs', async () => {
    const score = makeScore(8, 'suspicious');
    const octo = mockOctokit([]);
    const config = createDefaultConfig();
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'newuser', config);

    expect(result.multiplier).toBe(1.5);
    expect(result.score.total).toBe(12);
    expect(result.mergedCount).toBe(0);
  });

  it('should multiply score by 1.25 for users with 1-2 merged PRs', async () => {
    const score = makeScore(8, 'suspicious');
    const pulls = [
      { user: { login: 'someuser' }, merged_at: '2024-01-01T00:00:00Z' },
      { user: { login: 'someuser' }, merged_at: '2024-02-01T00:00:00Z' },
    ];
    const octo = mockOctokit(pulls);
    const config = createDefaultConfig();
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'someuser', config);

    expect(result.multiplier).toBe(1.25);
    expect(result.score.total).toBe(10);
    expect(result.mergedCount).toBe(2);
  });

  it('should not multiply for users with 3+ merged PRs', async () => {
    const score = makeScore(8, 'suspicious');
    const pulls = [
      { user: { login: 'veteran' }, merged_at: '2024-01-01T00:00:00Z' },
      { user: { login: 'veteran' }, merged_at: '2024-02-01T00:00:00Z' },
      { user: { login: 'veteran' }, merged_at: '2024-03-01T00:00:00Z' },
      { user: { login: 'veteran' }, merged_at: '2024-04-01T00:00:00Z' },
      { user: { login: 'veteran' }, merged_at: '2024-05-01T00:00:00Z' },
    ];
    const octo = mockOctokit(pulls);
    const config = createDefaultConfig();
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'veteran', config);

    expect(result.multiplier).toBe(1.0);
    expect(result.score.total).toBe(8);
  });

  it('should fail open (multiplier 1.0) when API call fails', async () => {
    const score = makeScore(8, 'suspicious');
    const octo = {
      rest: {
        pulls: {
          list: vi.fn().mockRejectedValue(new Error('rate limit')),
        },
      },
    } as unknown as OctokitClient;
    const config = createDefaultConfig();
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'user', config);

    expect(result.multiplier).toBe(1.0);
    expect(result.score.total).toBe(8);
  });

  it('should skip when contributor-history-check is false', async () => {
    const score = makeScore(8, 'suspicious');
    const octo = mockOctokit([]);
    const config = createDefaultConfig({ contributorHistoryCheck: false });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'newuser', config);

    expect(result.multiplier).toBe(1.0);
    expect(result.score.total).toBe(8);
  });

  it('should skip for known bots', async () => {
    const score = makeScore(8, 'suspicious');
    const octo = mockOctokit([]);
    const config = createDefaultConfig();
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'dependabot[bot]', config);

    expect(result.multiplier).toBe(1.0);
  });

  it('should update verdict when score crosses threshold', async () => {
    const score = makeScore(8, 'suspicious');
    const octo = mockOctokit([]); // 0 merged PRs → 1.5x
    const config = createDefaultConfig({ slopScoreWarn: 6, slopScoreClose: 12 });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'newuser', config);

    // 8 * 1.5 = 12 → likely-slop
    expect(result.score.total).toBe(12);
    expect(result.score.verdict).toBe('likely-slop');
  });
});
