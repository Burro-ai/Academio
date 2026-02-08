import { config } from '../config';
import { OllamaGenerateRequest, OllamaResponse } from '../types';
import { promptService } from './prompt.service';

/**
 * DeepSeek Cloud API response types (OpenAI-compatible)
 */
interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Model types for different use cases
 */
export type ModelType = 'reasoner' | 'chat';

/**
 * Unified AI Service supporting both DeepSeek Cloud API and Ollama
 */
class AIService {
  private provider: 'deepseek' | 'ollama';

  constructor() {
    this.provider = config.aiProvider;
    console.log(`[AI] Initialized with provider: ${this.provider}`);

    if (this.provider === 'deepseek' && !config.deepseek.apiKey) {
      console.warn('[AI] DeepSeek API key not configured, falling back to Ollama');
      this.provider = 'ollama';
    }
  }

  /**
   * Get the model name based on the model type
   * - 'reasoner': deepseek-reasoner (higher reasoning, slower)
   * - 'chat': deepseek-chat (faster, lower cost)
   */
  private getModelName(modelType: ModelType = 'chat'): string {
    if (this.provider === 'ollama') {
      return config.ollama.model;
    }

    // For DeepSeek cloud
    if (modelType === 'reasoner') {
      return 'deepseek-reasoner';
    }
    return 'deepseek-chat';
  }

  /**
   * Generate a streaming response
   * Automatically uses the configured provider (DeepSeek cloud or Ollama)
   * @param prompt - The user prompt
   * @param context - Optional Ollama context for multi-turn
   * @param systemPrompt - Optional custom system prompt
   * @param modelType - 'reasoner' for complex tasks, 'chat' for speed (default)
   */
  async *generateStream(
    prompt: string,
    context?: number[],
    systemPrompt?: string,
    modelType: ModelType = 'chat'
  ): AsyncGenerator<{ text: string; done: boolean; context?: number[] }> {
    const finalSystemPrompt = systemPrompt || await promptService.getPrompt();

    if (this.provider === 'deepseek') {
      yield* this.deepseekStream(prompt, finalSystemPrompt, modelType);
    } else {
      yield* this.ollamaStream(prompt, context, finalSystemPrompt);
    }
  }

  /**
   * Non-streaming generation
   * @param prompt - The user prompt
   * @param context - Optional Ollama context for multi-turn
   * @param systemPrompt - Optional custom system prompt
   * @param modelType - 'reasoner' for complex tasks, 'chat' for speed (default)
   */
  async generate(
    prompt: string,
    context?: number[],
    systemPrompt?: string,
    modelType: ModelType = 'chat'
  ): Promise<string> {
    const finalSystemPrompt = systemPrompt || await promptService.getPrompt();

    if (this.provider === 'deepseek') {
      return this.deepseekGenerate(prompt, finalSystemPrompt, modelType);
    } else {
      return this.ollamaGenerate(prompt, context, finalSystemPrompt);
    }
  }

  // ============================================================
  // DeepSeek Cloud API Implementation (OpenAI-compatible)
  // ============================================================

