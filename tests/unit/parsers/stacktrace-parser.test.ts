import { describe, it, expect } from 'vitest';
import { parseStackTrace } from '@/parsers/stacktrace-parser';

describe('parseStackTrace', () => {
  describe('JavaScript stack trace', () => {
    it('should parse a JS/Node stack trace inside a fenced code block', () => {
      const body = [
        'Something broke.',
        '',
        '```',
        'TypeError: Cannot read properties of undefined',
        '    at processTicksAndRejections (node:internal/process/task_queues:95:5)',
        '    at UserService.getUser (src/services/user.ts:42:10)',
        '    at handler (src/routes/api.ts:15:24)',
        '```',
      ].join('\n');

      const frames = parseStackTrace(body);

      expect(frames.length).toBeGreaterThanOrEqual(2);

      const userServiceFrame = frames.find(
        (f) => f.filePath.includes('src/services/user.ts'),
      );
      expect(userServiceFrame).toBeDefined();
      expect(userServiceFrame!.lineNumber).toBe(42);
      expect(userServiceFrame!.functionName).toContain('getUser');
      expect(userServiceFrame!.format).toBe('javascript');

      const apiFrame = frames.find(
        (f) => f.filePath.includes('src/routes/api.ts'),
      );
      expect(apiFrame).toBeDefined();
      expect(apiFrame!.lineNumber).toBe(15);
    });
  });

  describe('Python stack trace', () => {
    it('should parse Python traceback inside a fenced code block', () => {
      const body = [
        'Error when running the script:',
        '',
        '```python',
        'Traceback (most recent call last):',
        '  File "app/main.py", line 10, in start',
        '    run_server()',
        '  File "app/server.py", line 55, in run_server',
        '    handle_request(req)',
        'RuntimeError: something failed',
        '```',
      ].join('\n');

      const frames = parseStackTrace(body);

      expect(frames.length).toBeGreaterThanOrEqual(2);

      const mainFrame = frames.find(
        (f) => f.filePath.includes('app/main.py'),
      );
      expect(mainFrame).toBeDefined();
      expect(mainFrame!.lineNumber).toBe(10);
      expect(mainFrame!.functionName).toContain('start');
      expect(mainFrame!.format).toBe('python');

      const serverFrame = frames.find(
        (f) => f.filePath.includes('app/server.py'),
      );
      expect(serverFrame).toBeDefined();
      expect(serverFrame!.lineNumber).toBe(55);
      expect(serverFrame!.functionName).toContain('run_server');
    });
  });

  describe('Java stack trace', () => {
    it('should parse Java stack trace inside a fenced code block', () => {
      const body = [
        'Application crashed with:',
        '',
        '```',
        'java.lang.NullPointerException: null',
        '    at com.example.service.UserService.findById(UserService.java:87)',
        '    at com.example.controller.UserController.getUser(UserController.java:34)',
        '    at sun.reflect.NativeMethodAccessorImpl.invoke(Unknown Source)',
        '```',
      ].join('\n');

      const frames = parseStackTrace(body);

      expect(frames.length).toBeGreaterThanOrEqual(2);

      const serviceFrame = frames.find(
        (f) => f.filePath.includes('UserService.java'),
      );
      expect(serviceFrame).toBeDefined();
      expect(serviceFrame!.lineNumber).toBe(87);
      expect(serviceFrame!.format).toBe('java');

      const controllerFrame = frames.find(
        (f) => f.filePath.includes('UserController.java'),
      );
      expect(controllerFrame).toBeDefined();
      expect(controllerFrame!.lineNumber).toBe(34);
    });
  });

  describe('Go stack trace', () => {
    it('should parse Go stack trace inside a fenced code block', () => {
      const body = [
        'Panic in production:',
        '',
        '```',
        'goroutine 1 [running]:',
        'main.handleRequest()',
        '    /home/user/project/cmd/server/main.go:42 +0x1a4',
        'net/http.(*ServeMux).ServeHTTP()',
        '    /home/user/project/internal/handler.go:88 +0xc0',
        '```',
      ].join('\n');

      const frames = parseStackTrace(body);

      expect(frames.length).toBeGreaterThanOrEqual(2);

      const mainFrame = frames.find(
        (f) => f.filePath.includes('main.go'),
      );
      expect(mainFrame).toBeDefined();
      expect(mainFrame!.lineNumber).toBe(42);
      expect(mainFrame!.format).toBe('go');

      const handlerFrame = frames.find(
        (f) => f.filePath.includes('handler.go'),
      );
      expect(handlerFrame).toBeDefined();
      expect(handlerFrame!.lineNumber).toBe(88);
    });
  });

  describe('no code blocks', () => {
    it('should return empty array when there are no code blocks', () => {
      const body = [
        'I got an error.',
        '',
        'TypeError: Cannot read properties of undefined',
        '    at UserService.getUser (src/services/user.ts:42:10)',
        '',
        'Please help!',
      ].join('\n');

      const frames = parseStackTrace(body);

      expect(frames).toEqual([]);
    });
  });

  describe('stack trace outside code block', () => {
    it('should ignore stack traces not inside fenced code blocks', () => {
      const body = [
        'Here is the error:',
        '',
        '    at UserService.getUser (src/services/user.ts:42:10)',
        '    at handler (src/routes/api.ts:15:24)',
        '',
        'And here is an unrelated code block:',
        '',
        '```',
        'npm install',
        '```',
      ].join('\n');

      const frames = parseStackTrace(body);

      expect(frames).toEqual([]);
    });
  });

  describe('multiple code blocks', () => {
    it('should parse stack frames from multiple code blocks', () => {
      const body = [
        'First error:',
        '',
        '```',
        'Error: connection refused',
        '    at Database.connect (src/db.ts:20:5)',
        '```',
        '',
        'Second error (Python):',
        '',
        '```python',
        'Traceback (most recent call last):',
        '  File "scripts/migrate.py", line 8, in migrate',
        '    connect()',
        'ConnectionError: refused',
        '```',
      ].join('\n');

      const frames = parseStackTrace(body);

      expect(frames.length).toBeGreaterThanOrEqual(2);

      const dbFrame = frames.find(
        (f) => f.filePath.includes('src/db.ts'),
      );
      expect(dbFrame).toBeDefined();
      expect(dbFrame!.format).toBe('javascript');

      const pyFrame = frames.find(
        (f) => f.filePath.includes('scripts/migrate.py'),
      );
      expect(pyFrame).toBeDefined();
      expect(pyFrame!.format).toBe('python');
    });
  });

  describe('path normalization', () => {
    it('should strip absolute path prefixes to produce relative paths', () => {
      const body = [
        '```',
        'Error: failed',
        '    at build (/home/runner/work/my-project/src/build.ts:10:3)',
        '```',
      ].join('\n');

      const frames = parseStackTrace(body);

      expect(frames.length).toBeGreaterThanOrEqual(1);

      const buildFrame = frames.find(
        (f) => f.filePath.includes('build.ts'),
      );
      expect(buildFrame).toBeDefined();
      // Path should not start with absolute prefix
      expect(buildFrame!.filePath).not.toMatch(/^\//);
      expect(buildFrame!.filePath).toContain('src/build.ts');
    });
  });

  describe('empty body', () => {
    it('should return empty array for an empty string', () => {
      const frames = parseStackTrace('');

      expect(frames).toEqual([]);
    });

    it('should return empty array for whitespace-only body', () => {
      const frames = parseStackTrace('   \n\n  ');

      expect(frames).toEqual([]);
    });
  });
});
