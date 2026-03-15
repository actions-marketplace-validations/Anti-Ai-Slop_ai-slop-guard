import type { Signal, PRContext } from '../types';
import { analyzePrDiff } from './pr-diff';
import { analyzePrDescription } from './pr-description';
import { analyzePrCommits } from './pr-commits';
import { analyzePrMetadata } from './pr-metadata';
import { analyzeSemanticValue } from '../llm/analyzer';

/**
 * Run all PR analyzers in parallel. Failures in one analyzer
 * do not block others (uses Promise.allSettled).
 * Optional semantic analysis is included when enabled.
 * @param ctx - PR analysis context
 * @returns flattened array of all detected signals
 */
export async function runPrPipeline(ctx: PRContext): Promise<Signal[]> {
  const analyzers: Array<Promise<Signal[]>> = [
    analyzePrDiff(ctx),
    analyzePrDescription(ctx),
    analyzePrCommits(ctx),
    analyzePrMetadata(ctx),
  ];

  if (ctx.config.semanticAnalysis) {
    analyzers.push(analyzeSemanticValue(ctx));
  }

  const results = await Promise.allSettled(analyzers);

  return results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : [],
  );
}
