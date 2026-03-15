import { describe, it, expect } from 'vitest';
import { analyzePrDescription } from '@/analyzers/pr-description';
import { createMockPRContext, createEmptyDiff } from '../../helpers';

describe('analyzePrDescription', () => {
  describe('ai-fluff-language', () => {
    it('should flag when body contains 3+ AI fluff words', async () => {
      const ctx = createMockPRContext({
        body: 'This comprehensive PR provides a robust and streamlined approach to leverage modern patterns for the authentication module.',
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'ai-fluff-language');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when body contains 0-1 fluff words', async () => {
      const ctx = createMockPRContext({
        body: 'This PR fixes the login bug by adding null checks to the auth handler. Tested locally and all tests pass.',
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'ai-fluff-language');

      expect(signal).toBeUndefined();
    });
  });

  describe('missing-why', () => {
    it('should flag when body describes what but not why', async () => {
      const ctx = createMockPRContext({
        body: 'This PR updates the login flow and refactors the authentication middleware. The session handling has been modified to use cookies.',
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'missing-why');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when body contains "because"', async () => {
      const ctx = createMockPRContext({
        body: 'This PR updates the login flow because the previous implementation was leaking session tokens on redirect.',
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'missing-why');

      expect(signal).toBeUndefined();
    });

    it('should NOT flag when body contains "fixes #"', async () => {
      const ctx = createMockPRContext({
        body: 'This PR updates the login flow. Fixes #123.',
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'missing-why');

      expect(signal).toBeUndefined();
    });
  });

  describe('emoji-abuse', () => {
    it('should flag when body contains 5+ emoji', async () => {
      const ctx = createMockPRContext({
        body: 'Added new feature! \u{1F680}\u{1F389}\u2728\u{1F525}\u{1F4AF}\u{1F60D} This is going to be amazing for users!',
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'emoji-abuse');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when body contains fewer than 5 emoji', async () => {
      const ctx = createMockPRContext({
        body: 'Fixed the login bug \u{1F41B}. Now redirects work correctly \u2705.',
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'emoji-abuse');

      expect(signal).toBeUndefined();
    });
  });

  describe('bullet-vomit', () => {
    it('should flag when body contains 8+ consecutive bullet points', async () => {
      const ctx = createMockPRContext({
        body: [
          'Changes made:',
          '- Updated the auth module',
          '- Refactored session handling',
          '- Added cookie support',
          '- Fixed redirect logic',
          '- Updated tests',
          '- Added new middleware',
          '- Modified config files',
          '- Updated documentation',
          '- Fixed linting errors',
        ].join('\n'),
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'bullet-vomit');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when body contains 3-4 bullet points', async () => {
      const ctx = createMockPRContext({
        body: [
          'Changes:',
          '- Fixed the redirect bug',
          '- Added a test for the fix',
          '- Updated the changelog',
        ].join('\n'),
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'bullet-vomit');

      expect(signal).toBeUndefined();
    });
  });

  describe('self-praise', () => {
    it('should flag when body contains self-praising phrases', async () => {
      const ctx = createMockPRContext({
        body: 'This PR introduces an elegant solution for the caching problem. The clean implementation follows best practices.',
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'self-praise');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when body uses neutral language', async () => {
      const ctx = createMockPRContext({
        body: 'This PR fixes the caching bug by invalidating stale entries on write. See the linked issue for more context.',
        diff: createEmptyDiff(),
      });

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'self-praise');

      expect(signal).toBeUndefined();
    });
  });

  describe('over-explained', () => {
    it('should flag when body exceeds 800 characters', async () => {
      const longBody = 'This PR updates the authentication system. '.repeat(30);

      const ctx = createMockPRContext({
        body: longBody,
        diff: createEmptyDiff(),
      });

      expect(longBody.length).toBeGreaterThan(800);

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'over-explained');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when body is 800 characters or less', async () => {
      const shortBody = 'This PR fixes a small bug in the login handler. Tested locally.';

      const ctx = createMockPRContext({
        body: shortBody,
        diff: createEmptyDiff(),
      });

      expect(shortBody.length).toBeLessThanOrEqual(800);

      const signals = await analyzePrDescription(ctx);
      const signal = signals.find((s) => s.id === 'over-explained');

      expect(signal).toBeUndefined();
    });
  });
});
