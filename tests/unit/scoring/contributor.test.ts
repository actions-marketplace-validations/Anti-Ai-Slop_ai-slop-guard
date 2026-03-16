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

function mockOctokit(
  pulls: Array<{ user: { login: string }; merged_at: string | null }> = [],
  overrides: Record<string, unknown> = {},
): OctokitClient {
  return {
    rest: {
      pulls: {
        list: vi.fn().mockResolvedValue({ data: pulls }),
      },
      repos: {
        checkCollaborator: vi.fn().mockRejectedValue(new Error('404')),
      },
      search: {
        issuesAndPullRequests: vi.fn().mockResolvedValue({ data: { total_count: 0 } }),
      },
      ...overrides,
    },
  } as unknown as OctokitClient;
}

describe('applyContributorMultiplier', () => {
  // ── Existing behavior ──────────────────────────────────────────────

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
        repos: {
          checkCollaborator: vi.fn().mockRejectedValue(new Error('404')),
        },
        search: {
          issuesAndPullRequests: vi.fn().mockResolvedValue({ data: { total_count: 0 } }),
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

  // ── Blocked users ──────────────────────────────────────────────────

  it('should auto-flag blocked users with score 99', async () => {
    const score = makeScore(4, 'clean');
    const octo = mockOctokit([]);
    const config = createDefaultConfig({ blockedUsers: ['spammer'] });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'spammer', config);

    expect(result.score.total).toBe(99);
    expect(result.score.verdict).toBe('likely-slop');
    expect(result.options.isBlockedUser).toBe(true);
  });

  it('should match blocked users case-insensitively', async () => {
    const score = makeScore(4, 'clean');
    const octo = mockOctokit([]);
    const config = createDefaultConfig({ blockedUsers: ['Spammer'] });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'SPAMMER', config);

    expect(result.options.isBlockedUser).toBe(true);
  });

  // ── Trusted users ──────────────────────────────────────────────────

  it('should apply 0.5x multiplier for trusted users', async () => {
    const score = makeScore(10, 'suspicious');
    const octo = mockOctokit([]);
    const config = createDefaultConfig({ trustedUsers: ['friend'] });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'friend', config);

    expect(result.multiplier).toBe(0.5);
    expect(result.score.total).toBe(5);
    expect(result.score.verdict).toBe('clean');
    expect(result.options.isTrustedUser).toBe(true);
  });

  it('should match trusted users case-insensitively', async () => {
    const score = makeScore(10, 'suspicious');
    const octo = mockOctokit([]);
    const config = createDefaultConfig({ trustedUsers: ['Friend'] });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'FRIEND', config);

    expect(result.options.isTrustedUser).toBe(true);
  });

  // ── Collaborator exclusion ─────────────────────────────────────────

  it('should skip analysis for repo collaborators when enabled', async () => {
    const score = makeScore(10, 'suspicious');
    const octo = mockOctokit([], {
      repos: {
        checkCollaborator: vi.fn().mockResolvedValue({ status: 204 }),
      },
    });
    const config = createDefaultConfig({ excludeCollaborators: true });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'teammate', config);

    expect(result.multiplier).toBe(1.0);
    expect(result.options.isCollaborator).toBe(true);
    expect(result.score.total).toBe(10); // score unchanged, caller skips dispatch
  });

  it('should not skip collaborators when exclude-collaborators is false', async () => {
    const score = makeScore(8, 'suspicious');
    const octo = mockOctokit([], {
      repos: {
        checkCollaborator: vi.fn().mockResolvedValue({ status: 204 }),
      },
    });
    const config = createDefaultConfig({ excludeCollaborators: false });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'teammate', config);

    // Should proceed to merged PR check, not skip
    expect(result.options.isCollaborator).toBeUndefined();
  });

  it('should not skip non-collaborators', async () => {
    const score = makeScore(8, 'suspicious');
    const octo = mockOctokit([]); // default mock rejects checkCollaborator → not a collaborator
    const config = createDefaultConfig({ excludeCollaborators: true });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'outsider', config);

    // Should proceed to merged PR check
    expect(result.options.isCollaborator).toBeUndefined();
    expect(result.multiplier).toBe(1.5); // new contributor
  });

  // ── Repeat offenders ───────────────────────────────────────────────

  it('should escalate multiplier for repeat offenders', async () => {
    const score = makeScore(8, 'suspicious');
    const octo = mockOctokit([], {
      search: {
        issuesAndPullRequests: vi.fn().mockResolvedValue({ data: { total_count: 5 } }),
      },
    });
    const config = createDefaultConfig({
      repeatOffenderThreshold: 3,
      repeatOffenderMultiplier: 2.0,
    });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'recidivist', config);

    expect(result.multiplier).toBe(2.0);
    expect(result.score.total).toBe(16);
    expect(result.score.verdict).toBe('likely-slop');
    expect(result.options.isRepeatOffender).toBe(true);
    expect(result.options.pastSlopCount).toBe(5);
  });

  it('should not escalate when below repeat offender threshold', async () => {
    const score = makeScore(8, 'suspicious');
    const octo = mockOctokit([], {
      search: {
        issuesAndPullRequests: vi.fn().mockResolvedValue({ data: { total_count: 1 } }),
      },
    });
    const config = createDefaultConfig({ repeatOffenderThreshold: 3 });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'newuser', config);

    expect(result.options.isRepeatOffender).toBe(false);
    // Falls through to new contributor check (0 merged PRs → 1.5x)
    expect(result.multiplier).toBe(1.5);
  });

  // ── Priority order ─────────────────────────────────────────────────

  it('blocked takes priority over trusted', async () => {
    const score = makeScore(4, 'clean');
    const octo = mockOctokit([]);
    const config = createDefaultConfig({
      blockedUsers: ['dual'],
      trustedUsers: ['dual'],
    });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'dual', config);

    expect(result.options.isBlockedUser).toBe(true);
  });

  it('trusted takes priority over collaborator check', async () => {
    const score = makeScore(10, 'suspicious');
    const octo = mockOctokit([], {
      repos: {
        checkCollaborator: vi.fn().mockResolvedValue({ status: 204 }),
      },
    });
    const config = createDefaultConfig({ trustedUsers: ['friend'] });
    const result = await applyContributorMultiplier(score, octo, 'owner', 'repo', 'friend', config);

    expect(result.options.isTrustedUser).toBe(true);
    expect(result.multiplier).toBe(0.5);
  });
});
