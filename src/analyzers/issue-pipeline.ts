import type { Signal, IssueContext } from '../types';
import { analyzeIssueContent } from './issue-content';
import { analyzeIssueStackTrace } from './issue-stacktrace';
import { detectDuplicates } from './duplicate-detector';

/**
 * Run all issue analyzers in parallel. Failures in one analyzer
 * do not block others (uses Promise.allSettled).
 * @param ctx - Issue analysis context
 * @returns flattened array of all detected signals
 */
export async function runIssuePipeline(
  ctx: IssueContext,
): Promise<Signal[]> {
  const results = await Promise.allSettled([
    analyzeIssueContent(ctx),
    analyzeIssueStackTrace(ctx),
    detectDuplicates(ctx),
  ]);

  return results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : [],
  );
}
