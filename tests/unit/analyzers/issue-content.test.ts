import { describe, it, expect } from 'vitest';
import { analyzeIssueContent } from '@/analyzers/issue-content';
import { createMockIssueContext } from '../../helpers';

describe('analyzeIssueContent', () => {
  describe('no-reproduction-steps', () => {
    it('should flag bug reports without reproduction steps', async () => {
      const ctx = createMockIssueContext({
        labels: ['bug'],
        title: 'Login page crashes',
        body: 'The login page crashes when I try to log in. It just shows a white screen. Please fix this.',
      });

      const signals = await analyzeIssueContent(ctx);
      const signal = signals.find((s) => s.id === 'no-reproduction-steps');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when reproduction steps are present', async () => {
      const ctx = createMockIssueContext({
        labels: ['bug'],
        title: 'Login page crashes',
        body: [
          'The login page crashes when I try to log in.',
          '',
          'Steps to reproduce:',
          '1. Go to /login',
          '2. Enter valid credentials',
          '3. Click "Sign In"',
          '4. Page crashes with white screen',
          '',
          'Expected: Should redirect to dashboard',
          'Actual: White screen',
        ].join('\n'),
      });

      const signals = await analyzeIssueContent(ctx);
      const signal = signals.find((s) => s.id === 'no-reproduction-steps');

      expect(signal).toBeUndefined();
    });

    it('should NOT flag non-bug issues without reproduction steps', async () => {
      const ctx = createMockIssueContext({
        labels: ['feature'],
        title: 'Add dark mode support',
        body: 'It would be great to have a dark mode option in the settings page.',
      });

      const signals = await analyzeIssueContent(ctx);
      const signal = signals.find((s) => s.id === 'no-reproduction-steps');

      expect(signal).toBeUndefined();
    });
  });

  describe('overly-formal-issue', () => {
    it('should flag overly formal text with 4+ fluff words in 50+ words', async () => {
      const ctx = createMockIssueContext({
        title: 'Enhancement Request for Authentication Module',
        body: 'I would like to respectfully submit this comprehensive enhancement request regarding the robust authentication module. This streamlined proposal leverages modern best practices to deliver a scalable and maintainable solution that will significantly enhance the overall user experience of the platform for all stakeholders involved in the process.',
      });

      const signals = await analyzeIssueContent(ctx);
      const signal = signals.find((s) => s.id === 'overly-formal-issue');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag conversational tone issue text', async () => {
      const ctx = createMockIssueContext({
        title: 'Dark mode is broken',
        body: 'Hey, the dark mode toggle stopped working after the last update. When I click it nothing happens. I checked the console and there are no errors. Running Chrome 120 on macOS.',
      });

      const signals = await analyzeIssueContent(ctx);
      const signal = signals.find((s) => s.id === 'overly-formal-issue');

      expect(signal).toBeUndefined();
    });
  });
});
