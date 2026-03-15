import { ok, err, type Result } from 'neverthrow';
import type { LLMAdapter, LLMConfig, LLMError } from './types';
import { OllamaAdapter } from './adapters/ollama';
import { AnthropicAdapter } from './adapters/anthropic';
import { OpenAICompatAdapter } from './adapters/openai-compat';

/**
 * Create an LLM adapter from configuration.
 * Validates config and returns the appropriate adapter.
 * @param config - LLM configuration
 * @returns Result with adapter or validation error
 */
export function createLLMAdapter(
  config: LLMConfig,
): Result<LLMAdapter, LLMError> {
  if (!config.model) {
    return err({
      code: 'missing_config',
      message:
        'llm-model is required when semantic-analysis is true. ' +
        'Examples: qwen2.5-coder:7b, claude-sonnet-4-20250514, gpt-4o-mini',
      provider: config.provider,
    });
  }

  switch (config.provider) {
    case 'ollama':
      return ok(new OllamaAdapter(config));

    case 'anthropic':
      if (!config.apiKey) {
        return err({
          code: 'missing_config',
          message: 'llm-api-key is required for Anthropic provider.',
          provider: 'anthropic',
        });
      }
      return ok(new AnthropicAdapter(config));

    case 'openai':
      if (!config.apiKey) {
        return err({
          code: 'missing_config',
          message: 'llm-api-key is required for OpenAI provider.',
          provider: 'openai',
        });
      }
      return ok(new OpenAICompatAdapter(config, 'openai'));

    case 'openrouter':
      if (!config.apiKey) {
        return err({
          code: 'missing_config',
          message: 'llm-api-key is required for OpenRouter provider.',
          provider: 'openrouter',
        });
      }
      return ok(new OpenAICompatAdapter(config, 'openrouter'));

    case 'custom':
      if (!config.baseUrl) {
        return err({
          code: 'missing_config',
          message: 'llm-base-url is required for custom provider.',
          provider: 'custom',
        });
      }
      // API key is optional for custom (local servers without auth)
      return ok(new OpenAICompatAdapter(config, 'custom'));

    default:
      return err({
        code: 'missing_config',
        message: `Unknown LLM provider: ${config.provider as string}`,
        provider: config.provider,
      });
  }
}
