import * as core from '@actions/core';
import type { LLMError, LLMProvider, LLMErrorCode } from '../types';

/**
 * Map HTTP status to LLMError.
 */
export function mapHttpError(
  status: number,
  body: string,
  provider: LLMProvider,
): LLMError {
  let code: LLMErrorCode;
  if (status === 401 || status === 403) code = 'auth_failed';
  else if (status === 429) code = 'rate_limited';
  else if (status === 404) code = 'model_not_found';
  else code = 'server_error';

  return { code, message: `HTTP ${status}: ${body.slice(0, 200)}`, provider };
}

/**
 * Fetch with timeout and retry logic.
 */
export async function llmFetch(
  url: string,
  init: RequestInit,
  provider: LLMProvider,
  timeoutMs: number,
  maxRetries: number = 2,
): Promise<Response> {
  const hostname = new URL(url).hostname;
  core.debug(`LLM request to ${hostname}`);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Retry on 429 and 5xx
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === 'AbortError') {
        const err: LLMError = { code: 'timeout', message: `Request timed out after ${timeoutMs}ms`, provider };
        throw err;
      }
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  const err: LLMError = {
    code: 'connection_failed',
    message: lastError?.message ?? 'Connection failed',
    provider,
  };
  throw err;
}
