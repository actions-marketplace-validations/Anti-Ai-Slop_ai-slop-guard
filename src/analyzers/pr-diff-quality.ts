import type { Signal, DiffFile } from '../types';
import { SIGNALS } from '../scoring/signals';
import { commentRatio } from '../utils/text-utils';

/**
 * Check if new code is added without tests.
 */
export function checkTestFreeFeature(
  files: readonly DiffFile[],
): Signal | null {
  const hasNewCode = files.some(
    (f) => !f.isTest && !f.isConfig && !f.isBinary && f.additions.length > 10,
  );
  const hasTests = files.some((f) => f.isTest && f.additions.length > 0);

  if (!hasNewCode || hasTests) return null;

  return {
    id: SIGNALS.TEST_FREE_FEATURE.id,
    category: SIGNALS.TEST_FREE_FEATURE.category,
    score: SIGNALS.TEST_FREE_FEATURE.defaultScore,
    confidence: 0.8,
    detail: 'New code added without any test changes.',
  };
}

/**
 * Check for mixed tabs and spaces in added code.
 */
export function checkInconsistentStyle(
  files: readonly DiffFile[],
): Signal | null {
  let hasTabs = false;
  let hasSpaces = false;

  for (const file of files) {
    if (file.isConfig || file.isBinary) continue;
    for (const line of file.additions) {
      if (/^\t/.test(line.content)) hasTabs = true;
      if (/^ {2,}/.test(line.content)) hasSpaces = true;
    }
  }

  if (!(hasTabs && hasSpaces)) return null;

  return {
    id: SIGNALS.INCONSISTENT_STYLE.id,
    category: SIGNALS.INCONSISTENT_STYLE.category,
    score: SIGNALS.INCONSISTENT_STYLE.defaultScore,
    confidence: 0.8,
    detail: 'Mixed tabs and spaces in added code.',
  };
}

/**
 * Check for duplicate code blocks in the diff.
 */
export function checkDuplicateCode(
  files: readonly DiffFile[],
): Signal | null {
  const BLOCK_SIZE = 4;

  const allAdded = files
    .filter((f) => !f.isTest && !f.isConfig && !f.isBinary)
    .flatMap((f) => f.additions.map((l) => l.content.trim()))
    .filter((l) => l.length > 10);

  if (allAdded.length < BLOCK_SIZE * 2) return null;

  const blockHashes = new Map<string, number>();
  let duplicateBlocks = 0;

  for (let i = 0; i <= allAdded.length - BLOCK_SIZE; i++) {
    const block = allAdded.slice(i, i + BLOCK_SIZE).join('\n');
    const count = (blockHashes.get(block) ?? 0) + 1;
    blockHashes.set(block, count);
    if (count === 2) duplicateBlocks++;
  }

  if (duplicateBlocks < 1) return null;

  return {
    id: SIGNALS.DUPLICATE_CODE_IN_DIFF.id,
    category: SIGNALS.DUPLICATE_CODE_IN_DIFF.category,
    score: SIGNALS.DUPLICATE_CODE_IN_DIFF.defaultScore,
    confidence: 0.7,
    detail: `${duplicateBlocks} block(s) of duplicated code found in the diff.`,
  };
}

/**
 * Check if >40% of added lines are comments.
 */
export function checkHighCommentRatio(
  files: readonly DiffFile[],
): Signal | null {
  const codeFiles = files.filter(
    (f) => !f.isTest && !f.isConfig && !f.isBinary,
  );
  const allAddedLines = codeFiles.flatMap((f) =>
    f.additions.map((l) => l.content),
  );

  if (allAddedLines.length < 10) return null;

  const ratio = commentRatio(allAddedLines);
  if (ratio <= 0.4) return null;

  return {
    id: SIGNALS.HIGH_COMMENT_RATIO.id,
    category: SIGNALS.HIGH_COMMENT_RATIO.category,
    score: SIGNALS.HIGH_COMMENT_RATIO.defaultScore,
    confidence: 0.75,
    detail: `${Math.round(ratio * 100)}% of added lines are comments.`,
    evidence: `${Math.round(ratio * 100)}% comments`,
  };
}
