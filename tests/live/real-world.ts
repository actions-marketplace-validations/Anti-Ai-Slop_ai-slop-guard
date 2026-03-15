/**
 * Real-world validation — simula scenari reali ispirati a PR/issue
 * che si vedono su repo open source popolari.
 */
import { testPR, testIssue } from './harness';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

async function main() {
  console.log(`\n${CYAN}━━━ REAL-WORLD VALIDATION ━━━${RESET}\n`);

  let passed = 0;
  let failed = 0;

  async function run(
    name: string,
    fn: () => Promise<{ score: { total: number; verdict: string; signals: readonly { id: string }[] }; comment: string; duration: number }>,
    expectVerdict: string,
  ) {
    try {
      const r = await fn();
      const ids = r.score.signals.map(s => s.id);
      const ok = r.score.verdict === expectVerdict;
      if (ok) {
        passed++;
        console.log(`  ${GREEN}✓${RESET} ${name}`);
        console.log(`    ${DIM}score=${r.score.total} verdict=${r.score.verdict} signals=[${ids.join(', ')}] ${r.duration}ms${RESET}`);
      } else {
        failed++;
        console.log(`  ${RED}✗${RESET} ${name}`);
        console.log(`    ${RED}→ Expected verdict "${expectVerdict}", got "${r.score.verdict}"${RESET}`);
        console.log(`    ${DIM}score=${r.score.total} signals=[${ids.join(', ')}]${RESET}`);
      }
    } catch (e) {
      failed++;
      console.log(`  ${RED}✗${RESET} ${name}`);
      console.log(`    ${RED}→ CRASH: ${e instanceof Error ? e.message : String(e)}${RESET}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // LEGIT PRs — da repo reali (React, Next.js, Node.js)
  // ════════════════════════════════════════════════════════════════
  console.log(`${YELLOW}LEGIT PRs — stile React/Next.js/Node.js${RESET}`);

  await run('React PR — ESLint v10 support', () => testPR({
    title: '[eslint-plugin-react-hooks] Add ESLint v10 support',
    body: `ESLint v10.0.0 was released on February 7, 2026. The current \`peerDependencies\` for \`eslint-plugin-react-hooks\` only allows up to \`^9.0.0\`, which causes a warning when installing with ESLint v10.

This PR updates the peer dependency range and adds a v10 e2e fixture for CI testing.`,
    author: 'azat-io',
    commits: [
      { message: '[eslint-plugin-react-hooks] Add ESLint v10 support', author: 'azat-io' },
      { message: '[eslint-plugin-react-hooks] Add ESLint v10 fixture to CI matrix', author: 'azat-io' },
    ],
    diff: `diff --git a/packages/eslint-plugin-react-hooks/package.json b/packages/eslint-plugin-react-hooks/package.json
index abc..def 100644
--- a/packages/eslint-plugin-react-hooks/package.json
+++ b/packages/eslint-plugin-react-hooks/package.json
@@ -10,7 +10,7 @@
   "peerDependencies": {
-    "eslint": "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0 || ^9.0.0"
+    "eslint": "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0 || ^9.0.0 || ^10.0.0"
   },
diff --git a/fixtures/eslint-v10/package.json b/fixtures/eslint-v10/package.json
new file mode 100644
--- /dev/null
+++ b/fixtures/eslint-v10/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "eslint-v10-fixture",
+  "private": true,
+  "devDependencies": {
+    "eslint": "^10.0.0",
+    "eslint-plugin-react-hooks": "workspace:*"
+  }
+}
diff --git a/fixtures/eslint-v10/.eslintrc.json b/fixtures/eslint-v10/.eslintrc.json
new file mode 100644
--- /dev/null
+++ b/fixtures/eslint-v10/.eslintrc.json
@@ -0,0 +1,5 @@
+{
+  "plugins": ["react-hooks"],
+  "rules": {
+    "react-hooks/rules-of-hooks": "error"
+  }
+}`,
  }), 'clean');

  await run('Next.js PR — fix devtools overlay blocking', () => testPR({
    title: '[devtools] Stop blocking overlay on error details copy',
    body: `The toolbar was blocked on sourcemapping the stackframes for the "copy details button". This suspended the whole devtools which meant you couldn't even see the error.

Now we only block on sourcemapping when we actually copy. We use \`useActionState\` now that devtools is using modern React. We're only blocking for up to 2s and then fallback to the unsourcemapped stack.`,
    author: 'eps1lon',
    commits: [
      { message: '[devtools] Stop blocking overlay on error details copy', author: 'eps1lon' },
    ],
    diff: `diff --git a/packages/next/src/client/components/react-dev-overlay/ui/components/errors/error-overlay-toolbar/error-overlay-toolbar.tsx b/packages/next/src/client/components/react-dev-overlay/ui/components/errors/error-overlay-toolbar/error-overlay-toolbar.tsx
index abc..def 100644
--- a/packages/next/src/client/components/react-dev-overlay/ui/components/errors/error-overlay-toolbar/error-overlay-toolbar.tsx
+++ b/packages/next/src/client/components/react-dev-overlay/ui/components/errors/error-overlay-toolbar/error-overlay-toolbar.tsx
@@ -15,20 +15,12 @@ export function ErrorOverlayToolbar({ error }: { error: ReadyRuntimeError }) {
-  const [frames, setFrames] = useState<OriginalStackFrame[] | null>(null);
-  useEffect(() => {
-    let cancelled = false;
-    getOriginalStackFrames(error.frames).then((f) => {
-      if (!cancelled) setFrames(f);
-    });
-    return () => { cancelled = true; };
-  }, [error]);
-
-  if (frames === null) return <div className="loading">Loading...</div>;
+  const [copyState, copyAction] = useActionState(async () => {
+    const frames = await Promise.race([
+      getOriginalStackFrames(error.frames),
+      new Promise<null>((r) => setTimeout(() => r(null), 2000)),
+    ]);
+    const text = formatErrorDetails(error, frames ?? error.frames);
+    await navigator.clipboard.writeText(text);
+    return 'copied';
+  }, 'idle');

   return (
-    <button onClick={() => copyToClipboard(frames)}>
-      Copy Details
+    <button onClick={copyAction} disabled={copyState === 'pending'}>
+      {copyState === 'pending' ? 'Copying...' : 'Copy Details'}
     </button>
   );
 }`,
  }), 'clean');

  await run('Node.js PR — worker heap profile optimization', () => testPR({
    title: 'worker: heap profile optimizations',
    body: `This PR makes two small optimizations to worker heap profile serialization:

1. Stop the sampling heap profiler immediately after \`GetAllocationProfile()\` instead of after JSON serialization completes
2. Serialize heap profiles without extra indentation and newlines`,
    author: 'IlyasShabi',
    commits: [
      { message: 'worker: heap profile optimizations', author: 'IlyasShabi' },
    ],
    diff: `diff --git a/lib/internal/worker/heap_profile.js b/lib/internal/worker/heap_profile.js
index abc..def 100644
--- a/lib/internal/worker/heap_profile.js
+++ b/lib/internal/worker/heap_profile.js
@@ -25,8 +25,8 @@ function serializeHeapProfile() {
   const profile = heapProfiler.getAllocationProfile();
+  heapProfiler.stopSamplingHeapProfiling();
   const serialized = JSON.stringify(profile);
-  heapProfiler.stopSamplingHeapProfiling();
   return serialized;
 }`,
  }), 'clean');

  // ════════════════════════════════════════════════════════════════
  // SLOP PRs — ispirati a pattern reali di AI dump
  // ════════════════════════════════════════════════════════════════
  console.log(`\n${YELLOW}SLOP PRs — pattern reali da repo open source${RESET}`);

  await run('Tipico AI dump — refactor senza motivo', () => testPR({
    title: 'Refactor authentication module for improved maintainability',
    body: `This pull request introduces a comprehensive refactoring of the authentication module, leveraging modern design patterns to streamline the codebase. The implementation utilizes a robust middleware architecture that enhances security and fosters seamless integration with existing components.

### Changes Made
- Refactored authentication middleware for better separation of concerns
- Enhanced error handling with comprehensive validation
- Streamlined token verification process
- Improved code organization for maintainability
- Updated imports to leverage modern module patterns
- Added comprehensive inline documentation
- Utilized dependency injection for robust testability
- Elevated code quality through holistic restructuring`,
    author: 'helpful-ai-user',
    commits: [
      { message: 'refactor auth module', author: 'helpful-ai-user' },
    ],
    diff: `diff --git a/src/auth/middleware.ts b/src/auth/middleware.ts
index abc..def 100644
--- a/src/auth/middleware.ts
+++ b/src/auth/middleware.ts
@@ -1,8 +1,8 @@
-import { verify } from 'jsonwebtoken';
-import { Request, Response, NextFunction } from 'express';
+import { verify } from 'jsonwebtoken';
+import { Request, Response, NextFunction } from 'express';

-export function authMiddleware(req: Request, res: Response, next: NextFunction) {
-  const token = req.headers.authorization?.split(' ')[1];
-  if (!token) return res.status(401).json({ error: 'No token' });
-  verify(token, process.env.JWT_SECRET!, (err, decoded) => {
-    if (err) return res.status(403).json({ error: 'Invalid token' });
-    req.user = decoded;
-    next();
-  });
-}
+export function authMiddleware(req: Request, res: Response, next: NextFunction) {
+    const token = req.headers.authorization?.split(' ')[1];
+    if (!token) return res.status(401).json({ error: 'No token' });
+    verify(token, process.env.JWT_SECRET!, (err, decoded) => {
+        if (err) return res.status(403).json({ error: 'Invalid token' });
+        req.user = decoded;
+        next();
+    });
+}`,
  }), 'suspicious');

  await run('PR ChatGPT copia-incolla — import inutili + niente test', () => testPR({
    title: 'Add utility functions for data processing',
    body: `This PR adds comprehensive utility functions that enhance the data processing capabilities of the project. The elegant implementation leverages functional programming patterns for seamless data transformation.`,
    author: 'new-contributor-2024',
    commits: [
      { message: 'add utils', author: 'new-contributor-2024' },
    ],
    diff: `diff --git a/src/utils/data-processor.ts b/src/utils/data-processor.ts
new file mode 100644
--- /dev/null
+++ b/src/utils/data-processor.ts
@@ -0,0 +1,45 @@
+import { EventEmitter } from 'events';
+import { Transform } from 'stream';
+import { createHash } from 'crypto';
+import { promisify } from 'util';
+import { readFile, writeFile } from 'fs/promises';
+import { join, resolve, basename } from 'path';
+import { cpus, totalmem, freemem } from 'os';
+import { performance } from 'perf_hooks';
+import { Worker } from 'worker_threads';
+import { createServer } from 'http';
+
+/**
+ * Comprehensive data processing utility that provides
+ * robust and streamlined data transformation capabilities.
+ */
+export function processData(input: string): string {
+  return input.trim();
+}
+
+/**
+ * Enhanced validation function that leverages modern
+ * patterns for seamless input verification.
+ */
+export function validateInput(data: unknown): boolean {
+  return data !== null && data !== undefined;
+}
+
+/**
+ * Optimized helper function for efficient string
+ * manipulation and transformation.
+ */
+export function formatString(str: string): string {
+  return str.toLowerCase();
+}
+
+/**
+ * Robust error handling utility that fosters
+ * comprehensive error management.
+ */
+export function handleError(err: Error): void {
+  throw err;
+}
+
+/**
+ * Elevated logging mechanism for holistic
+ * application monitoring.
+ */
+export function log(message: string): void {
+  return;
+}`,
  }), 'suspicious');

  await run('Issue AI con stack trace inventato — repo Python', () => testIssue({
    title: 'Critical memory leak in request handler causes OOM',
    body: `Dear Development Team,

I have identified a critical memory leak that occurs when processing concurrent HTTP requests. The application gradually consumes all available memory, eventually resulting in an Out of Memory error.

\`\`\`
Traceback (most recent call last):
  File "src/server/request_pool.py", line 342, in handle_concurrent_requests
    pool.allocate_buffer(request.payload)
  File "src/memory/buffer_manager.py", line 178, in allocate_buffer
    self._expand_pool(size * GROWTH_FACTOR)
  File "src/memory/gc_optimizer.py", line 95, in _expand_pool
    raise MemoryError(f"Pool exhausted: {self.current_usage}/{self.max_size}")
MemoryError: Pool exhausted: 2147483648/2147483648
\`\`\`

This represents a significant architectural concern that could potentially impact the stability and reliability of the entire application ecosystem. I would strongly recommend implementing a comprehensive memory management strategy that leverages garbage collection optimization.

Best regards`,
    author: 'concerned-user-99',
    labels: ['bug'],
  }, [
    'src/server/app.py', 'src/server/routes.py', 'src/utils/helpers.py',
    'tests/test_server.py', 'requirements.txt', 'setup.py',
  ]), 'likely-slop');

  await run('Issue legittima — bug report con repro steps', () => testIssue({
    title: 'TypeError in auth middleware when cookie is malformed',
    body: `## What happened

The auth middleware crashes with a TypeError when the session cookie contains invalid base64.

## Steps to reproduce

1. Open the app in Chrome
2. Open DevTools > Application > Cookies
3. Edit the \`session\` cookie value to \`not-valid-base64!!!\`
4. Refresh the page
5. Server logs show TypeError

## Error

\`\`\`
TypeError: The first argument must be of type string or Buffer
    at checkEncoding (src/utils/helpers.py:12:5)
    at decodeSession (src/server/app.py:45:10)
\`\`\`

## Expected

Should return 401 and clear the cookie instead of crashing.

## Environment
- Node 20.11
- Express 4.18.2
- OS: Ubuntu 22.04`,
    author: 'real-user',
    labels: ['bug'],
  }, [
    'src/server/app.py', 'src/server/routes.py', 'src/utils/helpers.py',
  ]), 'clean');

  await run('PR Dependabot reale', () => testPR({
    title: 'Bump express from 4.18.2 to 4.19.0',
    body: `Bumps [express](https://github.com/expressjs/express) from 4.18.2 to 4.19.0.

**Release notes**: https://github.com/expressjs/express/releases/tag/4.19.0

**Changelog**: https://github.com/expressjs/express/blob/master/History.md

**Commits**: expressjs/express@4.18.2...4.19.0`,
    author: 'dependabot[bot]',
    commits: [
      { message: 'chore(deps): bump express from 4.18.2 to 4.19.0', author: 'dependabot[bot]' },
    ],
    diff: `diff --git a/package.json b/package.json
index abc..def 100644
--- a/package.json
+++ b/package.json
@@ -12,7 +12,7 @@
-    "express": "4.18.2",
+    "express": "4.19.0",
diff --git a/package-lock.json b/package-lock.json
index abc..def 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -500,7 +500,7 @@
-      "version": "4.18.2",
+      "version": "4.19.0",`,
  }), 'clean');

  // ════════════════════════════════════════════════════════════════
  // EDGE CASE reali
  // ════════════════════════════════════════════════════════════════
  console.log(`\n${YELLOW}EDGE CASES reali${RESET}`);

  await run('PR solo documentazione — legittima', () => testPR({
    title: 'Fix typo in contributing guide',
    body: 'Small typo fix: "recieve" → "receive" in CONTRIBUTING.md.',
    author: 'typo-fixer',
    commits: [
      { message: 'docs: fix typo in contributing guide', author: 'typo-fixer' },
    ],
    diff: `diff --git a/CONTRIBUTING.md b/CONTRIBUTING.md
index abc..def 100644
--- a/CONTRIBUTING.md
+++ b/CONTRIBUTING.md
@@ -10,7 +10,7 @@
-You will recieve a notification when your PR is reviewed.
+You will receive a notification when your PR is reviewed.`,
  }), 'clean');

  await run('PR con emoji moderate — non slop', () => testPR({
    title: 'Add dark mode support',
    body: `Adds dark mode toggle to the settings page. Closes #89.

Uses \`prefers-color-scheme\` media query as default, with manual override stored in localStorage.`,
    author: 'frontend-dev',
    commits: [
      { message: 'feat: add dark mode toggle with system preference detection', author: 'frontend-dev' },
      { message: 'test: add dark mode toggle tests', author: 'frontend-dev' },
    ],
    diff: `diff --git a/src/components/ThemeToggle.tsx b/src/components/ThemeToggle.tsx
new file mode 100644
--- /dev/null
+++ b/src/components/ThemeToggle.tsx
@@ -0,0 +1,20 @@
+import { useState, useEffect } from 'react';
+
+export function ThemeToggle() {
+  const [dark, setDark] = useState(() => {
+    const saved = localStorage.getItem('theme');
+    if (saved) return saved === 'dark';
+    return window.matchMedia('(prefers-color-scheme: dark)').matches;
+  });
+
+  useEffect(() => {
+    document.documentElement.classList.toggle('dark', dark);
+    localStorage.setItem('theme', dark ? 'dark' : 'light');
+  }, [dark]);
+
+  return (
+    <button onClick={() => setDark(!dark)}>
+      {dark ? 'Light Mode' : 'Dark Mode'}
+    </button>
+  );
+}
diff --git a/tests/ThemeToggle.test.tsx b/tests/ThemeToggle.test.tsx
new file mode 100644
--- /dev/null
+++ b/tests/ThemeToggle.test.tsx
@@ -0,0 +1,10 @@
+import { render, fireEvent } from '@testing-library/react';
+import { ThemeToggle } from '../src/components/ThemeToggle';
+
+test('toggles theme', () => {
+  const { getByText } = render(<ThemeToggle />);
+  const btn = getByText('Dark Mode');
+  fireEvent.click(btn);
+  expect(document.documentElement.classList.contains('dark')).toBe(true);
+  expect(getByText('Light Mode')).toBeTruthy();
+});`,
  }), 'clean');

  // ════════════════════════════════════════════════════════════════
  // Risultati
  // ════════════════════════════════════════════════════════════════
  console.log(`\n${CYAN}━━━ RISULTATI ━━━${RESET}`);
  console.log(`  ${GREEN}Passati: ${passed}${RESET}`);
  if (failed > 0) console.log(`  ${RED}Falliti: ${failed}${RESET}`);
  console.log(`  Totale: ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
