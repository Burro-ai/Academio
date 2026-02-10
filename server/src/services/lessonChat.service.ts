import { ollamaService } from './ollama.service';
import { lessonChatQueries, LessonChatMessage } from '../database/queries/lessonChat.queries';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { StudentProfile } from '../types';

/**
 * Lesson Chat Service
 * Provides AI-powered Socratic tutoring within the context of a specific lesson
 */
class LessonChatService {
  /**
   * Build the system prompt for lesson-contextualized tutoring
   * Combines the Socratic teaching methodology with lesson content and student personalization
   */
  buildSystemPrompt(lessonContent: string, studentProfile?: StudentProfile | null): string {
    let prompt = `You are a world-class Socratic Tutor. Your role is to help the student understand the lesson content through thoughtful questioning and guided discovery.

## PRIME DIRECTIVE
You must NEVER simply provide direct answers. Instead, guide the student to discover answers themselves through the Socratic method.

## Current Lesson Content
The student is studying the following lesson. Use this content as the foundation for your tutoring:

---
${lessonContent}
---

## Your Teaching Approach

1. **Reference the Lesson**: When the student asks questions, connect your guidance back to concepts in the lesson above.

2. **Ask Guiding Questions**: Respond with questions that help them think through the problem step by step.

3. **Break Down Complex Ideas**: Decompose difficult concepts into smaller, manageable pieces.

4. **Use Analogies**: Connect abstract concepts to familiar, everyday experiences.

5. **Encourage Always**: Maintain a warm, supportive, and patient tone.

6. **Check Understanding**: Ask students to explain their reasoning in their own words.

## Response Style

- Keep responses focused and not overwhelming
- Use simple, clear language
- Be encouraging even when correcting misconceptions
- Format mathematical expressions clearly
- Reference specific parts of the lesson when relevant

## What You Must NEVER Do

- Give direct answers to questions about the lesson
- Skip the questioning process
- Be condescending or impatient
- Provide information not related to the lesson content`;

    // Add student personalization if available
    if (studentProfile) {
      prompt += '\n\n## Student Context (Personalization)\n';

      if (studentProfile.age) {
        prompt += `- Student Age: ${studentProfile.age} years old\n`;
      }

      if (studentProfile.gradeLevel) {
        prompt += `- Grade Level: ${studentProfile.gradeLevel}\n`;
      }

      if (studentProfile.favoriteSports && studentProfile.favoriteSports.length > 0) {
        prompt += `- Interests/Activities: ${studentProfile.favoriteSports.join(', ')}\n`;
        prompt += `  (Use these to create relatable examples and analogies)\n`;
      }

      if (studentProfile.skillsToImprove && studentProfile.skillsToImprove.length > 0) {
        prompt += `- Skills to Improve: ${studentProfile.skillsToImprove.join(', ')}\n`;
        prompt += `  (Pay extra attention to helping with these areas)\n`;
      }

      if (studentProfile.learningSystemPrompt) {
        prompt += `\n## Student's Personal Learning Preferences\n`;
        prompt += studentProfile.learningSystemPrompt;
        prompt += '\n';
      }
    }

    return prompt;
  }

  /**
   * Build the conversation prompt from message history
   */
  buildConversationPrompt(messages: LessonChatMessage[], newMessage: string): string {
    let prompt = '';

    // Include conversation history
    for (const msg of messages) {
      if (msg.role === 'user') {
        prompt += `Student: ${msg.content}\n\n`;
      } else {
        prompt += `Tutor: ${msg.content}\n\n`;
      }
    }

    // Add the new message
    prompt += `Student: ${newMessage}\n\nTutor:`;

    return prompt;
  }

  /**
   * Stream a chat response for a lesson
   * @param personalizedLessonId - The personalized lesson ID
   * @param studentId - The student's user ID
   * @param message - The student's message
   */
  async *streamChat(
    personalizedLessonId: string,
    studentId: string,
    message: string
  ): AsyncGenerator<{
    type: 'start' | 'token' | 'done' | 'error';
    content?: string;
    sessionId?: string;
    userMessageId?: string;
    assistantMessageId?: string;
    error?: string;
  }> {
    try {
      // Get or create the chat session
      const session = lessonChatQueries.getOrCreateSession(personalizedLessonId, studentId);

      // Get the personalized lesson content
      const personalizedLessons = lessonsQueries.getPersonalizedByStudentId(studentId);
      const personalizedLesson = personalizedLessons.find(l => l.id === personalizedLessonId);

      if (!personalizedLesson) {
        yield {
          type: 'error',
          error: 'Lesson not found',
        };
        return;
      }

      // Get student profile for personalization
      const studentProfile = studentProfilesQueries.getByUserId(studentId);

      // Build system prompt with lesson context
      const systemPrompt = this.buildSystemPrompt(
        personalizedLesson.personalizedContent,
        studentProfile
      );

      // Get conversation history
      const history = lessonChatQueries.getRecentMessages(session.id, 10);

      // Save user message
      const userMessage = lessonChatQueries.createMessage(session.id, 'user', message);

      // Create placeholder for assistant message
      const assistantMessage = lessonChatQueries.createMessage(session.id, 'assistant', '');

      // Build conversation prompt
      const conversationPrompt = this.buildConversationPrompt(
        history.filter(m => m.id !== userMessage.id),
        message
      );

      // Send start event
      yield {
        type: 'start',
        sessionId: session.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      };

      let fullResponse = '';

      // Stream response from AI
      for await (const chunk of ollamaService.generateStream(conversationPrompt, undefined, systemPrompt)) {
        fullResponse += chunk.text;

        yield {
          type: 'token',
          content: chunk.text,
        };

        if (chunk.done) {
          break;
        }
      }

      // Save the complete response
      lessonChatQueries.updateMessageContent(assistantMessage.id, fullResponse);

      // Send completion event
      yield {
        type: 'done',
        assistantMessageId: assistantMessage.id,
      };
    } catch (error) {
      console.error('[LessonChat] Stream error:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to generate response',
      };
    }
  }

  /**
   * Get or create a lesson chat session
   */
  getOrCreateSession(personalizedLessonId: string, studentId: string) {
    return lessonChatQueries.getOrCreateSession(personalizedLessonId, studentId);
  }

  /**
   * Get all messages for a session
   */
  getSessionMessages(sessionId: string) {
    return lessonChatQueries.getMessages(sessionId);
  }

  /**
   * Get session by personalized lesson and student
   */
  getSession(personalizedLessonId: string, studentId: string) {
    return lessonChatQueries.getSession(personalizedLessonId, studentId);
  }

  /**
   * Get all lesson chat sessions for a student
   */
  getStudentSessions(studentId: string) {
    return lessonChatQueries.getSessionsByStudent(studentId);
  }

  /**
   * Get all lesson chat sessions for a teacher's lessons
   */
  getTeacherSessions(teacherId: string) {
    return lessonChatQueries.getSessionsForTeacher(teacherId);
  }

  /**
   * Get a specific student's lesson chats for a teacher
   */
  getStudentSessionsForTeacher(studentId: string, teacherId: string) {
    return lessonChatQueries.getStudentSessionsForTeacher(studentId, teacherId);
  }
}

export const lessonChatService = new LessonChatService();
