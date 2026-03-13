import { config } from '../config';
import { OllamaGenerateRequest, OllamaResponse, MaterialType, TeacherChatMessage } from '../types';
import { promptManager, TeacherFunction } from './promptManager.service';

// Maps MaterialType → TeacherFunction for PromptManager
const MATERIAL_TO_FUNCTION: Partial<Record<MaterialType, TeacherFunction>> = {
  lesson:       'lesson_planner',
  test:         'grading_assistant',
  homework:     'grading_assistant',
  presentation: 'lesson_planner',
  general:      'general',
};

class TeacherAssistantService {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.ollama.baseUrl;
    this.model = config.ollama.model;
  }

  /**
   * Get the teacher system prompt via PromptManager.
   * Falls back to the general identity if no materialType is provided.
   */
  async getSystemPrompt(materialType?: MaterialType): Promise<string> {
    const fn = materialType ? (MATERIAL_TO_FUNCTION[materialType] ?? 'general') : undefined;
    return promptManager.getTeacherBasePrompt({ function: fn });
  }

  /**
   * Build conversation context for the LLM
   */
  buildPrompt(messages: TeacherChatMessage[], newMessage: string, _materialType?: MaterialType): string {
    let prompt = '';

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
    context?: number[],
    materialType?: MaterialType
  ): AsyncGenerator<{ text: string; done: boolean; context?: number[] }> {
    const systemPrompt = await this.getSystemPrompt(materialType);

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
