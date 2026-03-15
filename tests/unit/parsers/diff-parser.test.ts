import { describe, it, expect } from 'vitest';
import { parseDiff } from '@/parsers/diff-parser';

describe('parseDiff', () => {
  describe('simple single-file diff', () => {
    it('should parse additions and deletions from a single file', () => {
      const raw = [
        'diff --git a/src/index.ts b/src/index.ts',
        'index abc1234..def5678 100644',
        '--- a/src/index.ts',
        '+++ b/src/index.ts',
        '@@ -1,5 +1,6 @@',
        ' import { run } from "./run";',
        ' ',
        '-const old = true;',
        '+const updated = true;',
        '+const extra = false;',
        ' ',
        ' run();',
      ].join('\n');

      const result = parseDiff(raw);

      expect(result.totalFilesChanged).toBe(1);
      expect(result.totalAdditions).toBe(2);
      expect(result.totalDeletions).toBe(1);
      expect(result.files).toHaveLength(1);

      const file = result.files[0]!;
      expect(file.oldPath).toBe('src/index.ts');
      expect(file.newPath).toBe('src/index.ts');
      expect(file.additions).toHaveLength(2);
      expect(file.deletions).toHaveLength(1);
      expect(file.hunks).toHaveLength(1);
      expect(file.isBinary).toBe(false);
    });
  });

  describe('multi-file diff', () => {
    it('should parse multiple files and sum totals correctly', () => {
      const raw = [
        'diff --git a/src/a.ts b/src/a.ts',
        '--- a/src/a.ts',
        '+++ b/src/a.ts',
        '@@ -1,3 +1,4 @@',
        ' line1',
        '+added in a',
        ' line2',
        ' line3',
        'diff --git a/src/b.ts b/src/b.ts',
        '--- a/src/b.ts',
        '+++ b/src/b.ts',
        '@@ -1,4 +1,3 @@',
        ' line1',
        '-removed in b',
        ' line2',
        ' line3',
      ].join('\n');

      const result = parseDiff(raw);

      expect(result.totalFilesChanged).toBe(2);
      expect(result.totalAdditions).toBe(1);
      expect(result.totalDeletions).toBe(1);
      expect(result.files).toHaveLength(2);
      expect(result.files[0]!.newPath).toBe('src/a.ts');
      expect(result.files[1]!.newPath).toBe('src/b.ts');
    });
  });

  describe('renamed files', () => {
    it('should detect rename status', () => {
      const raw = [
        'diff --git a/old-name.ts b/new-name.ts',
        'similarity index 95%',
        'rename from old-name.ts',
        'rename to new-name.ts',
        '--- a/old-name.ts',
        '+++ b/new-name.ts',
        '@@ -1,3 +1,3 @@',
        ' const a = 1;',
        '-const b = 2;',
        '+const b = 3;',
      ].join('\n');

      const result = parseDiff(raw);
      const file = result.files[0]!;
      expect(file.oldPath).toBe('old-name.ts');
      expect(file.newPath).toBe('new-name.ts');
      expect(file.status).toBe('renamed');
    });
  });

  describe('binary files', () => {
    it('should mark binary files', () => {
      const raw = [
        'diff --git a/image.png b/image.png',
        'Binary files /dev/null and b/image.png differ',
      ].join('\n');

      const result = parseDiff(raw);
      const file = result.files[0]!;
      expect(file.isBinary).toBe(true);
      expect(file.hunks).toHaveLength(0);
    });
  });

  describe('added files', () => {
    it('should detect added status when old path is /dev/null', () => {
      const raw = [
        'diff --git a/src/new.ts b/src/new.ts',
        '--- /dev/null',
        '+++ b/src/new.ts',
        '@@ -0,0 +1,2 @@',
        '+export const a = 1;',
        '+export const b = 2;',
      ].join('\n');

      const result = parseDiff(raw);
      const file = result.files[0]!;
      expect(file.status).toBe('added');
      expect(file.additions).toHaveLength(2);
    });
  });

  describe('deleted files', () => {
    it('should detect deleted status when new path is /dev/null', () => {
      const raw = [
        'diff --git a/src/old.ts b/src/old.ts',
        '--- a/src/old.ts',
        '+++ /dev/null',
        '@@ -1,2 +0,0 @@',
        '-export const a = 1;',
        '-export const b = 2;',
      ].join('\n');

      const result = parseDiff(raw);
      const file = result.files[0]!;
      expect(file.status).toBe('deleted');
      expect(file.deletions).toHaveLength(2);
    });
  });

  describe('empty diff', () => {
    it('should return empty DiffData for empty string', () => {
      const result = parseDiff('');
      expect(result.files).toHaveLength(0);
      expect(result.totalAdditions).toBe(0);
      expect(result.totalDeletions).toBe(0);
      expect(result.truncated).toBe(false);
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript', () => {
      const raw = 'diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1,1 +1,1 @@\n-a\n+b';
      expect(parseDiff(raw).files[0]!.language).toBe('typescript');
    });

    it('should detect Python', () => {
      const raw = 'diff --git a/main.py b/main.py\n--- a/main.py\n+++ b/main.py\n@@ -1,1 +1,1 @@\n-a\n+b';
      expect(parseDiff(raw).files[0]!.language).toBe('python');
    });
  });

  describe('test file detection', () => {
    it('should flag .test.ts as test file', () => {
      const raw = 'diff --git a/app.test.ts b/app.test.ts\n--- a/app.test.ts\n+++ b/app.test.ts\n@@ -1,1 +1,1 @@\n-a\n+b';
      expect(parseDiff(raw).files[0]!.isTest).toBe(true);
    });

    it('should not flag regular source as test file', () => {
      const raw = 'diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1,1 +1,1 @@\n-a\n+b';
      expect(parseDiff(raw).files[0]!.isTest).toBe(false);
    });
  });

  describe('config file detection', () => {
    it('should flag package.json as config', () => {
      const raw = 'diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -1,1 +1,1 @@\n-a\n+b';
      expect(parseDiff(raw).files[0]!.isConfig).toBe(true);
    });
  });
});
