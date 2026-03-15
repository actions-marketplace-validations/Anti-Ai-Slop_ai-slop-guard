import { describe, it, expect, vi } from 'vitest';
import { runPrPipeline } from '@/analyzers/pr-pipeline';
import { runIssuePipeline } from '@/analyzers/issue-pipeline';
import { calculateSlopScore } from '@/scoring/calculator';
import {
  createMockPRContext,
  createMockIssueContext,
  createDiffFile,
  createEmptyDiff,
} from '../helpers';
import type { DiffLine } from '@/types';

vi.mock('@actions/core', () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
}));

describe('Full Pipeline Integration', () => {
  describe('PR pipeline', () => {
    it('produces clean verdict for a well-formed PR', async () => {
      const additions: DiffLine[] = [
        { lineNumber: 1, content: 'export function greet(name: string): string {' },
        { lineNumber: 2, content: '  return `Hello, ${name}`;' },
        { lineNumber: 3, content: '}' },
      ];
      const ctx = createMockPRContext({
        title: 'fix: handle null user in login flow',
        body: 'This fixes a crash when user is null because the API can return null on timeout. Fixes #42',
        diff: createEmptyDiff({
          files: [
            createDiffFile({ additions, deletions: [] }),
            createDiffFile({
              newPath: 'src/app.test.ts',
              oldPath: 'src/app.test.ts',
              isTest: true,
              additions: [{ lineNumber: 1, content: 'it("works", () => {})' }],
            }),
          ],
          totalAdditions: 4,
          totalDeletions: 0,
          totalFilesChanged: 2,
        }),
        commits: [
          { sha: 'a1', message: 'fix: handle null user in login flow', author: 'test-user' },
        ],
      });

      const signals = await runPrPipeline(ctx);
      const score = calculateSlopScore(signals, 6, 12);
      expect(score.verdict).toBe('clean');
    });

    it('detects slop in a cosmetic + fluff PR', async () => {
      // Cosmetic diff: additions and deletions have same trimmed content
      const makeCosmeticFile = (name: string) =>
        createDiffFile({
          newPath: name,
          oldPath: name,
          additions: [
            { lineNumber: 1, content: '  const x = 1;' },
            { lineNumber: 2, content: '  const y = 2;' },
          ],
          deletions: [
            { lineNumber: 1, content: 'const x = 1;' },
            { lineNumber: 2, content: 'const y = 2;' },
          ],
        });

      const ctx = createMockPRContext({
        title: 'This PR enhances the comprehensive authentication system',
        body: 'This PR implements a comprehensive, robust, and streamlined refactoring. The elegant solution leverages cutting-edge patterns to ensure seamless integration and holistic improvements.',
        diff: createEmptyDiff({
          files: [
            makeCosmeticFile('src/a.ts'),
            makeCosmeticFile('src/b.ts'),
          ],
          totalAdditions: 4,
          totalDeletions: 4,
          totalFilesChanged: 2,
        }),
        commits: [
          { sha: 'a1', message: 'update', author: 'test-user' },
        ],
      });

      const signals = await runPrPipeline(ctx);
      calculateSlopScore(signals, 6, 12);

      expect(signals.length).toBeGreaterThan(0);
      const ids = signals.map((s) => s.id);
      // Should catch at least fluff language and generic commit
      expect(ids.some((id) => ['ai-fluff-language', 'cosmetic-only-diff', 'generic-commit-msg'].includes(id))).toBe(true);
    });
  });

  describe('Issue pipeline', () => {
    it('produces clean verdict for a well-formed issue', async () => {
      const ctx = createMockIssueContext({
        title: 'Login form validation error',
        body: 'Steps to reproduce:\n1. Go to /login\n2. Enter email\n3. Leave password empty\n4. Click Submit\n\nExpected: error message\nActual: 500 error',
        labels: ['bug'],
      });

      const signals = await runIssuePipeline(ctx);
      const score = calculateSlopScore(signals, 6, 12);
      expect(score.verdict).toBe('clean');
    });

    it('detects hallucinated stack trace', async () => {
      const ctx = createMockIssueContext({
        title: 'App crashes on startup',
        body: 'The app crashes:\n\n```\nTraceback (most recent call last):\n  File "src/core/initializer.py", line 245, in bootstrap\n    config = load_config()\n  File "src/utils/config_loader.py", line 89, in load_config\n    return parse(path)\n```\n\nPlease fix.',
        labels: ['bug'],
        repoFiles: ['src/app.py', 'src/utils.py', 'README.md'],
      });

      const signals = await runIssuePipeline(ctx);
      expect(signals.length).toBeGreaterThan(0);
      const ids = signals.map((s) => s.id);
      expect(ids).toContain('hallucinated-file');
    });
  });
});
