import * as core from '@actions/core';
import type { Signal, PRContext } from '../types';
import { SIGNALS } from '../scoring/signals';
import { createLLMAdapter } from './factory';
import { buildSemanticPrompt, parseSemanticResponse } from './prompts';

/**
 * Run optional LLM-based semantic analysis.
 * Returns empty array if disabled, misconfigured, or on error.
 * @param ctx - PR context
 * @returns detected signals (0 or 1)
 */
export async function analyzeSemanticValue(
  ctx: PRContext,
): Promise<Signal[]> {
  if (!ctx.config.semanticAnalysis) return [];

  const adapterResult = createLLMAdapter(ctx.config.llm);
  if (adapterResult.isErr()) {
    core.warning(`Semantic analysis skipped: ${adapterResult.error.message}`);
    return [];
  }

  const adapter = adapterResult.value;

  // Health check (Ollama: verify running + model available)
  const healthy = await adapter.healthCheck();
  if (!healthy) {
    core.warning(`LLM provider "${adapter.provider}" is not available. Skipping semantic analysis.`);
    return [];
  }

  const diffText = ctx.diff.files
    .flatMap((f) => f.additions.map((l) => `+${l.content}`))
    .join('\n');

  const request = buildSemanticPrompt(diffText, ctx.title, ctx.body);

  try {
    const response = await adapter.complete(request);
    core.info(`Semantic analysis completed (${adapter.provider}/${response.model}, ${response.latencyMs}ms)`);

    const parsed = parseSemanticResponse(response.text);
    if (!parsed) {
      core.warning('Could not parse LLM response as JSON. Skipping.');
      return [];
    }

    if (parsed.is_cosmetic_only && !parsed.adds_functionality && !parsed.fixes_bug) {
      return [{
        id: SIGNALS.NO_FUNCTIONAL_VALUE.id,
        category: SIGNALS.NO_FUNCTIONAL_VALUE.category,
        score: SIGNALS.NO_FUNCTIONAL_VALUE.defaultScore,
        confidence: parsed.confidence,
        detail: parsed.reason || 'LLM determined no functional value.',
        evidence: `${adapter.provider}/${response.model} (${response.latencyMs}ms)`,
      }];
    }

    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
    core.warning(`Semantic analysis failed: ${message}`);
    return [];
  }
}
