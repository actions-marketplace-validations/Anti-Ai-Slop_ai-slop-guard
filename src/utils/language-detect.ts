// ---------------------------------------------------------------------------
// File classification utilities
// ---------------------------------------------------------------------------

const EXTENSION_MAP: Readonly<Record<string, string>> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.java': 'java',
  '.kt': 'kotlin',
  '.go': 'go',
  '.rs': 'rust',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.swift': 'swift',
  '.php': 'php',
  '.scala': 'scala',
  '.r': 'r',
  '.R': 'r',
  '.lua': 'lua',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.htm': 'html',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.proto': 'protobuf',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.toml': 'toml',
  '.xml': 'xml',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.dart': 'dart',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.zig': 'zig',
  '.nim': 'nim',
};

/**
 * Detect programming language from file extension.
 * @param filePath - path to the file
 * @returns language name or null if unknown
 */
export function detectLanguage(filePath: string): string | null {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex === -1) return null;
  const ext = filePath.slice(dotIndex).toLowerCase();
  return EXTENSION_MAP[ext] ?? null;
}

const TEST_PATTERNS: readonly RegExp[] = [
  /[/\\]__tests__[/\\]/,
  /[/\\]test[/\\]/,
  /[/\\]tests[/\\]/,
  /[/\\]spec[/\\]/,
  /\.test\.\w+$/,
  /\.spec\.\w+$/,
  /_test\.\w+$/,
  /test_[^/\\]+\.\w+$/,
  /\.tests\.\w+$/,
];

/**
 * Check if a file path is a test file.
 * @param filePath - path to check
 */
export function isTestFile(filePath: string): boolean {
  return TEST_PATTERNS.some((p) => p.test(filePath));
}

const CONFIG_PATTERNS: readonly RegExp[] = [
  /\.eslintrc/,
  /\.prettierrc/,
  /tsconfig/,
  /jest\.config/,
  /vitest\.config/,
  /webpack\.config/,
  /rollup\.config/,
  /vite\.config/,
  /next\.config/,
  /babel\.config/,
  /\.babelrc/,
  /package\.json$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /Dockerfile/,
  /docker-compose/,
  /\.env/,
  /\.gitignore$/,
  /\.editorconfig$/,
  /Makefile$/,
  /\.github[/\\]/,
];

/**
 * Check if a file path is a configuration file.
 * @param filePath - path to check
 */
export function isConfigFile(filePath: string): boolean {
  return CONFIG_PATTERNS.some((p) => p.test(filePath));
}
