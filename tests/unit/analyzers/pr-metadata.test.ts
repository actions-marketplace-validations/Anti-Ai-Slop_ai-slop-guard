import { describe, it, expect, vi } from 'vitest';
import { analyzePrMetadata } from '@/analyzers/pr-metadata';
import { createMockPRContext, createDefaultConfig } from '../../helpers';

describe('analyzePrMetadata', () => {
  // ── Source Branch Check ──────────────────────────────────────────────

  describe('blocked-source-branch', () => {
    it('should flag PR from main', async () => {
      const ctx = createMockPRContext({ headBranch: 'main' });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'blocked-source-branch');

      expect(signal).toBeDefined();
      expect(signal!.score).toBe(4);
      expect(signal!.confidence).toBe(0.9);
    });

    it('should flag PR from master', async () => {
      const ctx = createMockPRContext({ headBranch: 'master' });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'blocked-source-branch');

      expect(signal).toBeDefined();
    });

    it('should flag PR from Main (case-insensitive)', async () => {
      const ctx = createMockPRContext({ headBranch: 'Main' });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'blocked-source-branch');

      expect(signal).toBeDefined();
    });

    it('should NOT flag PR from feature branch', async () => {
      const ctx = createMockPRContext({ headBranch: 'feature/auth' });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'blocked-source-branch');

      expect(signal).toBeUndefined();
    });

    it('should skip check when blocked-source-branches is empty', async () => {
      const ctx = createMockPRContext({
        headBranch: 'main',
        config: createDefaultConfig({ blockedSourceBranches: [] }),
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'blocked-source-branch');

      expect(signal).toBeUndefined();
    });
  });

  // ── Honeypot Detection ───────────────────────────────────────────────

  describe('honeypot-triggered', () => {
    it('should flag when PR body contains honeypot term', async () => {
      const ctx = createMockPRContext({
        body: 'This PR adds a new feature. pineapple. Also fixes a bug.',
        config: createDefaultConfig({ honeypotTerms: ['PINEAPPLE'] }),
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'honeypot-triggered');

      expect(signal).toBeDefined();
      expect(signal!.score).toBe(5);
      expect(signal!.confidence).toBe(1.0);
    });

    it('should flag when PINEAPPLE appears in mixed case', async () => {
      const ctx = createMockPRContext({
        body: 'Some text with PiNeApPlE inside it.',
        config: createDefaultConfig({ honeypotTerms: ['PINEAPPLE'] }),
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'honeypot-triggered');

      expect(signal).toBeDefined();
    });

    it('should NOT flag when term is absent', async () => {
      const ctx = createMockPRContext({
        body: 'This is a normal PR description without any trap words.',
        config: createDefaultConfig({ honeypotTerms: ['PINEAPPLE'] }),
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'honeypot-triggered');

      expect(signal).toBeUndefined();
    });

    it('should skip check when honeypot-terms is empty', async () => {
      const ctx = createMockPRContext({
        body: 'PINEAPPLE everywhere!',
        config: createDefaultConfig({ honeypotTerms: [] }),
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'honeypot-triggered');

      expect(signal).toBeUndefined();
    });

    it('should trigger if ANY of multiple terms match', async () => {
      const ctx = createMockPRContext({
        body: 'I like watermelon juice.',
        config: createDefaultConfig({
          honeypotTerms: ['PINEAPPLE', 'WATERMELON'],
        }),
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'honeypot-triggered');

      expect(signal).toBeDefined();
    });
  });

  // ── Negative Reactions Check ─────────────────────────────────────────

  describe('community-flagged', () => {
    it('should flag when negative reactions exceed threshold', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            get: vi.fn().mockResolvedValue({
              data: {
                reactions: { '-1': 3, confused: 2, '+1': 0, laugh: 0 },
              },
            }),
          },
          repos: { listLanguages: vi.fn().mockResolvedValue({ data: {} }) },
        },
      };
      const ctx = createMockPRContext({
        config: createDefaultConfig({ maxNegativeReactions: 3 }),
        octokit: mockOctokit as never,
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'community-flagged');

      expect(signal).toBeDefined();
      expect(signal!.score).toBe(3);
      expect(signal!.confidence).toBe(0.8);
    });

    it('should NOT flag when reactions are below threshold', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            get: vi.fn().mockResolvedValue({
              data: {
                reactions: { '-1': 1, confused: 0 },
              },
            }),
          },
          repos: { listLanguages: vi.fn().mockResolvedValue({ data: {} }) },
        },
      };
      const ctx = createMockPRContext({
        config: createDefaultConfig({ maxNegativeReactions: 3 }),
        octokit: mockOctokit as never,
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'community-flagged');

      expect(signal).toBeUndefined();
    });

    it('should skip when max-negative-reactions is 0', async () => {
      const ctx = createMockPRContext({
        config: createDefaultConfig({ maxNegativeReactions: 0 }),
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'community-flagged');

      expect(signal).toBeUndefined();
    });

    it('should fail open when API call fails', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            get: vi.fn().mockRejectedValue(new Error('rate limit')),
          },
          repos: { listLanguages: vi.fn().mockResolvedValue({ data: {} }) },
        },
      };
      const ctx = createMockPRContext({
        config: createDefaultConfig({ maxNegativeReactions: 3 }),
        octokit: mockOctokit as never,
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'community-flagged');

      expect(signal).toBeUndefined();
    });
  });

  // ── Language Mismatch Detection ──────────────────────────────────────

  describe('language-mismatch', () => {
    it('should flag when most added files are in a foreign language', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            get: vi.fn().mockResolvedValue({
              data: { reactions: {} },
            }),
          },
          repos: {
            listLanguages: vi.fn().mockResolvedValue({
              data: { TypeScript: 95000, JavaScript: 5000 },
            }),
          },
        },
      };
      const ctx = createMockPRContext({
        diff: {
          files: [
            { newPath: 'src/main.py', status: 'added', oldPath: 'src/main.py', isBinary: false, language: 'python', isTest: false, isConfig: false, hunks: [], additions: [], deletions: [] },
            { newPath: 'src/utils.py', status: 'added', oldPath: 'src/utils.py', isBinary: false, language: 'python', isTest: false, isConfig: false, hunks: [], additions: [], deletions: [] },
            { newPath: 'src/helpers.py', status: 'added', oldPath: 'src/helpers.py', isBinary: false, language: 'python', isTest: false, isConfig: false, hunks: [], additions: [], deletions: [] },
            { newPath: 'src/config.py', status: 'added', oldPath: 'src/config.py', isBinary: false, language: 'python', isTest: false, isConfig: false, hunks: [], additions: [], deletions: [] },
            { newPath: 'src/app.py', status: 'added', oldPath: 'src/app.py', isBinary: false, language: 'python', isTest: false, isConfig: false, hunks: [], additions: [], deletions: [] },
          ],
          totalAdditions: 50,
          totalDeletions: 0,
          totalFilesChanged: 5,
          truncated: false,
        },
        config: createDefaultConfig({ checkLanguageMismatch: true }),
        octokit: mockOctokit as never,
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'language-mismatch');

      expect(signal).toBeDefined();
      expect(signal!.score).toBe(3);
      expect(signal!.confidence).toBe(0.7);
    });

    it('should NOT flag when added files match repo language', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            get: vi.fn().mockResolvedValue({
              data: { reactions: {} },
            }),
          },
          repos: {
            listLanguages: vi.fn().mockResolvedValue({
              data: { Python: 90000, Shell: 10000 },
            }),
          },
        },
      };
      const ctx = createMockPRContext({
        diff: {
          files: [
            { newPath: 'src/main.py', status: 'added', oldPath: 'src/main.py', isBinary: false, language: 'python', isTest: false, isConfig: false, hunks: [], additions: [], deletions: [] },
          ],
          totalAdditions: 10,
          totalDeletions: 0,
          totalFilesChanged: 1,
          truncated: false,
        },
        config: createDefaultConfig({ checkLanguageMismatch: true }),
        octokit: mockOctokit as never,
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'language-mismatch');

      expect(signal).toBeUndefined();
    });

    it('should NOT flag when minority of added files are foreign', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            get: vi.fn().mockResolvedValue({
              data: { reactions: {} },
            }),
          },
          repos: {
            listLanguages: vi.fn().mockResolvedValue({
              data: { TypeScript: 95000 },
            }),
          },
        },
      };
      const ctx = createMockPRContext({
        diff: {
          files: [
            { newPath: 'src/app.ts', status: 'added', oldPath: 'src/app.ts', isBinary: false, language: 'typescript', isTest: false, isConfig: false, hunks: [], additions: [], deletions: [] },
            { newPath: 'src/index.ts', status: 'added', oldPath: 'src/index.ts', isBinary: false, language: 'typescript', isTest: false, isConfig: false, hunks: [], additions: [], deletions: [] },
            { newPath: 'scripts/setup.py', status: 'added', oldPath: 'scripts/setup.py', isBinary: false, language: 'python', isTest: false, isConfig: false, hunks: [], additions: [], deletions: [] },
          ],
          totalAdditions: 30,
          totalDeletions: 0,
          totalFilesChanged: 3,
          truncated: false,
        },
        config: createDefaultConfig({ checkLanguageMismatch: true }),
        octokit: mockOctokit as never,
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'language-mismatch');

      expect(signal).toBeUndefined();
    });

    it('should skip when check-language-mismatch is false', async () => {
      const ctx = createMockPRContext({
        config: createDefaultConfig({ checkLanguageMismatch: false }),
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'language-mismatch');

      expect(signal).toBeUndefined();
    });

    it('should fail open when API call fails', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            get: vi.fn().mockResolvedValue({
              data: { reactions: {} },
            }),
          },
          repos: {
            listLanguages: vi.fn().mockRejectedValue(new Error('forbidden')),
          },
        },
      };
      const ctx = createMockPRContext({
        diff: {
          files: [
            { newPath: 'src/main.py', status: 'added', oldPath: 'src/main.py', isBinary: false, language: 'python', isTest: false, isConfig: false, hunks: [], additions: [], deletions: [] },
          ],
          totalAdditions: 10,
          totalDeletions: 0,
          totalFilesChanged: 1,
          truncated: false,
        },
        config: createDefaultConfig({ checkLanguageMismatch: true }),
        octokit: mockOctokit as never,
      });
      const signals = await analyzePrMetadata(ctx);
      const signal = signals.find((s) => s.id === 'language-mismatch');

      expect(signal).toBeUndefined();
    });
  });
});