  private async *deepseekStream(
    prompt: string,
    systemPrompt: string,
    modelType: ModelType = 'chat'
  ): AsyncGenerator<{ text: string; done: boolean }> {
    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    const model = this.getModelName(modelType);
    console.log(`[AI] DeepSeek streaming request to ${model}`);

    const response = await fetch(`${config.deepseek.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.deepseek.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI] DeepSeek API error:', response.status, errorText);
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              yield { text: '', done: true };
              return;
            }

            try {
              const chunk: DeepSeekStreamChunk = JSON.parse(data);
              const content = chunk.choices[0]?.delta?.content || '';

              if (content) {
                yield { text: content, done: false };
              }

              if (chunk.choices[0]?.finish_reason === 'stop') {
                yield { text: '', done: true };
                return;
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { text: '', done: true };
  }

  private async deepseekGenerate(
    prompt: string,
    systemPrompt: string,
    modelType: ModelType = 'chat'
  ): Promise<string> {
    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    const model = this.getModelName(modelType);
    console.log(`[AI] DeepSeek non-streaming request to ${model}`);
    const startTime = Date.now();

    const response = await fetch(`${config.deepseek.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.deepseek.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI] DeepSeek API error:', response.status, errorText);
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as DeepSeekResponse;
    const content = data.choices[0]?.message?.content || '';

    const elapsed = Date.now() - startTime;
    console.log(`[AI] DeepSeek response received in ${elapsed}ms (${data.usage?.total_tokens || 0} tokens)`);

    return content;
  }

  // ============================================================
  // Ollama Implementation (Local)
  // ============================================================

  private async *ollamaStream(
    prompt: string,
    context: number[] | undefined,
    systemPrompt: string
  ): AsyncGenerator<{ text: string; done: boolean; context?: number[] }> {
    const requestBody: OllamaGenerateRequest = {
      model: config.ollama.model,
      prompt,
      system: systemPrompt,
      stream: true,
      context,
      options: {
        temperature: 0.7,
        top_p: 0.9,
      },
    };

    console.log(`[AI] Ollama streaming request to ${config.ollama.model}`);

    const response = await fetch(`${config.ollama.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed: OllamaResponse = JSON.parse(line);
              yield {
                text: parsed.response,
                done: parsed.done,
                context: parsed.context,
              };
            } catch (e) {
              console.error('Failed to parse Ollama response:', line);
            }
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed: OllamaResponse = JSON.parse(buffer);
          yield {
            text: parsed.response,
            done: parsed.done,
            context: parsed.context,
          };
        } catch (e) {
          console.error('Failed to parse final buffer:', buffer);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async ollamaGenerate(
    prompt: string,
    context: number[] | undefined,
    systemPrompt: string
  ): Promise<string> {
    let fullResponse = '';

    for await (const chunk of this.ollamaStream(prompt, context, systemPrompt)) {
      fullResponse += chunk.text;
    }

    return fullResponse;
  }

  // ============================================================
  // Health Check
  // ============================================================

  async healthCheck(): Promise<{ ok: boolean; provider: string; error?: string }> {
    if (this.provider === 'deepseek') {
      return this.deepseekHealthCheck();
    } else {
      return this.ollamaHealthCheck();
    }
  }

  private async deepseekHealthCheck(): Promise<{ ok: boolean; provider: string; error?: string }> {
    if (!config.deepseek.apiKey) {
      return { ok: false, provider: 'deepseek', error: 'API key not configured' };
    }

    try {
      // Simple test request
      const response = await fetch(`${config.deepseek.apiUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${config.deepseek.apiKey}`,
        },
      });

      if (!response.ok) {
        return { ok: false, provider: 'deepseek', error: `API returned ${response.status}` };
      }

      return { ok: true, provider: 'deepseek' };
    } catch (error) {
      return {
        ok: false,
        provider: 'deepseek',
        error: `Cannot connect to DeepSeek API: ${error}`,
      };
    }
  }

  private async ollamaHealthCheck(): Promise<{ ok: boolean; provider: string; error?: string }> {
    try {
      const response = await fetch(`${config.ollama.baseUrl}/api/tags`);
      if (!response.ok) {
        return { ok: false, provider: 'ollama', error: 'Ollama not responding' };
      }

      const data = await response.json() as { models?: { name: string }[] };
      const models = data.models || [];
      const hasModel = models.some(
        (m: { name: string }) =>
          m.name === config.ollama.model || m.name.startsWith(config.ollama.model.split(':')[0])
      );

      if (!hasModel) {
        return {
          ok: false,
          provider: 'ollama',
          error: `Model ${config.ollama.model} not found. Available: ${models.map((m: { name: string }) => m.name).join(', ')}`,
        };
      }

      return { ok: true, provider: 'ollama' };
    } catch (error) {
      return {
        ok: false,
        provider: 'ollama',
        error: `Cannot connect to Ollama at ${config.ollama.baseUrl}`,
      };
    }
  }
}

// Export singleton instance (keep name for backward compatibility)
export const ollamaService = new AIService();
