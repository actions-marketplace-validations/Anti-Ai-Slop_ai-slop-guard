import { describe, it, expect } from 'vitest';
import { analyzePrDiff } from '@/analyzers/pr-diff';
import {
  createMockPRContext,
  createDiffFile,
  createEmptyDiff,
} from '../../helpers';

describe('analyzePrDiff', () => {
  describe('cosmetic-only-diff', () => {
    it('should flag when all changes are whitespace-only', async () => {
      const ctx = createMockPRContext({
        diff: createEmptyDiff({
          files: [
            createDiffFile({
              oldPath: 'src/app.ts',
              newPath: 'src/app.ts',
              status: 'modified',
              isConfig: false,
              isTest: false,
              additions: [
                { lineNumber: 10, content: '  const x = 1;' },
                { lineNumber: 11, content: '  const y = 2;' },
              ],
              deletions: [
                { lineNumber: 10, content: 'const x = 1;' },
                { lineNumber: 11, content: 'const y = 2;' },
              ],
            }),
          ],
          totalAdditions: 2,
          totalDeletions: 2,
          totalFilesChanged: 1,
        }),
      });

      const signals = await analyzePrDiff(ctx);
      const signal = signals.find((s) => s.id === 'cosmetic-only-diff');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when changes include functional modifications', async () => {
      const ctx = createMockPRContext({
        diff: createEmptyDiff({
          files: [
            createDiffFile({
              oldPath: 'src/app.ts',
              newPath: 'src/app.ts',
              status: 'modified',
              isConfig: false,
              isTest: false,
              additions: [
                { lineNumber: 10, content: 'const result = computeValue(x);' },
                { lineNumber: 11, content: 'logger.info(result);' },
              ],
              deletions: [
                { lineNumber: 10, content: 'const x = 1;' },
              ],
            }),
          ],
          totalAdditions: 2,
          totalDeletions: 1,
          totalFilesChanged: 1,
        }),
      });

      const signals = await analyzePrDiff(ctx);
      const signal = signals.find((s) => s.id === 'cosmetic-only-diff');

      expect(signal).toBeUndefined();
    });
  });

  describe('test-free-feature', () => {
    it('should flag when code files have >10 additions but no test files', async () => {
      const additions = Array.from({ length: 15 }, (_, i) => ({
        lineNumber: i + 1,
        content: `const line${i} = ${i};`,
      }));

      const ctx = createMockPRContext({
        diff: createEmptyDiff({
          files: [
            createDiffFile({
              oldPath: 'src/feature.ts',
              newPath: 'src/feature.ts',
              status: 'added',
              isConfig: false,
              isTest: false,
              additions,
              deletions: [],
            }),
          ],
          totalAdditions: 15,
          totalDeletions: 0,
          totalFilesChanged: 1,
        }),
      });

      const signals = await analyzePrDiff(ctx);
      const signal = signals.find((s) => s.id === 'test-free-feature');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when test files are present in the diff', async () => {
      const additions = Array.from({ length: 15 }, (_, i) => ({
        lineNumber: i + 1,
        content: `const line${i} = ${i};`,
      }));

      const testAdditions = Array.from({ length: 5 }, (_, i) => ({
        lineNumber: i + 1,
        content: `it('should work ${i}', () => { expect(true).toBe(true); });`,
      }));

      const ctx = createMockPRContext({
        diff: createEmptyDiff({
          files: [
            createDiffFile({
              oldPath: 'src/feature.ts',
              newPath: 'src/feature.ts',
              status: 'added',
              isConfig: false,
              isTest: false,
              additions,
              deletions: [],
            }),
            createDiffFile({
              oldPath: 'tests/feature.test.ts',
              newPath: 'tests/feature.test.ts',
              status: 'added',
              isConfig: false,
              isTest: true,
              additions: testAdditions,
              deletions: [],
            }),
          ],
          totalAdditions: 20,
          totalDeletions: 0,
          totalFilesChanged: 2,
        }),
      });

      const signals = await analyzePrDiff(ctx);
      const signal = signals.find((s) => s.id === 'test-free-feature');

      expect(signal).toBeUndefined();
    });
  });

  describe('high-comment-ratio', () => {
    it('should flag when >40% of added lines are comments', async () => {
      const additions = [
        { lineNumber: 1, content: '// This is a comment about the module' },
        { lineNumber: 2, content: '// Another comment explaining things' },
        { lineNumber: 3, content: '// Yet another comment line here' },
        { lineNumber: 4, content: '// More documentation comment' },
        { lineNumber: 5, content: '// Final comment for good measure' },
        { lineNumber: 6, content: '// Even more comments here' },
        { lineNumber: 7, content: '// And one more comment' },
        { lineNumber: 8, content: 'const x = 1;' },
        { lineNumber: 9, content: 'const y = 2;' },
        { lineNumber: 10, content: 'const z = 3;' },
        { lineNumber: 11, content: '// Comment at end' },
      ];

      const ctx = createMockPRContext({
        diff: createEmptyDiff({
          files: [
            createDiffFile({
              oldPath: 'src/utils.ts',
              newPath: 'src/utils.ts',
              status: 'modified',
              isConfig: false,
              isTest: false,
              additions,
              deletions: [],
            }),
          ],
          totalAdditions: 11,
          totalDeletions: 0,
          totalFilesChanged: 1,
        }),
      });

      const signals = await analyzePrDiff(ctx);
      const signal = signals.find((s) => s.id === 'high-comment-ratio');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when comment ratio is low', async () => {
      const additions = [
        { lineNumber: 1, content: '// A single comment' },
        { lineNumber: 2, content: 'const a = computeA();' },
        { lineNumber: 3, content: 'const b = computeB();' },
        { lineNumber: 4, content: 'const c = computeC();' },
        { lineNumber: 5, content: 'return a + b + c;' },
        { lineNumber: 6, content: 'export { computeAll };' },
        { lineNumber: 7, content: 'function computeAll() { return 0; }' },
        { lineNumber: 8, content: 'const d = computeD();' },
        { lineNumber: 9, content: 'const e = computeE();' },
        { lineNumber: 10, content: 'logger.info("done");' },
      ];

      const ctx = createMockPRContext({
        diff: createEmptyDiff({
          files: [
            createDiffFile({
              oldPath: 'src/utils.ts',
              newPath: 'src/utils.ts',
              status: 'modified',
              isConfig: false,
              isTest: false,
              additions,
              deletions: [],
            }),
          ],
          totalAdditions: 10,
          totalDeletions: 0,
          totalFilesChanged: 1,
        }),
      });

      const signals = await analyzePrDiff(ctx);
      const signal = signals.find((s) => s.id === 'high-comment-ratio');

      expect(signal).toBeUndefined();
    });
  });

  describe('suspicious-dependency', () => {
    it('should NOT flag version bumps or other non-dep package.json fields', async () => {
      const ctx = createMockPRContext({
        diff: createEmptyDiff({
          files: [
            createDiffFile({
              oldPath: 'package.json',
              newPath: 'package.json',
              status: 'modified',
              isConfig: true,
              isTest: false,
              additions: [
                { lineNumber: 3, content: '  "version": "0.3.0",' },
              ],
              deletions: [
                { lineNumber: 3, content: '  "version": "0.2.0",' },
              ],
            }),
            createDiffFile({
              oldPath: 'src/index.ts',
              newPath: 'src/index.ts',
              status: 'modified',
              isConfig: false,
              isTest: false,
              additions: [
                { lineNumber: 1, content: 'console.log("hello");' },
              ],
              deletions: [],
            }),
          ],
          totalAdditions: 2,
          totalDeletions: 1,
          totalFilesChanged: 2,
        }),
      });

      const signals = await analyzePrDiff(ctx);
      const signal = signals.find((s) => s.id === 'suspicious-dependency');

      expect(signal).toBeUndefined();
    });
  });

  describe('config-churn', () => {
    it('should flag when only config files are changed', async () => {
      const ctx = createMockPRContext({
        diff: createEmptyDiff({
          files: [
            createDiffFile({
              oldPath: 'tsconfig.json',
              newPath: 'tsconfig.json',
              status: 'modified',
              isConfig: true,
              isTest: false,
              additions: [
                { lineNumber: 5, content: '  "strict": true,' },
              ],
              deletions: [
                { lineNumber: 5, content: '  "strict": false,' },
              ],
            }),
            createDiffFile({
              oldPath: '.eslintrc.json',
              newPath: '.eslintrc.json',
              status: 'modified',
              isConfig: true,
              isTest: false,
              additions: [
                { lineNumber: 2, content: '  "semi": true,' },
              ],
              deletions: [
                { lineNumber: 2, content: '  "semi": false,' },
              ],
            }),
          ],
          totalAdditions: 2,
          totalDeletions: 2,
          totalFilesChanged: 2,
        }),
      });

      const signals = await analyzePrDiff(ctx);
      const signal = signals.find((s) => s.id === 'config-churn');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when non-config files are also changed', async () => {
      const ctx = createMockPRContext({
        diff: createEmptyDiff({
          files: [
            createDiffFile({
              oldPath: 'tsconfig.json',
              newPath: 'tsconfig.json',
              status: 'modified',
              isConfig: true,
              isTest: false,
              additions: [
                { lineNumber: 5, content: '  "strict": true,' },
              ],
              deletions: [
                { lineNumber: 5, content: '  "strict": false,' },
              ],
            }),
            createDiffFile({
              oldPath: 'src/feature.ts',
              newPath: 'src/feature.ts',
              status: 'modified',
              isConfig: false,
              isTest: false,
              additions: [
                { lineNumber: 1, content: 'export function newFeature() { return 42; }' },
              ],
              deletions: [],
            }),
          ],
          totalAdditions: 2,
          totalDeletions: 1,
          totalFilesChanged: 2,
        }),
      });

      const signals = await analyzePrDiff(ctx);
      const signal = signals.find((s) => s.id === 'config-churn');

      expect(signal).toBeUndefined();
    });
  });
});
