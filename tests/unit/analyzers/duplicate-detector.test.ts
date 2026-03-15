import { describe, it, expect } from 'vitest';
import { detectDuplicates } from '@/analyzers/duplicate-detector';
import { createMockIssueContext } from '../../helpers';

describe('detectDuplicates', () => {
  describe('duplicate-issue', () => {
    it('should flag when current issue is very similar to an existing issue', async () => {
      const ctx = createMockIssueContext({
        title: 'Login page crashes on submit',
        body: 'When I click the submit button on the login page, the application crashes with a white screen. This happens every time I try to log in with valid credentials.',
        existingIssues: [
          {
            number: 42,
            title: 'Login page crashes when submitting',
            body: 'When I click the submit button on the login page, the application crashes with a white screen. This happens every time I try to log in with valid credentials.',
          },
          {
            number: 10,
            title: 'Add dark mode support',
            body: 'It would be great to add a dark mode toggle in the settings.',
          },
        ],
      });

      const signals = await detectDuplicates(ctx);
      const signal = signals.find((s) => s.id === 'duplicate-issue');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when current issue is unique', async () => {
      const ctx = createMockIssueContext({
        title: 'Add support for WebSocket connections',
        body: 'We need real-time updates in the dashboard. WebSocket support would allow us to push notifications without polling.',
        existingIssues: [
          {
            number: 42,
            title: 'Login page crashes on submit',
            body: 'When I click the submit button on the login page, the application crashes with a white screen.',
          },
          {
            number: 10,
            title: 'Add dark mode support',
            body: 'It would be great to add a dark mode toggle in the settings.',
          },
        ],
      });

      const signals = await detectDuplicates(ctx);
      const signal = signals.find((s) => s.id === 'duplicate-issue');

      expect(signal).toBeUndefined();
    });
  });

  describe('no existing issues', () => {
    it('should return empty signals when there are no existing issues', async () => {
      const ctx = createMockIssueContext({
        title: 'First issue in the repo',
        body: 'This is the very first issue, so there is nothing to compare against.',
        existingIssues: [],
      });

      const signals = await detectDuplicates(ctx);

      expect(signals).toEqual([]);
    });
  });
});
