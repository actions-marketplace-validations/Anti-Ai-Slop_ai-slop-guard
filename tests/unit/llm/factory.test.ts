import { describe, it, expect } from 'vitest';
import { createLLMAdapter } from '@/llm/factory';
import type { LLMConfig } from '@/llm/types';

function makeConfig(overrides: Partial<LLMConfig> = {}): LLMConfig {
  return {
    provider: 'ollama',
    model: 'test-model',
    maxTokens: 1024,
    temperature: 0.1,
    timeoutMs: 60000,
    ...overrides,
  };
}

describe('createLLMAdapter', () => {
  it('returns OllamaAdapter for ollama provider', () => {
    const result = createLLMAdapter(makeConfig({ provider: 'ollama' }));
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.provider).toBe('ollama');
    }
  });

  it('returns AnthropicAdapter for anthropic provider with apiKey', () => {
    const result = createLLMAdapter(makeConfig({ provider: 'anthropic', apiKey: 'sk-test' }));
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.provider).toBe('anthropic');
    }
  });

  it('returns OpenAICompatAdapter for openai provider with apiKey', () => {
    const result = createLLMAdapter(makeConfig({ provider: 'openai', apiKey: 'sk-test' }));
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.provider).toBe('openai');
    }
  });

  it('returns OpenAICompatAdapter for openrouter with apiKey', () => {
    const result = createLLMAdapter(makeConfig({ provider: 'openrouter', apiKey: 'sk-test' }));
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.provider).toBe('openrouter');
    }
  });

  it('returns OpenAICompatAdapter for custom with baseUrl', () => {
    const result = createLLMAdapter(makeConfig({ provider: 'custom', baseUrl: 'http://localhost:8000' }));
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.provider).toBe('custom');
    }
  });

  it('returns error when model is empty', () => {
    const result = createLLMAdapter(makeConfig({ model: '' }));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('missing_config');
      expect(result.error.message).toContain('llm-model');
    }
  });

  it('returns error for anthropic without apiKey', () => {
    const result = createLLMAdapter(makeConfig({ provider: 'anthropic' }));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('missing_config');
      expect(result.error.message).toContain('api-key');
    }
  });

  it('returns error for openai without apiKey', () => {
    const result = createLLMAdapter(makeConfig({ provider: 'openai' }));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('missing_config');
    }
  });

  it('returns error for openrouter without apiKey', () => {
    const result = createLLMAdapter(makeConfig({ provider: 'openrouter' }));
    expect(result.isErr()).toBe(true);
  });

  it('returns error for custom without baseUrl', () => {
    const result = createLLMAdapter(makeConfig({ provider: 'custom' }));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('missing_config');
      expect(result.error.message).toContain('base-url');
    }
  });

  it('allows custom without apiKey (local server)', () => {
    const result = createLLMAdapter(makeConfig({
      provider: 'custom',
      baseUrl: 'http://localhost:8000',
    }));
    expect(result.isOk()).toBe(true);
  });
});
