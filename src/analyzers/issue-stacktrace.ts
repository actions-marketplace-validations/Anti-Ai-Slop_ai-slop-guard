import * as core from '@actions/core';
import type { Signal, IssueContext, StackFrame } from '../types';
import { SIGNALS } from '../scoring/signals';
import { parseStackTrace } from '../parsers/stacktrace-parser';

/**
 * Analyze stack traces in issue body for hallucinated references.
 * @param ctx - Issue analysis context
 * @returns array of detected signals
 */
export async function analyzeIssueStackTrace(
  ctx: IssueContext,
): Promise<Signal[]> {
  const signals: Signal[] = [];
  const frames = parseStackTrace(ctx.body);

  if (frames.length === 0) return signals;

  const checks: Array<() => Signal | null> = [
    () => checkHallucinatedFiles(frames, ctx.repoFiles),
    () => checkHallucinatedFunctions(frames, ctx.repoFileContents),
    () => checkHallucinatedLines(frames, ctx.repoFileContents),
  ];

  for (const check of checks) {
    try {
      const result = check();
      if (result) signals.push(result);
    } catch (err) {
      core.warning(`issue-stacktrace check failed: ${String(err)}`);
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkHallucinatedFiles(
  frames: readonly StackFrame[],
  repoFiles: readonly string[],
): Signal | null {
  if (repoFiles.length === 0) return null;

  const repoFileSet = new Set(repoFiles.map((f) => f.toLowerCase()));

  const hallucinatedFrames = frames.filter((frame) => {
    const normalized = frame.filePath.toLowerCase();
    if (
      normalized.includes('node_modules') ||
      normalized.includes('site-packages') ||
      normalized.startsWith('<')
    ) {
      return false;
    }
    return !repoFileSet.has(normalized);
  });

  if (hallucinatedFrames.length === 0) return null;

  return {
    id: SIGNALS.HALLUCINATED_FILE.id,
    category: SIGNALS.HALLUCINATED_FILE.category,
    score: SIGNALS.HALLUCINATED_FILE.defaultScore,
    confidence: Math.min(0.7 + hallucinatedFrames.length * 0.15, 1.0),
    detail: `Stack trace references ${hallucinatedFrames.length} file(s) not found in the repo.`,
    evidence: hallucinatedFrames
      .slice(0, 3)
      .map((f) => f.filePath)
      .join(', '),
  };
}

/**
 * Check if functions referenced in stack frames exist in the files.
 */
function checkHallucinatedFunctions(
  frames: readonly StackFrame[],
  repoFileContents: ReadonlyMap<string, string>,
): Signal | null {
  if (repoFileContents.size === 0) return null;

  const hallucinated: StackFrame[] = [];

  for (const frame of frames) {
    if (!frame.functionName) continue;

    const content = repoFileContents.get(frame.filePath);
    if (!content) continue;

    const fnName = frame.functionName.split('.').pop();
    if (!fnName || fnName.length < 2) continue;

    const pattern = new RegExp(`\\b${escapeRegex(fnName)}\\b`);
    if (!pattern.test(content)) {
      hallucinated.push(frame);
    }
  }

  if (hallucinated.length === 0) return null;

  return {
    id: SIGNALS.HALLUCINATED_FUNCTION.id,
    category: SIGNALS.HALLUCINATED_FUNCTION.category,
    score: SIGNALS.HALLUCINATED_FUNCTION.defaultScore,
    confidence: 0.85,
    detail: `${hallucinated.length} function(s) not found in referenced file(s).`,
    evidence: hallucinated
      .slice(0, 3)
      .map((f) => `${f.functionName ?? ''} in ${f.filePath}`)
      .join(', '),
  };
}

/**
 * Check if line numbers exceed actual file lengths.
 * Falls back to a high threshold when file contents are unavailable.
 */
function checkHallucinatedLines(
  frames: readonly StackFrame[],
  repoFileContents: ReadonlyMap<string, string>,
): Signal | null {
  const hallucinated: StackFrame[] = [];
  let usedFileContents = false;

  for (const frame of frames) {
    if (frame.lineNumber <= 0) continue;

    const content = repoFileContents.get(frame.filePath);
    if (content) {
      usedFileContents = true;
      const lineCount = content.split('\n').length;
      if (frame.lineNumber > lineCount) {
        hallucinated.push(frame);
      }
    } else if (frame.lineNumber > 5_000) {
      hallucinated.push(frame);
    }
  }

  if (hallucinated.length === 0) return null;

  return {
    id: SIGNALS.HALLUCINATED_LINE.id,
    category: SIGNALS.HALLUCINATED_LINE.category,
    score: SIGNALS.HALLUCINATED_LINE.defaultScore,
    confidence: usedFileContents ? 0.9 : 0.5,
    detail: `Stack trace references line number(s) beyond file length.`,
    evidence: hallucinated
      .slice(0, 3)
      .map((f) => `${f.filePath}:${f.lineNumber}`)
      .join(', '),
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
