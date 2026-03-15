import { describe, it, expect } from 'vitest';
import { analyzePrCommits } from '@/analyzers/pr-commits';
import { createMockPRContext, createEmptyDiff } from '../../helpers';

describe('analyzePrCommits', () => {
  describe('generic-commit-msg', () => {
    it('should flag commits with generic messages like "update", "fix", "improve"', async () => {
      const ctx = createMockPRContext({
        commits: [
          { sha: 'abc1234', message: 'update', author: 'user1' },
          { sha: 'def5678', message: 'fix', author: 'user1' },
          { sha: 'ghi9012', message: 'improve', author: 'user1' },
        ],
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrCommits(ctx);
      const signal = signals.find((s) => s.id === 'generic-commit-msg');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag commits with descriptive messages', async () => {
      const ctx = createMockPRContext({
        commits: [
          { sha: 'abc1234', message: 'feat: add JWT token validation to auth middleware', author: 'user1' },
          { sha: 'def5678', message: 'fix: resolve null pointer in session handler when cookie expires', author: 'user1' },
          { sha: 'ghi9012', message: 'test: add integration tests for login flow', author: 'user1' },
        ],
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrCommits(ctx);
      const signal = signals.find((s) => s.id === 'generic-commit-msg');

      expect(signal).toBeUndefined();
    });
  });

  describe('single-commit-dump', () => {
    it('should flag a single commit with >= 200 total changes', async () => {
      const ctx = createMockPRContext({
        commits: [
          { sha: 'abc1234', message: 'feat: add entire authentication system', author: 'user1' },
        ],
        diff: createEmptyDiff({
          totalAdditions: 180,
          totalDeletions: 50,
          totalFilesChanged: 12,
        }),
      });

      const signals = await analyzePrCommits(ctx);
      const signal = signals.find((s) => s.id === 'single-commit-dump');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag a single commit with < 200 total changes', async () => {
      const ctx = createMockPRContext({
        commits: [
          { sha: 'abc1234', message: 'feat: add password reset endpoint', author: 'user1' },
        ],
        diff: createEmptyDiff({
          totalAdditions: 40,
          totalDeletions: 10,
          totalFilesChanged: 3,
        }),
      });

      const signals = await analyzePrCommits(ctx);
      const signal = signals.find((s) => s.id === 'single-commit-dump');

      expect(signal).toBeUndefined();
    });

    it('should NOT flag when there are multiple commits', async () => {
      const ctx = createMockPRContext({
        commits: [
          { sha: 'abc1234', message: 'feat: add auth middleware', author: 'user1' },
          { sha: 'def5678', message: 'feat: add session handler', author: 'user1' },
          { sha: 'ghi9012', message: 'test: add auth tests', author: 'user1' },
        ],
        diff: createEmptyDiff({
          totalAdditions: 300,
          totalDeletions: 50,
          totalFilesChanged: 15,
        }),
      });

      const signals = await analyzePrCommits(ctx);
      const signal = signals.find((s) => s.id === 'single-commit-dump');

      expect(signal).toBeUndefined();
    });
  });

  describe('author-mismatch', () => {
    it('should flag when majority of commits are by a different author', async () => {
      const ctx = createMockPRContext({
        author: 'pr-author',
        commits: [
          { sha: 'abc1234', message: 'feat: add login', author: 'other-person' },
          { sha: 'def5678', message: 'feat: add logout', author: 'other-person' },
          { sha: 'ghi9012', message: 'feat: add session', author: 'other-person' },
          { sha: 'jkl3456', message: 'chore: update readme', author: 'pr-author' },
        ],
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrCommits(ctx);
      const signal = signals.find((s) => s.id === 'author-mismatch');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when all commits are by the PR author', async () => {
      const ctx = createMockPRContext({
        author: 'pr-author',
        commits: [
          { sha: 'abc1234', message: 'feat: add login', author: 'pr-author' },
          { sha: 'def5678', message: 'feat: add logout', author: 'pr-author' },
          { sha: 'ghi9012', message: 'test: add tests', author: 'pr-author' },
        ],
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrCommits(ctx);
      const signal = signals.find((s) => s.id === 'author-mismatch');

      expect(signal).toBeUndefined();
    });
  });
});
