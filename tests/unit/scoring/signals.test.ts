import { describe, it, expect } from 'vitest';
import { getAllSignals, SIGNALS } from '@/scoring/signals';
import type { SignalCategory } from '@/types';

const VALID_CATEGORIES: SignalCategory[] = [
  'diff-structure',
  'diff-quality',
  'description',
  'commits',
  'stacktrace',
  'duplicate',
  'semantic',
];

describe('signal registry', () => {
  describe('getAllSignals', () => {
    it('returns all 28 registered signals', () => {
      expect(getAllSignals()).toHaveLength(28);
    });

    it('returns signals with unique IDs', () => {
      const ids = getAllSignals().map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every signal has a valid category', () => {
      for (const signal of getAllSignals()) {
        expect(VALID_CATEGORIES).toContain(signal.category);
      }
    });

    it('every signal has defaultScore between 0 and 5', () => {
      for (const signal of getAllSignals()) {
        expect(signal.defaultScore).toBeGreaterThanOrEqual(0);
        expect(signal.defaultScore).toBeLessThanOrEqual(5);
      }
    });

    it('every signal has a non-empty kebab-case id', () => {
      for (const signal of getAllSignals()) {
        expect(signal.id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
      }
    });

    it('every signal has a non-empty description', () => {
      for (const signal of getAllSignals()) {
        expect(signal.description.length).toBeGreaterThan(5);
      }
    });
  });

  describe('SIGNALS constant', () => {
    it('has the expected PR diff-structure keys', () => {
      const keys = ['COSMETIC_ONLY_DIFF', 'MASSIVE_UNFOCUSED_DIFF', 'DEAD_CODE_INJECTION', 'IMPORT_TSUNAMI', 'SUSPICIOUS_DEPENDENCY', 'CONFIG_CHURN'];
      for (const key of keys) {
        expect(SIGNALS).toHaveProperty(key);
      }
    });

    it('has the expected PR diff-quality keys', () => {
      const keys = ['TEST_FREE_FEATURE', 'INCONSISTENT_STYLE', 'DUPLICATE_CODE_IN_DIFF', 'HIGH_COMMENT_RATIO'];
      for (const key of keys) {
        expect(SIGNALS).toHaveProperty(key);
      }
    });

    it('has the expected PR description keys', () => {
      const keys = ['AI_FLUFF_LANGUAGE', 'MISSING_WHY', 'TEMPLATE_IGNORED', 'OVER_EXPLAINED', 'EMOJI_ABUSE', 'BULLET_VOMIT', 'SELF_PRAISE'];
      for (const key of keys) {
        expect(SIGNALS).toHaveProperty(key);
      }
    });

    it('has the expected PR commits keys', () => {
      const keys = ['GENERIC_COMMIT_MSG', 'SINGLE_COMMIT_DUMP', 'AUTHOR_MISMATCH'];
      for (const key of keys) {
        expect(SIGNALS).toHaveProperty(key);
      }
    });

    it('has the expected issue and semantic keys', () => {
      const keys = ['HALLUCINATED_FILE', 'HALLUCINATED_FUNCTION', 'HALLUCINATED_LINE', 'NO_REPRODUCTION_STEPS', 'VERSION_MISMATCH', 'OVERLY_FORMAL_ISSUE', 'DUPLICATE_ISSUE', 'NO_FUNCTIONAL_VALUE'];
      for (const key of keys) {
        expect(SIGNALS).toHaveProperty(key);
      }
    });
  });
});
