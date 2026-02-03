import { config } from '../config';
import { OllamaGenerateRequest, OllamaResponse } from '../types';
import { promptService } from './prompt.service';

class OllamaService {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.ollama.baseUrl;
    this.model = config.ollama.model;
  }

  /**
   * Generate a streaming response from Ollama/DeepSeek
   * Yields chunks of text as they arrive
   */
  async *generateStream(
    prompt: string,
    context?: number[]
  ): AsyncGenerator<{ text: string; done: boolean; context?: number[] }> {
    const systemPrompt = await promptService.getPrompt();

    const requestBody: OllamaGenerateRequest = {
      model: this.model,
      prompt,
      system: systemPrompt,
      stream: true,
      context,
      options: {
        temperature: 0.7,
        top_p: 0.9,
      },
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
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

        // Process complete JSON lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

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

      // Process any remaining buffer
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

  /**
   * Non-streaming generation (for simple use cases)
   */
  async generate(prompt: string, context?: number[]): Promise<string> {
    let fullResponse = '';
    let finalContext: number[] | undefined;

    for await (const chunk of this.generateStream(prompt, context)) {
      fullResponse += chunk.text;
      if (chunk.context) {
        finalContext = chunk.context;
      }
    }

    return fullResponse;
  }

  /**
   * Check if Ollama is running and the model is available
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return { ok: false, error: 'Ollama not responding' };
      }

      const data = await response.json();
      const models = data.models || [];
      const hasModel = models.some(
        (m: { name: string }) =>
          m.name === this.model || m.name.startsWith(this.model.split(':')[0])
      );

      if (!hasModel) {
        return {
          ok: false,
          error: `Model ${this.model} not found. Available: ${models.map((m: { name: string }) => m.name).join(', ')}`,
        };
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: `Cannot connect to Ollama at ${this.baseUrl}`,
      };
    }
  }
}

export const ollamaService = new OllamaService();
