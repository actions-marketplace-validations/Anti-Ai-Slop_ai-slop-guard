import type { LLMAdapter, LLMConfig, LLMRequest, LLMResponse, LLMError } from '../types';
import { llmFetch, mapHttpError } from './base';

interface AnthropicMessage {
  readonly id: string;
  readonly content: Array<{ type: string; text: string }>;
  readonly model: string;
}

export class AnthropicAdapter implements LLMAdapter {
  readonly provider = 'anthropic' as const;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly timeoutMs: number;

  constructor(config: LLMConfig) {
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.model = config.model;
    this.apiKey = config.apiKey ?? '';
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
    this.timeoutMs = config.timeoutMs;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    let systemPrompt = request.systemPrompt;
    if (request.jsonMode) {
      systemPrompt += '\nRespond ONLY with a JSON object. No markdown, no explanation.';
    }

    const start = Date.now();
    const response = await llmFetch(
      `${this.baseUrl}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: request.userPrompt }],
        }),
      },
      'anthropic',
      this.timeoutMs,
    );

    if (!response.ok) {
      const body = await response.text();
      throw mapHttpError(response.status, body, 'anthropic');
    }

    const data = (await response.json()) as AnthropicMessage;
    const text = data.content?.[0]?.text ?? '';
    if (!text) {
      const err: LLMError = { code: 'invalid_response', message: 'Empty response', provider: 'anthropic' };
      throw err;
    }

    return { text, model: data.model, latencyMs: Date.now() - start };
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(!!this.apiKey);
  }
}
