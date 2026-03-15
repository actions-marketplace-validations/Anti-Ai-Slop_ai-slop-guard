import * as core from '@actions/core';
import type {
  DiffData,
  DiffFile,
  DiffFileStatus,
  DiffHunk,
  DiffLine,
} from '../types';
import { detectLanguage, isTestFile, isConfigFile } from '../utils/language-detect';

const MAX_LINES = 10_000;

/**
 * Parse a unified diff string into structured DiffData.
 * Uses a line-by-line state machine to handle all diff formats.
 * @param raw - raw unified diff from GitHub API
 */
export function parseDiff(raw: string): DiffData {
  const lines = raw.split('\n');
  const truncated = lines.length > MAX_LINES;

  if (truncated) {
    core.warning(`Diff truncated from ${lines.length} to ${MAX_LINES} lines`);
    lines.length = MAX_LINES;
  }

  const files: DiffFile[] = [];
  let currentFile: MutableDiffFile | null = null;
  let currentHunk: MutableDiffHunk | null = null;
  let newLineNum = 0;
  let oldLineNum = 0;

  for (const line of lines) {
    // New file header
    if (line.startsWith('diff --git ')) {
      if (currentFile) {
        finalizeFile(currentFile, currentHunk);
        files.push(freezeFile(currentFile));
      }
      currentFile = createEmptyFile();
      currentHunk = null;
      continue;
    }

    if (!currentFile) continue;

    // Binary file
    if (line.startsWith('Binary files ') && line.includes(' differ')) {
      currentFile.isBinary = true;
      continue;
    }

    // Rename detection
    if (line.startsWith('rename from ')) {
      currentFile.oldPath = line.slice('rename from '.length);
      currentFile.status = 'renamed';
      continue;
    }
    if (line.startsWith('rename to ')) {
      currentFile.newPath = line.slice('rename to '.length);
      continue;
    }

    // Old file path
    if (line.startsWith('--- ')) {
      const path = line.slice(4);
      if (path === '/dev/null') {
        currentFile.status = 'added';
      } else {
        currentFile.oldPath = path.replace(/^[ab]\//, '');
      }
      continue;
    }

    // New file path
    if (line.startsWith('+++ ')) {
      const path = line.slice(4);
      if (path === '/dev/null') {
        currentFile.status = 'deleted';
      } else {
        currentFile.newPath = path.replace(/^[ab]\//, '');
      }
      continue;
    }

    // Hunk header
    const hunkMatch = line.match(
      /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/,
    );
    if (hunkMatch) {
      if (currentHunk) {
        currentFile.hunks.push(freezeHunk(currentHunk));
      }
      oldLineNum = Number.parseInt(hunkMatch[1] ?? '0', 10);
      newLineNum = Number.parseInt(hunkMatch[3] ?? '0', 10);
      currentHunk = {
        oldStart: oldLineNum,
        oldCount: Number.parseInt(hunkMatch[2] ?? '0', 10),
        newStart: newLineNum,
        newCount: Number.parseInt(hunkMatch[4] ?? '0', 10),
        additions: [],
        deletions: [],
        context: [],
      };
      continue;
    }

    if (!currentHunk) continue;

    // Addition
    if (line.startsWith('+')) {
      const diffLine: DiffLine = {
        lineNumber: newLineNum,
        content: line.slice(1),
      };
      currentHunk.additions.push(diffLine);
      currentFile.additions.push(diffLine);
      newLineNum++;
      continue;
    }

    // Deletion
    if (line.startsWith('-')) {
      const diffLine: DiffLine = {
        lineNumber: oldLineNum,
        content: line.slice(1),
      };
      currentHunk.deletions.push(diffLine);
      currentFile.deletions.push(diffLine);
      oldLineNum++;
      continue;
    }

    // Context line
    if (line.startsWith(' ')) {
      currentHunk.context.push({
        lineNumber: newLineNum,
        content: line.slice(1),
      });
      newLineNum++;
      oldLineNum++;
    }
  }

  // Finalize last file
  if (currentFile) {
    finalizeFile(currentFile, currentHunk);
    files.push(freezeFile(currentFile));
  }

  const totalAdditions = files.reduce((s, f) => s + f.additions.length, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions.length, 0);

  return {
    files,
    totalAdditions,
    totalDeletions,
    totalFilesChanged: files.length,
    truncated,
  };
}

// ---------------------------------------------------------------------------
// Internal mutable types for building during parse
// ---------------------------------------------------------------------------

interface MutableDiffFile {
  oldPath: string;
  newPath: string;
  status: DiffFileStatus;
  isBinary: boolean;
  hunks: DiffHunk[];
  additions: DiffLine[];
  deletions: DiffLine[];
}

interface MutableDiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  additions: DiffLine[];
  deletions: DiffLine[];
  context: DiffLine[];
}

function createEmptyFile(): MutableDiffFile {
  return {
    oldPath: '',
    newPath: '',
    status: 'modified',
    isBinary: false,
    hunks: [],
    additions: [],
    deletions: [],
  };
}

function finalizeFile(
  file: MutableDiffFile,
  lastHunk: MutableDiffHunk | null,
): void {
  if (lastHunk) {
    file.hunks.push(freezeHunk(lastHunk));
  }
}

function freezeHunk(hunk: MutableDiffHunk): DiffHunk {
  return {
    oldStart: hunk.oldStart,
    oldCount: hunk.oldCount,
    newStart: hunk.newStart,
    newCount: hunk.newCount,
    additions: hunk.additions,
    deletions: hunk.deletions,
    context: hunk.context,
  };
}

function freezeFile(file: MutableDiffFile): DiffFile {
  const path = file.newPath || file.oldPath;
  return {
    oldPath: file.oldPath,
    newPath: file.newPath,
    status: file.status,
    isBinary: file.isBinary,
    language: detectLanguage(path),
    isTest: isTestFile(path),
    isConfig: isConfigFile(path),
    hunks: file.hunks,
    additions: file.additions,
    deletions: file.deletions,
  };
}
