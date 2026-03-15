import * as core from '@actions/core';
import { ok, err, type Result } from 'neverthrow';
import type { GuardConfig, ActionType } from '../types';
import type { LLMProvider, LLMConfig } from '../llm/types';

const VALID_ACTIONS: readonly ActionType[] = ['label', 'comment', 'close'];

/**
 * Parse a comma-separated string into ActionType[]
 * @param raw - comma-separated action names
 * @returns validated ActionType array
 */
function parseActions(raw: string): Result<readonly ActionType[], string> {
  if (!raw.trim()) return ok([]);

  const parts = raw.split(',').map((s) => s.trim().toLowerCase());
  const invalid = parts.filter(
    (p) => !VALID_ACTIONS.includes(p as ActionType),
  );

  if (invalid.length > 0) {
    return err(`Invalid actions: ${invalid.join(', ')}`);
  }

  return ok(parts as ActionType[]);
}

/**
 * Parse a comma-separated string into trimmed string[]
 */
function parseCommaSeparated(raw: string): readonly string[] {
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse a string as a positive integer with a fallback default
 */
function parsePositiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
}

/**
 * Resolve configuration from action.yml inputs.
 * Reads `core.getInput()` for each input and applies defaults.
 * @returns Result with resolved config or error message
 */
export function resolveConfig(): Result<GuardConfig, string> {
  const onWarnRaw = core.getInput('on-warn') || 'label,comment';
  const onCloseRaw = core.getInput('on-close') || 'label,comment,close';

  const onWarnResult = parseActions(onWarnRaw);
  if (onWarnResult.isErr()) {
    return err(`on-warn: ${onWarnResult.error}`);
  }

  const onCloseResult = parseActions(onCloseRaw);
  if (onCloseResult.isErr()) {
    return err(`on-close: ${onCloseResult.error}`);
  }

  const llmProvider = (core.getInput('llm-provider') || 'ollama') as LLMProvider;
  const llmModel = core.getInput('llm-model').trim()
    || core.getInput('ollama-model').trim()
    || '';
  const llmConfig: LLMConfig = {
    provider: llmProvider,
    model: llmModel,
    apiKey: core.getInput('llm-api-key') || undefined,
    baseUrl: core.getInput('llm-base-url') || undefined,
    maxTokens: parsePositiveInt(core.getInput('llm-max-tokens'), 1024),
    temperature: parseFloat(core.getInput('llm-temperature') || '0.1') || 0.1,
    timeoutMs: parsePositiveInt(core.getInput('llm-timeout'), 60000),
  };

  const config: GuardConfig = {
    checkPrs: core.getInput('check-prs') !== 'false',
    checkIssues: core.getInput('check-issues') !== 'false',
    slopScoreWarn: parsePositiveInt(core.getInput('slop-score-warn'), 6),
    slopScoreClose: parsePositiveInt(core.getInput('slop-score-close'), 12),
    onWarn: onWarnResult.value,
    onClose: onCloseResult.value,
    warnLabel: core.getInput('warn-label') || 'needs-review',
    slopLabel: core.getInput('slop-label') || 'likely-slop',
    semanticAnalysis: core.getInput('semantic-analysis') === 'true',
    ollamaModel: llmModel,
    llm: llmConfig,
    exemptUsers: parseCommaSeparated(core.getInput('exempt-users')),
    exemptLabels: parseCommaSeparated(core.getInput('exempt-labels')),
    blockedSourceBranches: parseCommaSeparated(
      core.getInput('blocked-source-branches') || 'main,master',
    ),
    honeypotTerms: parseCommaSeparated(core.getInput('honeypot-terms')),
    maxNegativeReactions: parsePositiveInt(
      core.getInput('max-negative-reactions'),
      3,
    ),
    checkLanguageMismatch:
      core.getInput('check-language-mismatch') !== 'false',
    contributorHistoryCheck:
      core.getInput('contributor-history-check') !== 'false',
    newContributorWeightMultiplier:
      parseFloat(core.getInput('new-contributor-weight-multiplier') || '1.5') || 1.5,
    gracePeriodHours: parsePositiveInt(
      core.getInput('grace-period-hours'),
      0,
    ),
  };

  if (config.slopScoreWarn >= config.slopScoreClose) {
    return err(
      `slop-score-warn (${config.slopScoreWarn}) must be less than slop-score-close (${config.slopScoreClose})`,
    );
  }

  return ok(config);
}
