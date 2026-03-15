import { EMOJI_PATTERN } from './patterns';

/**
 * Truncate text to a max length, appending ellipsis if needed.
 * @param text - input text
 * @param maxLength - maximum character count (default 200)
 */
export function truncate(text: string, maxLength = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Collapse consecutive whitespace into single spaces and trim.
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Count how many times a pattern matches in text.
 * @param text - input text
 * @param pattern - regex pattern (will be made global)
 */
export function countMatches(text: string, pattern: RegExp): number {
  const flags = pattern.flags.includes('g')
    ? pattern.flags
    : pattern.flags + 'g';
  const globalPattern = new RegExp(pattern.source, flags);
  const matches = text.match(globalPattern);
  return matches ? matches.length : 0;
}

/**
 * Count the maximum number of consecutive bullet lines.
 * Bullets start with `- ` or `* `.
 */
export function countConsecutiveBullets(text: string): number {
  const lines = text.split('\n');
  let maxConsecutive = 0;
  let current = 0;

  for (const line of lines) {
    if (/^\s*[-*]\s+/.test(line)) {
      current++;
      if (current > maxConsecutive) maxConsecutive = current;
    } else {
      current = 0;
    }
  }

  return maxConsecutive;
}

/**
 * Count the number of emoji in text.
 */
export function countEmojis(text: string): number {
  const matches = text.match(EMOJI_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Check if an issue body contains reproduction steps.
 */
export function hasReproductionSteps(text: string): boolean {
  const patterns = [
    /\b(?:steps? to reproduce|how to reproduce|reproduction|repro steps)\b/i,
    /\b(?:1\.|step 1|first,?\s)/i,
    /\b(?:to reproduce|reproducing)\b/i,
  ];
  return patterns.some((p) => p.test(text));
}

/**
 * Count lines of code vs comment lines in added content.
 * @returns ratio of comment lines to total lines (0.0-1.0)
 */
export function commentRatio(lines: readonly string[]): number {
  if (lines.length === 0) return 0;

  const commentPatterns = [
    /^\s*\/\//, // JS/TS/Go/Rust single-line
    /^\s*#/, // Python/Ruby/Shell
    /^\s*\/?\*/, // C-style block comment
    /^\s*--/, // SQL/Lua
    /^\s*;/, // ASM/Lisp
    /^\s*<!--/, // HTML
  ];

  let commentCount = 0;
  for (const line of lines) {
    if (commentPatterns.some((p) => p.test(line))) {
      commentCount++;
    }
  }

  return commentCount / lines.length;
}
