import { describe, it, expect } from 'vitest';
import { analyzeSemanticValue } from '@/llm/analyzer';
import { createMockPRContext, createEmptyDiff } from '../../helpers';

describe('analyzeSemanticValue', () => {
  it('returns empty when semanticAnalysis is false', async () => {
    const ctx = createMockPRContext({
      config: {
        ...createMockPRContext().config,
        semanticAnalysis: false,
      },
    });
    const signals = await analyzeSemanticValue(ctx);
    expect(signals).toEqual([]);
  });

  it('returns empty with warning when model is empty', async () => {
    const ctx = createMockPRContext({
      diff: createEmptyDiff(),
      config: {
        ...createMockPRContext().config,
        semanticAnalysis: true,
        llm: {
          provider: 'ollama',
          model: '',
          maxTokens: 1024,
          temperature: 0.1,
          timeoutMs: 5000,
        },
      },
    });
    const signals = await analyzeSemanticValue(ctx);
    expect(signals).toEqual([]);
  });

  it('returns empty when Ollama is not reachable', async () => {
    const ctx = createMockPRContext({
      diff: createEmptyDiff(),
      config: {
        ...createMockPRContext().config,
        semanticAnalysis: true,
        llm: {
          provider: 'ollama',
          model: 'test-model',
          baseUrl: 'http://localhost:99999',
          maxTokens: 1024,
          temperature: 0.1,
          timeoutMs: 1000,
        },
      },
    });
    const signals = await analyzeSemanticValue(ctx);
    expect(signals).toEqual([]);
  });
});
