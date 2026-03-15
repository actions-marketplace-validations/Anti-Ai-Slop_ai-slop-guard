import type { LLMAdapter, LLMConfig, LLMRequest, LLMResponse, LLMError, LLMProvider } from '../types';
import { llmFetch, mapHttpError } from './base';

interface ChatCompletion {
  readonly choices: Array<{ message: { content: string } }>;
  readonly model: string;
}

export class OpenAICompatAdapter implements LLMAdapter {
  readonly provider: LLMProvider;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly timeoutMs: number;
  private readonly isOpenRouter: boolean;

  constructor(config: LLMConfig, provider: LLMProvider) {
    this.provider = provider;
    this.model = config.model;
    this.apiKey = config.apiKey ?? '';
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
    this.timeoutMs = config.timeoutMs;
    this.isOpenRouter = provider === 'openrouter';

    const defaults: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      custom: '',
    };
    this.baseUrl = config.baseUrl || defaults[provider] || '';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    if (this.isOpenRouter) {
      headers['HTTP-Referer'] = 'https://github.com/Anti-Ai-Slop/ai-slop-guard';
      headers['X-Title'] = 'ai-slop-guard';
    }

    let systemContent = request.systemPrompt;
    if (request.jsonMode) {
      systemContent += '\nRespond ONLY with a JSON object. No markdown, no explanation.';
    }

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: request.userPrompt },
      ],
    };

    if (request.jsonMode) {
      body['response_format'] = { type: 'json_object' };
    }

    const start = Date.now();
    let response = await llmFetch(
      `${this.baseUrl}/chat/completions`,
      { method: 'POST', headers, body: JSON.stringify(body) },
      this.provider,
      this.timeoutMs,
    );

    // Retry without response_format if unsupported (some providers 400 on it)
    if (!response.ok && response.status === 400 && request.jsonMode) {
      delete body['response_format'];
      response = await llmFetch(
        `${this.baseUrl}/chat/completions`,
        { method: 'POST', headers, body: JSON.stringify(body) },
        this.provider,
        this.timeoutMs,
      );
    }

    if (!response.ok) {
      const respBody = await response.text();
      throw mapHttpError(response.status, respBody, this.provider);
    }

    const data = (await response.json()) as ChatCompletion;
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) {
      const err: LLMError = { code: 'invalid_response', message: 'Empty response', provider: this.provider };
      throw err;
    }

    return { text, model: data.model ?? this.model, latencyMs: Date.now() - start };
  }

  healthCheck(): Promise<boolean> {
    if (this.provider === 'custom') return Promise.resolve(!!this.baseUrl);
    return Promise.resolve(!!this.apiKey);
  }
}
