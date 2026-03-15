/** Supported LLM providers */
export type LLMProvider =
  | 'ollama'
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'custom';

/** LLM configuration resolved from action inputs */
export interface LLMConfig {
  readonly provider: LLMProvider;
  readonly model: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly timeoutMs: number;
}

/** Request to an LLM adapter */
export interface LLMRequest {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly jsonMode: boolean;
}

/** Response from an LLM adapter */
export interface LLMResponse {
  readonly text: string;
  readonly model: string;
  readonly latencyMs: number;
}

/** Error codes for LLM operations */
export type LLMErrorCode =
  | 'missing_config'
  | 'auth_failed'
  | 'rate_limited'
  | 'model_not_found'
  | 'server_error'
  | 'timeout'
  | 'invalid_response'
  | 'connection_failed';

/** Structured LLM error */
export interface LLMError {
  readonly code: LLMErrorCode;
  readonly message: string;
  readonly provider: LLMProvider;
}

/** Adapter interface all providers implement */
export interface LLMAdapter {
  readonly provider: LLMProvider;
  complete(request: LLMRequest): Promise<LLMResponse>;
  healthCheck(): Promise<boolean>;
}
