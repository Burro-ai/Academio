import { ollamaService } from './ollama.service';
import { aiGatekeeper, getPedagogicalPersona, PedagogicalPersona } from './aiGatekeeper.service';
import { memoryService, RetrievedMemory } from './memory.service';
import { homeworkChatQueries, HomeworkChatMessage } from '../database/queries/homeworkChat.queries';
import { homeworkQueries } from '../database/queries/homework.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { StudentProfile, HomeworkQuestionJson } from '../types';

/**
 * Homework Chat Service (Socratic Sidekick)
 *
 * Implements a Socratic AI tutor that helps students with homework questions WITHOUT
 * giving direct answers. Uses the same sophisticated pedagogical engine as lesson chat:
 * - Anti-cringe directive: No forced personalization in initial interactions
 * - Conditional interest-based support: Only after 2+ failed comprehension attempts
 * - Age-appropriate tone: Professional for 13+, warm for younger students
 * - RAG-based long-term memory for conversational continuity
 */
class HomeworkChatService {
  /**
   * Analyze conversation history to detect if student is struggling
   * (Same logic as lessonChat.service.ts)
   */
  private analyzeStruggleLevel(messages: HomeworkChatMessage[]): {
    isStruggling: boolean;
    failedAttempts: number;
    conceptsStruggledWith: string[];
  } {
    const userMessages = messages.filter(m => m.role === 'user');

    if (userMessages.length < 2) {
      return { isStruggling: false, failedAttempts: 0, conceptsStruggledWith: [] };
    }

    // Struggle indicators in Spanish
    const confusionPhrases = [
      'no entiendo', 'no comprendo', 'no le entiendo',
      'estoy confundido', 'estoy confundida', 'me confunde',
      'no sé', 'no se', 'no lo sé',
      'sigo sin entender', 'todavía no entiendo',
      'otra vez', 'de nuevo', 'repite',
      'puedes explicar otra vez', 'explicame de nuevo',
      'qué significa', 'qué quiere decir',
      'no me queda claro', 'sigo perdido', 'sigo perdida',
      'ayuda', 'help', 'socorro',
      '???', '??', 'ehh', 'emmm',
    ];

    let failedAttempts = 0;
    const conceptsStruggledWith: string[] = [];

    for (let i = 0; i < userMessages.length; i++) {
      const content = userMessages[i].content.toLowerCase();

      const hasConfusion = confusionPhrases.some(phrase => content.includes(phrase));
      const isShortUncertain = content.length < 20 && (
        content.includes('?') ||
        content.includes('no') ||
        content.includes('pero')
      );
      const isPossibleRepeat = i > 0 && this.isSimilarQuestion(
        userMessages[i - 1].content,
        userMessages[i].content
      );

      if (hasConfusion || isShortUncertain || isPossibleRepeat) {
        failedAttempts++;
      }
    }

    return {
      isStruggling: failedAttempts >= 2,
      failedAttempts,
      conceptsStruggledWith,
    };
  }

