import { ollamaService } from './ollama.service';
import { aiGatekeeper } from './aiGatekeeper.service';
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
    let prompt = `Eres un Tutor Socrático de clase mundial. Tu rol es ayudar al estudiante a comprender el contenido de la lección a través de preguntas bien pensadas y descubrimiento guiado.

## DIRECTIVA PRINCIPAL
NUNCA debes simplemente dar respuestas directas. En su lugar, guía al estudiante a descubrir las respuestas por sí mismo a través del método socrático.

## Contenido de la Lección Actual
El estudiante está estudiando la siguiente lección. Usa este contenido como base para tu tutoría:

---
${lessonContent}
---

## Tu Enfoque de Enseñanza

1. **Referencia la Lección**: Cuando el estudiante haga preguntas, conecta tu guía con los conceptos de la lección anterior.

2. **Haz Preguntas Orientadoras**: Responde con preguntas que les ayuden a pensar en el problema paso a paso.

3. **Descompón Ideas Complejas**: Divide conceptos difíciles en partes más pequeñas y manejables.

4. **Actualizate Rapido**: Cuando identifiques que el alumno se desespera porque es mucho mas avanzado, rapido adaptate a un nivel mas avanzado y responde directo lo que busca.


6. **Siempre Alienta**: Mantén un tono cálido, solidario y paciente.

7. **Verifica la Comprensión**: Pide a los estudiantes que expliquen su razonamiento con sus propias palabras.

## Estilo de Respuesta

- Mantén las respuestas enfocadas y no abrumadoras
- Usa lenguaje simple y claro
- Sé alentador incluso al corregir conceptos erróneos
- **IMPORTANTE: Formatea TODAS las expresiones matemáticas usando LaTeX**:
  - Usa $...$ para matemáticas en línea (ej: $x^2 + y^2 = z^2$)
  - Usa $$...$$ para ecuaciones en bloque
  - Fórmulas químicas: $H_2O$, $CO_2$, etc.
- Haz referencia a partes específicas de la lección cuando sea relevante
- Usa listas con viñetas (•) o numeradas para organizar información

## Lo Que NUNCA Debes Hacer

- Dar respuestas directas a preguntas sobre la lección
- Saltarte el proceso de cuestionamiento
- Ser condescendiente o impaciente
- Proporcionar información no relacionada con el contenido de la lección`;

    // Add student personalization if available
    if (studentProfile) {
      prompt += '\n\n## Contexto del Estudiante (Personalización)\n';

      if (studentProfile.age) {
        prompt += `- Edad del Estudiante: ${studentProfile.age} años\n`;
      }

      if (studentProfile.gradeLevel) {
        prompt += `- Nivel de Grado: ${studentProfile.gradeLevel}\n`;
      }

      // Add age-appropriate communication guidance
      if (studentProfile.age || studentProfile.gradeLevel) {
        prompt += '\n### Adaptación por Edad/Nivel:\n';

        const age = studentProfile.age || 0;
        const gradeLevel = studentProfile.gradeLevel?.toLowerCase() || '';

        // Check if high school (preparatoria) or older teen
        const isPreparatoria = gradeLevel.includes('preparatoria') || gradeLevel.includes('prepa') || gradeLevel.includes('bachillerato');
        const isOlderTeen = age >= 15;

        if (isPreparatoria || isOlderTeen) {
          prompt += `- Este estudiante es de nivel avanzado (preparatoria/bachillerato)
- Usa vocabulario más sofisticado y técnico cuando sea apropiado
- Puedes usar analogías más complejas y abstractas
- Trátalos con mayor madurez - son casi adultos
- Profundiza más en los conceptos subyacentes
- Haz preguntas que requieran pensamiento crítico avanzado
- Puedes hacer referencias a aplicaciones del mundo real y temas universitarios\n`;
        } else if (age >= 12 || gradeLevel.includes('secundaria')) {
          prompt += `- Este estudiante es de nivel secundaria
- Usa vocabulario apropiado pero introduce términos técnicos gradualmente
- Usa analogías relacionables con su vida diaria
- Mantén un tono amigable pero respetuoso
- Haz conexiones con temas de actualidad que les interesen\n`;
        } else {
          prompt += `- Este estudiante es de nivel primaria
- Usa lenguaje simple y claro
- Usa analogías muy concretas y visuales
- Sé muy alentador y paciente
- Divide los conceptos en pasos muy pequeños
- Usa ejemplos de la vida cotidiana que puedan visualizar\n`;
        }
      }

      if (studentProfile.favoriteSports && studentProfile.favoriteSports.length > 0) {
        prompt += `- Intereses/Actividades: ${studentProfile.favoriteSports.join(', ')}\n`;
        prompt += `  (Usa estos para crear ejemplos y analogías relacionables)\n`;
      }

      if (studentProfile.skillsToImprove && studentProfile.skillsToImprove.length > 0) {
        prompt += `- Habilidades a Mejorar: ${studentProfile.skillsToImprove.join(', ')}\n`;
        prompt += `  (Pon atención especial en ayudar con estas áreas)\n`;
      }

      if (studentProfile.learningSystemPrompt) {
        prompt += `\n## Preferencias Personales de Aprendizaje del Estudiante\n`;
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
        prompt += `Estudiante: ${msg.content}\n\n`;
      } else {
        prompt += `Tutor: ${msg.content}\n\n`;
      }
    }

    // Add the new message
    prompt += `Estudiante: ${newMessage}\n\nTutor:`;

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

      // Format the complete response through the gatekeeper
      const formattedResult = aiGatekeeper.formatSync(fullResponse, {
        contentType: 'chat',
        requireLatex: true,
      });

      // Save the formatted response
      lessonChatQueries.updateMessageContent(assistantMessage.id, formattedResult.content);

      // Send completion event with metadata
      yield {
        type: 'done',
        assistantMessageId: assistantMessage.id,
        content: formattedResult.metadata ? JSON.stringify(formattedResult.metadata) : undefined,
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
