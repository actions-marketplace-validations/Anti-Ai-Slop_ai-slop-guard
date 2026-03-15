import * as core from '@actions/core';
import type { LLMAdapter, LLMConfig, LLMRequest, LLMResponse, LLMError } from '../types';
import { llmFetch, mapHttpError } from './base';

interface OllamaGenerateResponse {
  readonly response: string;
  readonly model: string;
  readonly done: boolean;
}

export class OllamaAdapter implements LLMAdapter {
  readonly provider = 'ollama' as const;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly temperature: number;

  constructor(config: LLMConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
    this.temperature = config.temperature;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const prompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.userPrompt}`
      : request.userPrompt;

    const start = Date.now();
    const response = await llmFetch(
      `${this.baseUrl}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: { temperature: this.temperature },
        }),
      },
      'ollama',
      this.timeoutMs,
    );

    if (!response.ok) {
      const body = await response.text();
      throw mapHttpError(response.status, body, 'ollama');
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    if (!data.response) {
      const err: LLMError = { code: 'invalid_response', message: 'Empty response from Ollama', provider: 'ollama' };
      throw err;
    }

    return { text: data.response, model: data.model, latencyMs: Date.now() - start };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await llmFetch(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        'ollama',
        5000,
        0,
      );
      if (!response.ok) return false;

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const available = (data.models ?? []).map((m) => m.name);

      if (available.length > 0 && !available.some((n) => n.startsWith(this.model))) {
        core.warning(
          `Model "${this.model}" not found locally. Available: ${available.join(', ')}. Run: ollama pull ${this.model}`,
        );
      }

      return true;
    } catch {
      return false;
    }
  }
}
