import { testPR, testIssue } from './harness';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

interface TestCase {
  name: string;
  run: () => Promise<{
    score: { total: number; verdict: string; signals: readonly any[] };
    comment: string;
    wouldLabel: boolean;
    wouldClose: boolean;
    duration: number;
  }>;
  expect: {
    verdict: 'clean' | 'suspicious' | 'likely-slop';
    shouldContainSignals?: string[];
    shouldNotContainSignals?: string[];
    minScore?: number;
    maxScore?: number;
    commentMustNotContain?: string[];
    commentMustContain?: string[];
  };
}

async function runTest(tc: TestCase): Promise<boolean> {
  try {
    const result = await tc.run();
    const errors: string[] = [];

    // Check verdict
    if (result.score.verdict !== tc.expect.verdict) {
      errors.push(`Verdict: got "${result.score.verdict}", expected "${tc.expect.verdict}"`);
    }

    // Check signals present
    const signalIds = result.score.signals.map((s: any) => s.id);
    for (const sid of tc.expect.shouldContainSignals ?? []) {
      if (!signalIds.includes(sid)) {
        errors.push(`Missing signal: "${sid}"`);
      }
    }

    // Check signals absent
    for (const sid of tc.expect.shouldNotContainSignals ?? []) {
      if (signalIds.includes(sid)) {
        errors.push(`Unexpected signal: "${sid}" should not be present`);
      }
    }

    // Check score range
    if (tc.expect.minScore !== undefined && result.score.total < tc.expect.minScore) {
      errors.push(`Score too low: ${result.score.total} < ${tc.expect.minScore}`);
    }
    if (tc.expect.maxScore !== undefined && result.score.total > tc.expect.maxScore) {
      errors.push(`Score too high: ${result.score.total} > ${tc.expect.maxScore}`);
    }

    // Check comment content
    for (const text of tc.expect.commentMustNotContain ?? []) {
      const regex = new RegExp(`(?<!ai-slop-guard.{0,20})(?<!-)\\b${text}\\b`, 'i');
      if (regex.test(result.comment)) {
        errors.push(`Comment contains forbidden text: "${text}"`);
      }
    }
    for (const text of tc.expect.commentMustContain ?? []) {
      if (!result.comment.toLowerCase().includes(text.toLowerCase())) {
        errors.push(`Comment missing required text: "${text}"`);
      }
    }

    if (errors.length === 0) {
      console.log(`  ${GREEN}✓${RESET} ${tc.name} ${DIM}(${result.duration}ms, score: ${result.score.total}, verdict: ${result.score.verdict})${RESET}`);
      return true;
    } else {
      console.log(`  ${RED}✗${RESET} ${tc.name}`);
      for (const e of errors) {
        console.log(`    ${RED}→ ${e}${RESET}`);
      }
      console.log(`    ${DIM}Signals: [${signalIds.join(', ')}]${RESET}`);
      console.log(`    ${DIM}Score: ${result.score.total}, Verdict: ${result.score.verdict}${RESET}`);
      if (result.comment) {
        console.log(`    ${DIM}Comment (first 200ch): ${result.comment.slice(0, 200).replace(/\n/g, '\\n')}${RESET}`);
      }
      return false;
    }
  } catch (err) {
    console.log(`  ${RED}✗${RESET} ${tc.name}`);
    console.log(`    ${RED}→ CRASHED: ${err instanceof Error ? err.message : String(err)}${RESET}`);
    if (err instanceof Error && err.stack) {
      console.log(`    ${DIM}${err.stack.split('\n').slice(1, 4).join('\n    ')}${RESET}`);
    }
    return false;
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

// ── GRUPPO 1: PR SLOP — devono essere flaggate ──

const SLOP_PR_TESTS: TestCase[] = [

  // TEST 1: Il classico AI dump cosmetico
  {
    name: 'PR cosmetica — solo whitespace e formatting',
    run: () => testPR({
      title: 'Fix formatting',
      body: 'This PR fixes the indentation across multiple files for better readability.',
      author: 'random-user-42',
      commits: [{ message: 'fix formatting', author: 'random-user-42' }],
      diff: `diff --git a/src/app.ts b/src/app.ts
index abc1234..def5678 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,8 +1,8 @@
-function main() {
-  const x = 1;
-  const y = 2;
-  return x + y;
-}
+function main() {
+    const x = 1;
+    const y = 2;
+    return x + y;
+}
diff --git a/src/utils.ts b/src/utils.ts
index 111..222 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,4 +1,4 @@
-export function helper() {
-  return true;
-}
+export function helper() {
+    return true;
+}`,
    }),
    expect: {
      verdict: 'suspicious',
      shouldContainSignals: ['cosmetic-only-diff'],
      shouldNotContainSignals: ['hallucinated-file'],
    },
  },

  // TEST 2: AI fluff description + generic commits
  {
    name: 'PR con descrizione AI tipica e commit generici',
    run: () => testPR({
      title: 'Enhance authentication module',
      body: `This pull request introduces a comprehensive enhancement to the authentication module, leveraging industry best practices to streamline the login flow. The implementation utilizes a robust and elegant approach that fosters seamless user experience.

### Changes
- Enhanced the authentication flow
- Improved error handling
- Updated dependencies
- Refactored codebase for better maintainability
- Added comprehensive logging
- Streamlined the validation process
- Optimized database queries
- Updated configuration files
- Fixed edge cases`,
      author: 'ai-coder-123',
      commits: [
        { message: 'improve auth', author: 'ai-coder-123' },
        { message: 'update code', author: 'ai-coder-123' },
      ],
      diff: `diff --git a/src/auth.ts b/src/auth.ts
index abc..def 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,5 +1,15 @@
+import { Logger } from './logger';
+import { Validator } from './validator';
+import { Config } from './config';
+import { ErrorHandler } from './error-handler';
+import { Analytics } from './analytics';
+import { Cache } from './cache';
+import { Metrics } from './metrics';
+import { Tracer } from './tracer';
+import { RateLimiter } from './rate-limiter';
+import { Sanitizer } from './sanitizer';
 export function login(user: string, pass: string) {
-  return db.check(user, pass);
+  return db.check(user, pass);
 }`,
    }),
    expect: {
      verdict: 'suspicious',
      shouldContainSignals: ['ai-fluff-language', 'bullet-vomit', 'generic-commit-msg', 'import-tsunami'],
      minScore: 6,
    },
  },

  // TEST 3: Dump enorme senza test
  {
    name: 'PR massiccia senza test — 600+ righe, 12 file, zero test',
    run: () => {
      let diff = '';
      for (let i = 0; i < 12; i++) {
        diff += `diff --git a/src/module${i}.ts b/src/module${i}.ts\nindex abc..def 100644\n--- a/src/module${i}.ts\n+++ b/src/module${i}.ts\n@@ -0,0 +1,50 @@\n`;
        for (let j = 0; j < 50; j++) {
          diff += `+export function generatedFunc${i}_${j}() { return ${j}; }\n`;
        }
      }
      return testPR({
        title: 'Add new modules',
        body: 'Added several new modules.',
        author: 'bulk-contributor',
        commits: [{ message: 'add modules', author: 'bulk-contributor' }],
        diff,
      });
    },
    expect: {
      verdict: 'suspicious',
      shouldContainSignals: ['massive-unfocused-diff', 'test-free-feature', 'single-commit-dump'],
      minScore: 6,
    },
  },

  // TEST 4: PR con self-praise e missing-why
  {
    name: 'PR con self-praise e nessuna motivazione',
    run: () => testPR({
      title: 'Refactor database layer',
      body: 'This PR implements an elegant solution for the database layer using a modern approach. The clean implementation provides an efficient design pattern that results in a well-structured and maintainable architecture.',
      author: 'self-praiser',
      commits: [{ message: 'refactor db', author: 'self-praiser' }],
      diff: `diff --git a/src/db.ts b/src/db.ts
index abc..def 100644
--- a/src/db.ts
+++ b/src/db.ts
@@ -1,3 +1,5 @@
-export const db = { query: (sql: string) => [] };
+export class Database {
+  query(sql: string) { return []; }
+  close() { }
+}`,
    }),
    expect: {
      verdict: 'suspicious',
      shouldContainSignals: ['self-praise', 'missing-why'],
    },
  },

  // TEST 5: PR SLOP GRAVE — score alto, dovrebbe chiudere
  {
    name: 'PR slop pesante — cosmetic + fluff + bullets + emoji + generic commit + no test',
    run: () => {
      let diff = '';
      for (let i = 0; i < 8; i++) {
        diff += `diff --git a/src/file${i}.ts b/src/file${i}.ts\nindex abc..def 100644\n--- a/src/file${i}.ts\n+++ b/src/file${i}.ts\n@@ -1,3 +1,3 @@\n-  const x = 1;\n+    const x = 1;\n`;
      }
      // Add file with code to avoid pure cosmetic
      diff += `diff --git a/src/new.ts b/src/new.ts\nindex 000..abc 100644\n--- /dev/null\n+++ b/src/new.ts\n@@ -0,0 +1,20 @@\n`;
      for (let j = 0; j < 20; j++) {
        diff += `+// This is a comprehensive helper function\n`;
      }

      return testPR({
        title: 'Enhance codebase',
        body: `🚀✨🎉💪🔥🎯 This pull request introduces comprehensive enhancements that leverage cutting-edge patterns to streamline our codebase!

- Enhanced the core module for better performance
- Leveraged modern patterns for seamless integration
- Streamlined the build pipeline for robust output
- Utilized best practices for holistic architecture
- Improved code quality with elegant solutions
- Added comprehensive error handling
- Fostered better maintainability
- Empowered the development workflow
- Elevated the codebase quality`,
        author: 'slop-machine',
        commits: [{ message: 'update', author: 'slop-machine' }],
        diff,
      });
    },
    expect: {
      verdict: 'likely-slop',
      shouldContainSignals: ['ai-fluff-language', 'bullet-vomit', 'emoji-abuse', 'generic-commit-msg'],
      minScore: 12,
    },
  },
];

// ── GRUPPO 2: PR LEGITTIME — NON devono essere flaggate ──

const LEGIT_PR_TESTS: TestCase[] = [

  // TEST 6: Bugfix pulito con issue linkata
  {
    name: 'Bugfix pulito — piccolo, motivato, con test',
    run: () => testPR({
      title: 'Fix null pointer in auth handler',
      body: 'Fixes #142. The `validateToken` function crashes when the token is undefined because we access `.length` without null check. Added guard clause and test.',
      author: 'good-contributor',
      commits: [
        { message: 'fix: guard against null token in validateToken', author: 'good-contributor' },
        { message: 'test: add test for null token edge case', author: 'good-contributor' },
      ],
      diff: `diff --git a/src/auth.ts b/src/auth.ts
index abc..def 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,6 +10,8 @@ export function validateToken(token: string | undefined): boolean {
+  if (!token) {
+    return false;
+  }
   return token.length > 0 && token.startsWith('Bearer ');
 }
diff --git a/tests/auth.test.ts b/tests/auth.test.ts
index abc..def 100644
--- a/tests/auth.test.ts
+++ b/tests/auth.test.ts
@@ -15,6 +15,12 @@ describe('validateToken', () => {
+  it('should return false for undefined token', () => {
+    expect(validateToken(undefined)).toBe(false);
+  });
+
+  it('should return false for empty token', () => {
+    expect(validateToken('')).toBe(false);
+  });
 });`,
    }),
    expect: {
      verdict: 'clean',
      shouldNotContainSignals: ['ai-fluff-language', 'cosmetic-only-diff', 'missing-why', 'test-free-feature'],
      maxScore: 5,
    },
  },

  // TEST 7: Feature legittima ben strutturata
  {
    name: 'Feature legittima — buona descrizione, test inclusi, commit specifici',
    run: () => testPR({
      title: 'Add rate limiting to API endpoints',
      body: `Rate limiting is needed because our /api/search endpoint gets hammered by bots (see #203). This adds a simple token bucket limiter.

## What changed
- New \`RateLimiter\` class in \`src/middleware/\`
- Applied to all /api/ routes
- Configurable via \`RATE_LIMIT_RPM\` env var (default: 60)

## Testing
- Unit tests for token bucket logic
- Integration test hitting the endpoint 100 times`,
      author: 'senior-dev',
      commits: [
        { message: 'feat: add RateLimiter class with token bucket algorithm', author: 'senior-dev' },
        { message: 'feat: apply rate limiter middleware to API routes', author: 'senior-dev' },
        { message: 'test: add rate limiter unit and integration tests', author: 'senior-dev' },
      ],
      diff: `diff --git a/src/middleware/rate-limiter.ts b/src/middleware/rate-limiter.ts
new file mode 100644
index 000..abc 100644
--- /dev/null
+++ b/src/middleware/rate-limiter.ts
@@ -0,0 +1,30 @@
+export class RateLimiter {
+  private tokens: number;
+  private lastRefill: number;
+
+  constructor(private readonly maxTokens: number, private readonly refillRateMs: number) {
+    this.tokens = maxTokens;
+    this.lastRefill = Date.now();
+  }
+
+  tryConsume(): boolean {
+    this.refill();
+    if (this.tokens > 0) {
+      this.tokens--;
+      return true;
+    }
+    return false;
+  }
+
+  private refill() {
+    const now = Date.now();
+    const elapsed = now - this.lastRefill;
+    const newTokens = Math.floor(elapsed / this.refillRateMs);
+    if (newTokens > 0) {
+      this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
+      this.lastRefill = now;
+    }
+  }
+}
diff --git a/tests/rate-limiter.test.ts b/tests/rate-limiter.test.ts
new file mode 100644
index 000..abc 100644
--- /dev/null
+++ b/tests/rate-limiter.test.ts
@@ -0,0 +1,15 @@
+import { RateLimiter } from '../src/middleware/rate-limiter';
+
+describe('RateLimiter', () => {
+  it('should allow requests within limit', () => {
+    const limiter = new RateLimiter(5, 1000);
+    for (let i = 0; i < 5; i++) {
+      expect(limiter.tryConsume()).toBe(true);
+    }
+  });
+
+  it('should deny requests over limit', () => {
+    const limiter = new RateLimiter(1, 60000);
+    limiter.tryConsume();
+    expect(limiter.tryConsume()).toBe(false);
+  });
+});`,
    }),
    expect: {
      verdict: 'clean',
      maxScore: 3,
    },
  },

  // TEST 8: PR Dependabot (deve passare sempre)
  {
    name: 'PR Dependabot — deve essere exempted',
    run: () => testPR({
      title: 'Bump typescript from 5.6.0 to 5.7.0',
      body: 'Bumps typescript from 5.6.0 to 5.7.0.',
      author: 'dependabot[bot]',
      commits: [{ message: 'chore(deps): bump typescript', author: 'dependabot[bot]' }],
      diff: `diff --git a/package.json b/package.json
index abc..def 100644
--- a/package.json
+++ b/package.json
@@ -5,7 +5,7 @@
-    "typescript": "^5.6.0"
+    "typescript": "^5.7.0"`,
    }),
    expect: {
      verdict: 'clean',
      maxScore: 0,
    },
  },
];

// ── GRUPPO 3: ISSUE SLOP — devono essere flaggate ──

const SLOP_ISSUE_TESTS: TestCase[] = [

  // TEST 9: Issue con stack trace inventato
  {
    name: 'Issue con file inesistente nello stack trace',
    run: () => testIssue(
      {
        title: 'App crashes on startup',
        body: `The app crashes when I start it.

\`\`\`
Error: Cannot read property 'length' of undefined
    at validateInput (/src/nonexistent-module.ts:42:15)
    at processRequest (/src/fake-handler.ts:108:3)
    at Object.<anonymous> (/src/app.ts:5)
\`\`\`

Please fix this.`,
        author: 'ai-reporter',
      },
      ['src/app.ts', 'src/auth.ts', 'src/utils.ts', 'tests/app.test.ts'],
    ),
    expect: {
      verdict: 'suspicious',
      shouldContainSignals: ['hallucinated-file'],
      minScore: 5,
    },
  },

  // TEST 10: Bug report senza reproduction steps
  {
    name: 'Bug report senza step di riproduzione — tono formale',
    run: () => testIssue(
      {
        title: 'Critical security vulnerability detected',
        body: `Dear Maintainers,

I would like to bring to your attention a critical security vulnerability that has been identified within your esteemed software project. This issue represents a significant concern for the overall security posture of the application and warrants immediate remediation.

The vulnerability pertains to the authentication mechanism, which could potentially be exploited by malicious actors to gain unauthorized access to sensitive user data. It is imperative that this matter be addressed with the utmost urgency.

Thank you for your attention to this matter. I look forward to your prompt response.

Best regards,
Security Researcher`,
        author: 'formal-reporter',
        labels: ['bug'],
      },
      ['src/app.ts', 'src/auth.ts'],
    ),
    expect: {
      verdict: 'suspicious',
      shouldContainSignals: ['no-reproduction-steps', 'overly-formal-issue'],
      minScore: 4,
    },
  },

  // TEST 11: Issue slop combinata
  {
    name: 'Issue slop completa — hallucinated trace + no repro + formal + should close',
    run: () => testIssue(
      {
        title: 'Application encounters a fatal exception during initialization',
        body: `Dear Development Team,

I have identified a critical runtime exception that occurs during the initialization phase of your application. The error manifests as follows:

\`\`\`
Traceback (most recent call last):
  File "/src/initialization/bootstrap_manager.py", line 287, in initialize_core_services
    service_registry.register_all(config.get_services())
  File "/src/services/registry_handler.py", line 142, in register_all
    self._validate_service_dependencies(service)
  File "/src/validation/dependency_checker.py", line 89, in _validate_service_dependencies
    raise DependencyResolutionError(f"Circular dependency detected: {chain}")
DependencyResolutionError: Circular dependency detected: ServiceA -> ServiceB -> ServiceA
\`\`\`

This represents a significant architectural concern that could potentially impact the stability and reliability of the entire application ecosystem. I would strongly recommend implementing a comprehensive dependency resolution mechanism that leverages topological sorting.

Best regards`,
        author: 'hallucinator',
        labels: ['bug'],
      },
      ['src/app.py', 'src/main.py', 'requirements.txt'],
    ),
    expect: {
      verdict: 'likely-slop',
      shouldContainSignals: ['hallucinated-file', 'no-reproduction-steps', 'overly-formal-issue'],
      minScore: 10,
    },
  },
];

// ── GRUPPO 4: ISSUE LEGITTIME — NON devono essere flaggate ──

const LEGIT_ISSUE_TESTS: TestCase[] = [

  // TEST 12: Bug report ben fatto
  {
    name: 'Bug report pulito — repro steps, versione, stack trace reale',
    run: () => testIssue(
      {
        title: 'TypeError when auth token is expired',
        body: `## Bug

TypeError thrown when trying to refresh an expired JWT.

## Steps to reproduce

1. Log in to the app
2. Wait 60 minutes (or manually expire the token in dev tools)
3. Try to access any protected route
4. Observe the error in console

## Expected
Should redirect to login page.

## Actual
White screen with error:

\`\`\`
TypeError: Cannot read properties of null (reading 'exp')
    at checkExpiry (src/auth.ts:34:12)
    at refreshToken (src/auth.ts:45:5)
\`\`\`

## Environment
- Version: 2.1.0
- Browser: Chrome 120
- OS: macOS 14.2`,
        author: 'helpful-user',
        labels: ['bug'],
      },
      ['src/auth.ts', 'src/app.ts', 'src/utils.ts'],
    ),
    expect: {
      verdict: 'clean',
      shouldNotContainSignals: ['hallucinated-file', 'no-reproduction-steps', 'overly-formal-issue'],
      maxScore: 3,
    },
  },

  // TEST 13: Feature request
  {
    name: 'Feature request semplice e diretta',
    run: () => testIssue(
      {
        title: 'Support for dark mode',
        body: `It'd be great if the app supported dark mode. My eyes hurt using it at night.

Could you add a toggle in settings? Something like what VS Code does.`,
        author: 'night-owl',
      },
      ['src/app.ts'],
    ),
    expect: {
      verdict: 'clean',
      maxScore: 2,
    },
  },
];

// ── GRUPPO 5: EDGE CASE ──

const EDGE_CASE_TESTS: TestCase[] = [

  // TEST 14: PR completamente vuota
  {
    name: 'PR vuota — 0 file, body vuoto',
    run: () => testPR({
      title: 'Empty PR',
      body: '',
      author: 'empty-user',
      commits: [],
      diff: '',
    }),
    expect: {
      verdict: 'clean',
      maxScore: 2,
    },
  },

  // TEST 15: Issue senza body
  {
    name: 'Issue con body null/vuoto',
    run: () => testIssue(
      { title: 'Something is broken', body: '', author: 'lazy-reporter' },
      ['src/app.ts'],
    ),
    expect: {
      verdict: 'clean',
      maxScore: 4,
    },
  },

  // TEST 16: PR con path Unicode
  {
    name: 'PR con file path contenenti caratteri Unicode',
    run: () => testPR({
      title: 'Add i18n translations',
      body: 'Added French and Japanese translation files.',
      author: 'i18n-contributor',
      commits: [{ message: 'feat: add fr and ja translations', author: 'i18n-contributor' }],
      diff: `diff --git a/locales/données_fr.json b/locales/données_fr.json
new file mode 100644
--- /dev/null
+++ b/locales/données_fr.json
@@ -0,0 +1,3 @@
+{
+  "greeting": "Bonjour le monde"
+}
diff --git a/locales/データ_ja.json b/locales/データ_ja.json
new file mode 100644
--- /dev/null
+++ b/locales/データ_ja.json
@@ -0,0 +1,3 @@
+{
+  "greeting": "こんにちは世界"
+}`,
    }),
    expect: {
      verdict: 'clean',
      maxScore: 4,
    },
  },

  // TEST 17: PR con label trusted
  {
    name: 'PR slop MA con label trusted-contributor — deve passare',
    run: () => testPR({
      title: 'Update stuff',
      body: 'This comprehensive PR leverages cutting-edge solutions.',
      author: 'trusted-human',
      labels: ['trusted-contributor'],
      commits: [{ message: 'update', author: 'trusted-human' }],
      diff: `diff --git a/src/x.ts b/src/x.ts\nindex abc..def 100644\n--- a/src/x.ts\n+++ b/src/x.ts\n@@ -1 +1 @@\n-old\n+new`,
    }),
    expect: {
      verdict: 'clean',
      maxScore: 0,
    },
  },
];

// ── GRUPPO 6: EXEMPTION ──

const EXEMPTION_TESTS: TestCase[] = [

  // TEST 18: Username case-insensitive
  {
    name: 'Exemption case-insensitive — "Dependabot[bot]" vs "dependabot[bot]"',
    run: () => testPR({
      title: 'bump deps',
      body: 'auto update',
      author: 'Dependabot[bot]',
      commits: [{ message: 'chore: bump', author: 'Dependabot[bot]' }],
      diff: `diff --git a/package.json b/package.json\nindex abc..def 100644\n--- a/package.json\n+++ b/package.json\n@@ -1 +1 @@\n-old\n+new`,
    }),
    expect: {
      verdict: 'clean',
      maxScore: 0,
    },
  },

  // TEST 19: Renovate bot exempted
  {
    name: 'Renovate bot — deve essere exempted',
    run: () => testPR({
      title: 'Update dependency X to v2',
      body: 'This PR updates X.',
      author: 'renovate[bot]',
      commits: [{ message: 'chore(deps): update X', author: 'renovate[bot]' }],
      diff: `diff --git a/package.json b/package.json\nindex abc..def 100644\n--- a/package.json\n+++ b/package.json\n@@ -1 +1 @@\n-"x": "1.0"\n+"x": "2.0"`,
    }),
    expect: {
      verdict: 'clean',
      maxScore: 0,
    },
  },
];

// ── GRUPPO 7: QUALITA DEL COMMENTO ──

const COMMENT_QUALITY_TESTS: TestCase[] = [

  // TEST 20: Il commento non contiene parole vietate
  {
    name: 'Commento educativo — non contiene "AI" standalone e non e ostile',
    run: () => testPR({
      title: 'Enhance stuff',
      body: 'This pull request introduces comprehensive changes that leverage modern patterns.',
      author: 'test-user',
      commits: [{ message: 'update', author: 'test-user' }],
      diff: `diff --git a/src/x.ts b/src/x.ts\nindex abc..def 100644\n--- a/src/x.ts\n+++ b/src/x.ts\n@@ -1,3 +1,3 @@\n-old code\n+new code that is very elegant`,
    }),
    expect: {
      verdict: 'suspicious',
      commentMustNotContain: [
        'AI-generated',
        'bot',
        'spam',
        'rejected',
        'banned',
      ],
      commentMustContain: [
        'ai-slop-guard',
        'flagged for review',
      ],
    },
  },

  // TEST 21: Il commento include la via d'uscita
  {
    name: 'Commento include label di override e link al repo',
    run: () => testPR({
      title: 'Refactor everything',
      body: 'This PR streamlines and enhances the entire holistic ecosystem with robust and seamless architecture.',
      author: 'slop-user',
      commits: [{ message: 'refactor', author: 'slop-user' }],
      diff: `diff --git a/src/x.ts b/src/x.ts\nindex abc..def 100644\n--- a/src/x.ts\n+++ b/src/x.ts\n@@ -1 +1 @@\n-a\n+b`,
    }),
    expect: {
      verdict: 'suspicious',
      commentMustContain: [
        'trusted-contributor',
      ],
    },
  },
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`\n${CYAN}━━━ ai-slop-guard LIVE TEST SUITE ━━━${RESET}\n`);

  const sections = [
    { name: '🗑️  SLOP PR — devono essere flaggate', tests: SLOP_PR_TESTS },
    { name: '✅ LEGIT PR — NON devono essere flaggate', tests: LEGIT_PR_TESTS },
    { name: '🗑️  SLOP ISSUE — devono essere flaggate', tests: SLOP_ISSUE_TESTS },
    { name: '✅ LEGIT ISSUE — NON devono essere flaggate', tests: LEGIT_ISSUE_TESTS },
    { name: '⚡ EDGE CASE', tests: EDGE_CASE_TESTS },
    { name: '🛡️  EXEMPTION', tests: EXEMPTION_TESTS },
    { name: '💬 COMMENTO EDUCATIVO', tests: COMMENT_QUALITY_TESTS },
  ];

  let passed = 0;
  let failed = 0;

  for (const section of sections) {
    console.log(`\n${YELLOW}${section.name}${RESET}`);
    for (const tc of section.tests) {
      const ok = await runTest(tc);
      if (ok) passed++; else failed++;
    }
  }

  console.log(`\n${CYAN}━━━ RISULTATI ━━━${RESET}`);
  console.log(`  ${GREEN}Passati: ${passed}${RESET}`);
  if (failed > 0) console.log(`  ${RED}Falliti: ${failed}${RESET}`);
  console.log(`  Totale: ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
