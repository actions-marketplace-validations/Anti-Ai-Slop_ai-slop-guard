import { describe, it, expect } from 'vitest';
import { analyzeIssueStackTrace } from '@/analyzers/issue-stacktrace';
import { createMockIssueContext } from '../../helpers';

describe('analyzeIssueStackTrace', () => {
  describe('hallucinated-file', () => {
    it('should flag when stack trace references files NOT in repoFiles', async () => {
      const ctx = createMockIssueContext({
        title: 'TypeError in authentication',
        body: [
          'Getting this error when logging in:',
          '',
          '```',
          'TypeError: Cannot read property "token" of undefined',
          '    at AuthService.validate (src/services/auth-service.ts:45:12)',
          '    at LoginController.handle (src/controllers/login-controller.ts:23:8)',
          '    at Router.dispatch (src/core/router.ts:112:5)',
          '```',
        ].join('\n'),
        repoFiles: [
          'src/services/user-service.ts',
          'src/controllers/home-controller.ts',
          'src/core/router.ts',
          'package.json',
          'tsconfig.json',
        ],
      });

      const signals = await analyzeIssueStackTrace(ctx);
      const signal = signals.find((s) => s.id === 'hallucinated-file');

      expect(signal).toBeDefined();
      expect(signal!.score).toBeGreaterThan(0);
    });

    it('should NOT flag when all stack trace files exist in repoFiles', async () => {
      const ctx = createMockIssueContext({
        title: 'TypeError in authentication',
        body: [
          'Getting this error when logging in:',
          '',
          '```',
          'TypeError: Cannot read property "token" of undefined',
          '    at AuthService.validate (src/services/auth-service.ts:45:12)',
          '    at LoginController.handle (src/controllers/login-controller.ts:23:8)',
          '```',
        ].join('\n'),
        repoFiles: [
          'src/services/auth-service.ts',
          'src/controllers/login-controller.ts',
          'src/core/router.ts',
          'package.json',
        ],
      });

      const signals = await analyzeIssueStackTrace(ctx);
      const signal = signals.find((s) => s.id === 'hallucinated-file');

      expect(signal).toBeUndefined();
    });
  });

  describe('no stack trace', () => {
    it('should return empty signals when no stack trace is present', async () => {
      const ctx = createMockIssueContext({
        title: 'Feature request: add dark mode',
        body: 'It would be nice to have a dark mode option. Many users have requested this.',
        repoFiles: [
          'src/app.ts',
          'src/theme.ts',
        ],
      });

      const signals = await analyzeIssueStackTrace(ctx);

      expect(signals).toEqual([]);
    });
  });
});
