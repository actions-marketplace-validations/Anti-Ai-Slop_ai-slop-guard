import { truncate } from '../utils/text-utils';
import type { LLMRequest } from './types';

const MAX_DIFF_LENGTH = 4000;
const MAX_BODY_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;

/**
 * Build a semantic analysis prompt for any LLM provider.
 * @param diff - raw diff text
 * @param prTitle - PR title
 * @param prBody - PR description body
 * @returns LLMRequest ready for any adapter
 */
export function buildSemanticPrompt(
  diff: string,
  prTitle: string,
  prBody: string,
): LLMRequest {
  return {
    systemPrompt:
      'You are a senior code reviewer. Determine if a pull request adds real functional value ' +
      'or is a low-quality cosmetic dump. Respond ONLY with a JSON object, no markdown, ' +
      'no explanation, no code fences.',
    userPrompt:
      `PR title: ${truncate(prTitle, MAX_TITLE_LENGTH)}\n` +
      `Description: ${truncate(prBody, MAX_BODY_LENGTH)}\n\n` +
      `Diff (first ${MAX_DIFF_LENGTH} chars):\n${truncate(diff, MAX_DIFF_LENGTH)}\n\n` +
      'Respond:\n' +
      '{"adds_functionality": bool, "fixes_bug": bool, "is_cosmetic_only": bool, "confidence": 0.0-1.0, "reason": "max 20 words"}',
    jsonMode: true,
  };
}

/** Expected shape of the LLM's JSON response */
export interface SemanticAnalysisResult {
  readonly adds_functionality: boolean;
  readonly fixes_bug: boolean;
  readonly is_cosmetic_only: boolean;
  readonly confidence: number;
  readonly reason: string;
}

/**
 * Try to parse the LLM response as SemanticAnalysisResult.
 * @param raw - raw LLM output string
 * @returns parsed result or null if invalid
 */
export function parseSemanticResponse(
  raw: string,
): SemanticAnalysisResult | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (
      typeof parsed['adds_functionality'] !== 'boolean' ||
      typeof parsed['confidence'] !== 'number'
    ) {
      return null;
    }

    return {
      adds_functionality: Boolean(parsed['adds_functionality']),
      fixes_bug: Boolean(parsed['fixes_bug'] ?? false),
      is_cosmetic_only: Boolean(parsed['is_cosmetic_only'] ?? false),
      confidence: Math.min(Math.max(Number(parsed['confidence']), 0), 1),
      reason: String(parsed['reason'] ?? ''),
    };
  } catch {
    return null;
  }
}
