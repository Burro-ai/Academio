import { config } from '../config';
import { OllamaGenerateRequest, OllamaResponse, MaterialType, TeacherChatMessage } from '../types';
import fs from 'fs';

class TeacherAssistantService {
  private baseUrl: string;
  private model: string;
  private systemPromptPath: string;

  constructor() {
    this.baseUrl = config.ollama.baseUrl;
    this.model = config.ollama.model;
    this.systemPromptPath = config.paths.teacherSystemPrompt;
  }

  /**
   * Get the teacher system prompt
   */
  async getSystemPrompt(): Promise<string> {
    try {
      return fs.readFileSync(this.systemPromptPath, 'utf-8');
    } catch {
      // Return default prompt if file doesn't exist
      return `You are an AI Teaching Assistant. Help teachers create educational materials including lesson plans, presentations, tests, and homework assignments. Be direct and provide complete, ready-to-use content.`;
    }
  }

  /**
   * Build conversation context for the LLM
   */
  buildPrompt(messages: TeacherChatMessage[], newMessage: string, materialType?: MaterialType): string {
    let prompt = '';

    // Add material type context if provided
    if (materialType && materialType !== 'general') {
      const typeContext: Record<MaterialType, string> = {
        lesson: 'The teacher is creating a lesson plan. Include objectives, activities, and time estimates.',
        presentation: 'The teacher is creating a presentation. Structure content with clear sections and key points.',
        test: 'The teacher is creating an assessment. Include various question types and an answer key.',
        homework: 'The teacher is creating homework. Include clear instructions and practice problems.',
        general: '',
      };
      prompt += `Context: ${typeContext[materialType]}\n\n`;
    }

    // Include conversation history
    for (const msg of messages) {
      if (msg.role === 'user') {
        prompt += `Teacher: ${msg.content}\n\n`;
      } else {
        prompt += `Assistant: ${msg.content}\n\n`;
      }
    }

    // Add the new message
    prompt += `Teacher: ${newMessage}\n\nAssistant:`;

    return prompt;
  }

  /**
   * Generate a streaming response for teacher chat
   */
  async *generateStream(
    prompt: string,
    context?: number[]
  ): AsyncGenerator<{ text: string; done: boolean; context?: number[] }> {
    const systemPrompt = await this.getSystemPrompt();

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

      // Process remaining buffer
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
   * Non-streaming generation
   */
  async generate(prompt: string, context?: number[]): Promise<string> {
    let fullResponse = '';

    for await (const chunk of this.generateStream(prompt, context)) {
      fullResponse += chunk.text;
    }

    return fullResponse;
  }

  /**
   * Generate a specific type of material
   */
  async generateMaterial(
    type: MaterialType,
    subject: string,
    gradeLevel: string,
    topic: string,
    additionalInstructions?: string
  ): Promise<string> {
    const templates: Record<MaterialType, string> = {
      lesson: `Create a comprehensive lesson plan for teaching ${topic} to ${gradeLevel} students in ${subject} class. Include learning objectives, materials needed, introduction, main activities, assessment, and closure.`,
      presentation: `Create an outline for a classroom presentation on ${topic} for ${gradeLevel} students studying ${subject}. Include key points, examples, and discussion questions.`,
      test: `Create a test on ${topic} for ${gradeLevel} students in ${subject}. Include a mix of question types (multiple choice, short answer, and essay). Provide an answer key.`,
      homework: `Create a homework assignment on ${topic} for ${gradeLevel} students in ${subject}. Include practice problems with varying difficulty levels.`,
      general: `Help me with ${topic} for my ${gradeLevel} ${subject} class.`,
    };

    let prompt = templates[type];
    if (additionalInstructions) {
      prompt += `\n\nAdditional requirements: ${additionalInstructions}`;
    }

    return this.generate(prompt);
  }
}

export const teacherAssistantService = new TeacherAssistantService();
