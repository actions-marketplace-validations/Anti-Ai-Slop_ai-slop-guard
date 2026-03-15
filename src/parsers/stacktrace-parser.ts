import type { StackFrame, StackTraceFormat } from '../types';

// ---------------------------------------------------------------------------
// Per-language regex patterns
// ---------------------------------------------------------------------------

interface FormatMatcher {
  readonly format: StackTraceFormat;
  readonly pattern: RegExp;
  readonly extract: (match: RegExpMatchArray) => StackFrame;
}

const MATCHERS: readonly FormatMatcher[] = [
  // Python:  File "/path/file.py", line 42, in func
  {
    format: 'python',
    pattern: /File "(.+?)", line (\d+)(?:, in (.+))?/,
    extract: (m) => ({
      filePath: normalizePath(m[1] ?? ''),
      lineNumber: parseInt(m[2] ?? '0', 10),
      functionName: m[3] || undefined,
      format: 'python',
    }),
  },
  // Java / Kotlin:  at com.pkg.Class.method(File.java:42)
  // Must be before JS — both use "at" prefix but Java is more specific
  {
    format: 'java',
    pattern: /at\s+([\w$.]+)\((.+?):(\d+)\)/,
    extract: (m) => ({
      functionName: m[1] || undefined,
      filePath: normalizePath(m[2] ?? ''),
      lineNumber: parseInt(m[3] ?? '0', 10),
      format: 'java',
    }),
  },
  // C#:  at Namespace.Class.Method() in /path/File.cs:line 42
  // Must be before JS — uses "at" prefix but is more specific with "in" keyword
  {
    format: 'csharp',
    pattern: /at\s+(.+)\s+in\s+(.+?):line\s+(\d+)/,
    extract: (m) => ({
      functionName: m[1] || undefined,
      filePath: normalizePath(m[2] ?? ''),
      lineNumber: parseInt(m[3] ?? '0', 10),
      format: 'csharp',
    }),
  },
  // JavaScript / Node.js:  at fnName (/path/file.js:10:5)
  {
    format: 'javascript',
    pattern: /at\s+(?:(.+?)\s+\()?(.+?):(\d+)(?::(\d+))?\)?/,
    extract: (m) => ({
      functionName: m[1] || undefined,
      filePath: normalizePath(m[2] ?? ''),
      lineNumber: parseInt(m[3] ?? '0', 10),
      column: m[4] ? parseInt(m[4], 10) : undefined,
      format: 'javascript',
    }),
  },
  // Go:  /path/file.go:42
  {
    format: 'go',
    pattern: /^\s*(.+\.go):(\d+)/m,
    extract: (m) => ({
      filePath: normalizePath(m[1] ?? ''),
      lineNumber: parseInt(m[2] ?? '0', 10),
      format: 'go',
    }),
  },
  // Rust:  at ./src/file.rs:42:5
  {
    format: 'rust',
    pattern: /at\s+\.?\/?(.+?):(\d+)(?::(\d+))?/,
    extract: (m) => ({
      filePath: normalizePath(m[1] ?? ''),
      lineNumber: parseInt(m[2] ?? '0', 10),
      column: m[3] ? parseInt(m[3], 10) : undefined,
      format: 'rust',
    }),
  },
  // Ruby:  /path/file.rb:42:in `method'
  {
    format: 'ruby',
    pattern: /^(.+?):(\d+):in\s+`(.+?)'/m,
    extract: (m) => ({
      filePath: normalizePath(m[1] ?? ''),
      lineNumber: parseInt(m[2] ?? '0', 10),
      functionName: m[3] || undefined,
      format: 'ruby',
    }),
  },
  // PHP:  #0 /path/file.php(42): Function()
  {
    format: 'php',
    pattern: /#\d+\s+(.+?)\((\d+)\)(?::\s*(.+))?/,
    extract: (m) => ({
      filePath: normalizePath(m[1] ?? ''),
      lineNumber: parseInt(m[2] ?? '0', 10),
      functionName: m[3] || undefined,
      format: 'php',
    }),
  },
];

/**
 * Extract code blocks from markdown text.
 * Only parses fenced code blocks (```...```).
 */
function extractCodeBlocks(markdown: string): readonly string[] {
  const blocks: string[] = [];
  const pattern = /```[\s\S]*?```/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    // Strip the ``` fences
    const content = match[0]
      .replace(/^```[^\n]*\n?/, '')
      .replace(/\n?```$/, '');
    blocks.push(content);
  }

  return blocks;
}

/**
 * Normalize a file path to be repo-relative.
 * Removes absolute prefixes and leading ./ or /
 */
function normalizePath(filePath: string): string {
  let normalized = filePath.trim();

  // Remove common absolute prefixes
  normalized = normalized
    .replace(/^(?:\/(?:home|Users|var|tmp|opt|usr)\/[^/]+\/)+/i, '')
    .replace(/^[A-Z]:\\[^\\]+\\/i, '')
    .replace(/^\.\//, '')
    .replace(/^\//, '');

  // Convert Windows backslashes to forward slashes
  normalized = normalized.replace(/\\/g, '/');

  return normalized;
}

/**
 * Parse stack trace frames from an issue body (markdown).
 * Only extracts from fenced code blocks to avoid false positives.
 * @param body - markdown body of the issue
 * @returns extracted stack frames
 */
export function parseStackTrace(body: string): readonly StackFrame[] {
  const codeBlocks = extractCodeBlocks(body);
  if (codeBlocks.length === 0) return [];

  const frames: StackFrame[] = [];

  for (const block of codeBlocks) {
    const blockLines = block.split('\n');

    for (const line of blockLines) {
      for (const matcher of MATCHERS) {
        const match = line.match(matcher.pattern);
        if (match) {
          frames.push(matcher.extract(match));
          break; // first match wins for this line
        }
      }
    }
  }

  return frames;
}