  /**
   * Check if two questions are similar (asking about the same thing)
   */
  private isSimilarQuestion(q1: string, q2: string): boolean {
    const normalize = (s: string) => s.toLowerCase()
      .replace(/[¿?¡!.,]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

    const words1 = new Set(normalize(q1));
    const words2 = new Set(normalize(q2));

    if (words1.size === 0 || words2.size === 0) return false;

    const intersection = [...words1].filter(w => words2.has(w));
    const similarity = intersection.length / Math.min(words1.size, words2.size);

    return similarity > 0.5;
  }

  /**
   * Build the system prompt for homework-contextualized tutoring
   *
   * Key difference from lesson chat: The context is homework questions, not lesson content.
   * The AI should help the student UNDERSTAND and APPROACH problems, never solve them.
   */
  buildSystemPrompt(
    homeworkQuestions: HomeworkQuestionJson[],
    homeworkTitle: string,
    homeworkTopic: string,
    studentProfile?: StudentProfile | null,
    conversationHistory?: HomeworkChatMessage[],
    retrievedMemories?: RetrievedMemory[]
  ): string {
    const persona = getPedagogicalPersona(studentProfile?.age, studentProfile?.gradeLevel);

    const struggleAnalysis = conversationHistory
      ? this.analyzeStruggleLevel(conversationHistory)
      : { isStruggling: false, failedAttempts: 0, conceptsStruggledWith: [] };

    const memoryCount = retrievedMemories?.length || 0;
    console.log(`[HomeworkChat] Persona: ${persona.name} (${persona.type}) | Age: ${studentProfile?.age} | Grade: ${studentProfile?.gradeLevel} | Struggling: ${struggleAnalysis.isStruggling} (${struggleAnalysis.failedAttempts} attempts) | Memories: ${memoryCount}`);

    let prompt = this.buildCoreDirective(persona);
    prompt += this.buildSocraticMethodology(persona);
    prompt += this.buildHomeworkContext(homeworkQuestions, homeworkTitle, homeworkTopic);
    prompt += this.buildResponseGuidelines(persona);
    prompt += this.buildProhibitions(persona);

    if (studentProfile) {
      prompt += this.buildStudentContext(studentProfile, persona);
    }

    if (struggleAnalysis.isStruggling && studentProfile) {
      prompt += this.buildStruggleSupportResources(studentProfile, struggleAnalysis);
    }

    if (retrievedMemories && retrievedMemories.length > 0) {
      prompt += memoryService.formatMemoriesForPrompt(retrievedMemories);
    }

    return prompt;
  }

  /**
   * Core directive - establishes the AI's primary role as homework helper
   */
  private buildCoreDirective(persona: PedagogicalPersona): string {
    return `Eres un Asistente de Tarea Socrático. Tu objetivo es ayudar al estudiante a ENTENDER cómo abordar los problemas de su tarea, NUNCA darle las respuestas directamente.

## REGLA CRÍTICA DE IDIOMA
- TODO tu contenido DEBE estar en ESPAÑOL MEXICANO
- NUNCA uses inglés bajo ninguna circunstancia
- Usa expresiones naturales y apropiadas para México

## DIRECTIVA FUNDAMENTAL - ASISTENTE DE TAREA
Tu rol es ser un compañero de estudio que:
1. Ayuda a ENTENDER lo que pide cada pregunta
2. Guía al estudiante a PENSAR en cómo abordar el problema
3. Ofrece PISTAS y preguntas que iluminen el camino
4. NUNCA JAMÁS resuelve los problemas ni da respuestas directas

${persona.systemPromptSegment}

`;
  }

  /**
   * Socratic methodology section - adapted for homework help
   */
  private buildSocraticMethodology(persona: PedagogicalPersona): string {
    const isMature = !persona.allowsEnthusiasm;

    if (isMature) {
      return `## METODOLOGÍA SOCRÁTICA PARA TAREAS

1. **Clarifica el Problema**: Ayuda al estudiante a entender exactamente qué se le pide.
   - "¿Qué información te da el problema?"
   - "¿Qué es lo que necesitas encontrar?"

2. **Conecta con Conocimientos Previos**:
   - "¿Qué conceptos o fórmulas podrían aplicarse aquí?"
   - "¿Has resuelto problemas similares antes?"

3. **Guía sin Resolver**: Cuando el estudiante pida ayuda:
   - Ofrece el PRIMER paso como pista, no la solución completa
   - Pregunta: "¿Qué harías después de esto?"
   - Si está muy perdido: "Pensemos en qué datos tenemos y qué necesitamos"

4. **Valida el Razonamiento**:
   - "¿Por qué elegiste ese método?"
   - "¿Cómo verificarías tu respuesta?"

`;
    } else {
      return `## METODOLOGÍA SOCRÁTICA PARA TAREAS

1. **Entiende la Pregunta Juntos**: Ayúdale a comprender qué se le pide.
   - "A ver, ¿qué nos está pidiendo esta pregunta?"
   - "¿Qué información tenemos para empezar?"

2. **Pistas Paso a Paso**:
   - Ofrece una pista pequeña a la vez
   - Usa ejemplos similares pero diferentes para no dar la respuesta
   - "Es como cuando tú... [analogía apropiada]"

3. **Celebra el Esfuerzo**: Reconoce cuando está en el camino correcto.
   - "¡Vas bien! Ahora piensa en qué sigue..."
   - "Buen razonamiento. ¿Qué más necesitas?"

4. **Nunca Resuelvas por Él/Ella**: Si pide la respuesta directa:
   - "Te puedo dar una pista: piensa en [concepto]"
   - "¿Qué pasaría si intentaras [acción]?"

`;
    }
  }

  /**
   * Homework questions context - the specific questions being worked on
   */
  private buildHomeworkContext(
    questions: HomeworkQuestionJson[],
    title: string,
    topic: string
  ): string {
    let context = `## TAREA ACTUAL

**Título**: ${title}
**Tema**: ${topic}

### Preguntas de la Tarea:

`;

    questions.forEach((q, index) => {
      context += `**Pregunta ${index + 1}** (ID: ${q.id}): ${q.text}\n`;
      if (q.type === 'choice' && q.options) {
        context += `Opciones: ${q.options.join(' | ')}\n`;
      }
      context += '\n';
    });

    context += `
IMPORTANTE: El estudiante puede preguntar sobre cualquiera de estas preguntas. Ayúdale a ENTENDER y ABORDAR el problema, pero NUNCA le des la respuesta directa.

`;
    return context;
  }

  /**
   * Response guidelines - LaTeX, formatting, etc.
   */
  private buildResponseGuidelines(persona: PedagogicalPersona): string {
    const toneGuidance = persona.allowsEnthusiasm
      ? `- Tono cálido y alentador es apropiado
- Celebraciones breves cuando hay progreso: "Bien pensado", "Eso es correcto"`
      : `- Tono profesional y objetivo
- Reconocimiento directo sin exclamaciones: "Correcto", "Análisis válido"
- EVITA expresiones como "¡Excelente!", "¡Genial!", "¡Súper!"`;

    return `## DIRECTRICES DE RESPUESTA

### Formato Técnico
- **Matemáticas**: Usa LaTeX: $expresión$ para inline, $$expresión$$ para bloque
- **Fórmulas químicas**: $H_2O$, $CO_2$, etc.
- **Respuestas Concisas**: Máximo 2-3 párrafos cortos por respuesta
- **Una Pista a la Vez**: No bombardees con información

### Tono y Estilo
${toneGuidance}

### Estructura de Respuesta Ideal
1. Reconoce qué pregunta está trabajando
2. Ofrece UNA pista o pregunta guía
3. Espera a que el estudiante piense/responda

`;
  }

  /**
   * Prohibitions - what the AI must never do
   */
  private buildProhibitions(persona: PedagogicalPersona): string {
    let prohibitions = `## PROHIBICIONES ABSOLUTAS

- ❌ DAR RESPUESTAS DIRECTAS A LAS PREGUNTAS DE LA TAREA
- ❌ Resolver problemas matemáticos completamente
- ❌ Escribir respuestas que el estudiante pueda copiar
- ❌ Dar la respuesta "correcta" de opción múltiple
- ❌ Decir "la respuesta es..." o "el resultado es..."
- ❌ Usar inglés bajo ninguna circunstancia
- ❌ Ser condescendiente o impaciente`;

    if (!persona.allowsEnthusiasm) {
      prohibitions += `
- ❌ Usar exclamaciones excesivas o lenguaje infantil
- ❌ Expresiones como "¡WOW!", "¡SÚPER!", "¡GENIAL!"`;
    }

    prohibitions += `

SI EL ESTUDIANTE INSISTE EN QUE LE DES LA RESPUESTA:
Responde: "Mi trabajo es ayudarte a ENTENDER el problema para que puedas resolverlo tú mismo. Te puedo dar pistas, pero la respuesta la descubrirás tú. Eso es lo que hace que aprendas de verdad."

`;
    return prohibitions;
  }

  /**
   * Student context - basic info only, NO interests
   */
  private buildStudentContext(studentProfile: StudentProfile, persona: PedagogicalPersona): string {
    let context = `## CONTEXTO DEL ESTUDIANTE

`;

    if (studentProfile.age) {
      context += `- **Edad**: ${studentProfile.age} años\n`;
    }

    if (studentProfile.gradeLevel) {
      context += `- **Nivel académico**: ${studentProfile.gradeLevel}\n`;
    }

    if (studentProfile.skillsToImprove && studentProfile.skillsToImprove.length > 0) {
      context += `- **Áreas de enfoque**: ${studentProfile.skillsToImprove.join(', ')}\n`;
    }

    if (studentProfile.learningSystemPrompt) {
      context += `\n### Preferencias de Aprendizaje\n${studentProfile.learningSystemPrompt}\n`;
    }

    context += '\n';
    return context;
  }

  /**
   * CONDITIONAL SUPPORT RESOURCES - Only when struggling
   */
  private buildStruggleSupportResources(
    studentProfile: StudentProfile,
    struggleAnalysis: { failedAttempts: number }
  ): string {
    const hasInterests = studentProfile.favoriteSports && studentProfile.favoriteSports.length > 0;

    if (!hasInterests) {
      return `## RECURSO DE APOYO: ESTUDIANTE EN DIFICULTAD

⚠️ Se han detectado ${struggleAnalysis.failedAttempts} intentos de comprensión sin éxito.

### Estrategia de Apoyo Activada:
1. **Simplifica**: Reduce la complejidad de tu explicación
2. **Más Concreto**: Usa ejemplos más básicos
3. **Pasos Más Pequeños**: Divide el concepto en micro-pasos
4. **Verifica Prerrequisitos**: Asegúrate de que domina los conceptos base

`;
    }

    return `## RECURSOS DE APOYO PARA DIFICULTADES

⚠️ **ACTIVACIÓN CONDICIONAL**: Se han detectado ${struggleAnalysis.failedAttempts} intentos sin éxito.

### Intereses del Estudiante (USAR SOLO SI ES NECESARIO)
- **Actividades/Deportes**: ${(studentProfile.favoriteSports || []).join(', ')}

### Instrucciones de Uso:
SOLO usa estos intereses como analogía si las explicaciones académicas estándar no están funcionando.

`;
  }

  /**
   * Build the conversation prompt from message history
   */
  buildConversationPrompt(messages: HomeworkChatMessage[], newMessage: string, questionContext?: string): string {
    let prompt = '';

    // Include conversation history
    for (const msg of messages) {
      if (msg.role === 'user') {
        prompt += `Estudiante: ${msg.content}\n\n`;
      } else {
        prompt += `Asistente: ${msg.content}\n\n`;
      }
    }

    // Add the new message with question context if provided
    if (questionContext) {
      prompt += `[El estudiante pregunta sobre: "${questionContext}"]\n`;
    }
    prompt += `Estudiante: ${newMessage}\n\nAsistente:`;

    return prompt;
  }

  /**
   * Stream a chat response for homework help
   */
  async *streamChat(
    personalizedHomeworkId: string,
    studentId: string,
    message: string,
    questionContext?: string
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
      const session = homeworkChatQueries.getOrCreateSession(personalizedHomeworkId, studentId);

      // Get the personalized homework with full details
      const personalizedHomework = homeworkQueries.getPersonalizedById(personalizedHomeworkId);

      if (!personalizedHomework) {
        yield {
          type: 'error',
          error: 'Homework not found',
        };
        return;
      }

      // Get student profile for personalization
      const studentProfile = studentProfilesQueries.getByUserId(studentId);

      // Get conversation history for struggle analysis
      const history = homeworkChatQueries.getRecentMessages(session.id, 20);

      // Get questions from homework
      const questions = personalizedHomework.questionsJson || personalizedHomework.homework?.questionsJson || [];

      // RAG: Retrieve relevant past interactions from long-term memory
      let retrievedMemories: RetrievedMemory[] = [];
      if (memoryService.isAvailable()) {
        retrievedMemories = await memoryService.retrieveRelevantMemories(
          studentId,
          message,
          3
        );
      }

      // Build system prompt with homework questions context and long-term memory
      const systemPrompt = this.buildSystemPrompt(
        questions,
        personalizedHomework.homework.title,
        personalizedHomework.homework.topic,
        studentProfile,
        history,
        retrievedMemories
      );

      // Save user message with question context
      const userMessage = homeworkChatQueries.createMessage(session.id, 'user', message, questionContext);

      // Create placeholder for assistant message
      const assistantMessage = homeworkChatQueries.createMessage(session.id, 'assistant', '');

      // Build conversation prompt
      const recentHistory = history.slice(-10);
      const conversationPrompt = this.buildConversationPrompt(
        recentHistory,
        message,
        questionContext
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
      homeworkChatQueries.updateMessageContent(assistantMessage.id, formattedResult.content);

      // RAG: Store this Q&A interaction in long-term memory
      if (memoryService.isAvailable()) {
        memoryService.storeInteraction(
          studentId,
          message,
          formattedResult.content,
          {
            homeworkId: personalizedHomeworkId,
            homeworkTitle: personalizedHomework.homework.title,
            subject: personalizedHomework.homework.subject || undefined,
          }
        ).catch(err => {
          console.error('[HomeworkChat] Failed to store memory:', err);
        });
      }

      // Send completion event
      yield {
        type: 'done',
        assistantMessageId: assistantMessage.id,
        content: formattedResult.metadata ? JSON.stringify(formattedResult.metadata) : undefined,
      };
    } catch (error) {
      console.error('[HomeworkChat] Stream error:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to generate response',
      };
    }
  }

  /**
   * Get or create a homework chat session
   */
  getOrCreateSession(personalizedHomeworkId: string, studentId: string) {
    return homeworkChatQueries.getOrCreateSession(personalizedHomeworkId, studentId);
  }

  /**
   * Get all messages for a session
   */
  getSessionMessages(sessionId: string) {
    return homeworkChatQueries.getMessages(sessionId);
  }

  /**
   * Get session by personalized homework and student
   */
  getSession(personalizedHomeworkId: string, studentId: string) {
    return homeworkChatQueries.getSession(personalizedHomeworkId, studentId);
  }

  /**
   * Get all homework chat sessions for a student
   */
  getStudentSessions(studentId: string) {
    return homeworkChatQueries.getSessionsByStudent(studentId);
  }
}

export const homeworkChatService = new HomeworkChatService();
