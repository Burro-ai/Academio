import { ollamaService } from './ollama.service';
import { aiGatekeeper, getPedagogicalPersona, PedagogicalPersona } from './aiGatekeeper.service';
import { memoryService, RetrievedMemory } from './memory.service';
import { analyticsService } from './analytics.service';
import { lessonChatQueries, LessonChatMessage } from '../database/queries/lessonChat.queries';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { StudentProfile } from '../types';

/**
 * Lesson Chat Service
 *
 * Implements a sophisticated "Grok/ChatGPT-style" pedagogical engine with:
 * - Anti-cringe directive: No forced personalization in initial interactions
 * - Conditional interest-based support: Only after 2+ failed comprehension attempts
 * - Age-appropriate tone: Professional for 13+, warm for younger students
 */
class LessonChatService {
  /**
   * Analyze conversation history to detect if student is struggling
   * Struggling indicators:
   * - Repeated questions on same concept
   * - Expressions of confusion ("no entiendo", "estoy confundido", "no sé")
   * - Short, uncertain responses
   * - Questions that indicate previous explanation wasn't understood
   */
  private analyzeStruggleLevel(messages: LessonChatMessage[]): {
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

      // Check for confusion indicators
      const hasConfusion = confusionPhrases.some(phrase => content.includes(phrase));

      // Check for very short responses (often indicate uncertainty)
      const isShortUncertain = content.length < 20 && (
        content.includes('?') ||
        content.includes('no') ||
        content.includes('pero')
      );

      // Check for repeated questions (similar content in consecutive messages)
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
   * Build the system prompt for lesson-contextualized tutoring
   *
   * ARCHITECTURE HIERARCHY:
   * 1. Direct Socratic Goal - Lead to answer via sophisticated inquiry
   * 2. Sophistication Barrier - Match complexity with high-level language
   * 3. Conditional Context - Interests only when struggling (RECURSOS DE APOYO)
   * 4. Long-Term Memory - RAG-retrieved relevant past interactions
   */
  buildSystemPrompt(
    lessonContent: string,
    studentProfile?: StudentProfile | null,
    conversationHistory?: LessonChatMessage[],
    retrievedMemories?: RetrievedMemory[]
  ): string {
    // Get the appropriate pedagogical persona based on age/grade
    const persona = getPedagogicalPersona(studentProfile?.age, studentProfile?.gradeLevel);

    // Analyze if student is struggling
    const struggleAnalysis = conversationHistory
      ? this.analyzeStruggleLevel(conversationHistory)
      : { isStruggling: false, failedAttempts: 0, conceptsStruggledWith: [] };

    const memoryCount = retrievedMemories?.length || 0;
    console.log(`[LessonChat] Persona: ${persona.name} (${persona.type}) | Age: ${studentProfile?.age} | Grade: ${studentProfile?.gradeLevel} | Struggling: ${struggleAnalysis.isStruggling} (${struggleAnalysis.failedAttempts} attempts) | Memories: ${memoryCount}`);

    // Build the hierarchical system prompt
    let prompt = this.buildCoreDirective(persona);
    prompt += this.buildSocraticMethodology(persona);
    prompt += this.buildLessonContext(lessonContent);
    prompt += this.buildResponseGuidelines(persona);
    prompt += this.buildProhibitions(persona);

    // Add student context (age/grade only - NO interests yet)
    if (studentProfile) {
      prompt += this.buildStudentContext(studentProfile, persona);
    }

    // CONDITIONAL: Add support resources ONLY if struggling
    if (struggleAnalysis.isStruggling && studentProfile) {
      prompt += this.buildStruggleSupportResources(studentProfile, struggleAnalysis);
    }

    // RAG: Inject relevant past interactions from long-term memory
    if (retrievedMemories && retrievedMemories.length > 0) {
      prompt += memoryService.formatMemoriesForPrompt(retrievedMemories);
    }

    return prompt;
  }

  /**
   * Core directive - establishes the AI's primary role
   */
  private buildCoreDirective(persona: PedagogicalPersona): string {
    return `Eres un tutor socrático de alto nivel. Tu objetivo es guiar al estudiante hacia la comprensión profunda a través de preguntas bien formuladas y razonamiento estructurado.

## REGLA CRÍTICA DE IDIOMA
- TODO tu contenido DEBE estar en ESPAÑOL MEXICANO
- NUNCA uses inglés bajo ninguna circunstancia
- Usa expresiones naturales y apropiadas para México

## DIRECTIVA FUNDAMENTAL
Tu PRIMERA responsabilidad es proporcionar explicaciones CLARAS, SOFISTICADAS y ACADÉMICAMENTE RIGUROSAS. Guía mediante el método socrático: preguntas que iluminen, no que confundan.

${persona.systemPromptSegment}

`;
  }

  /**
   * Socratic methodology section - adapted by persona
   */
  private buildSocraticMethodology(persona: PedagogicalPersona): string {
    const isMature = !persona.allowsEnthusiasm; // 13+ students

    if (isMature) {
      return `## METODOLOGÍA SOCRÁTICA RIGUROSA

1. **Clarifica Primero**: Antes de cuestionar, asegúrate de que el estudiante comprende el problema. Si hay confusión básica, proporciona una explicación clara y estructurada.

2. **Preguntas de Alto Nivel**: Formula preguntas que:
   - Expongan supuestos implícitos
   - Requieran justificación lógica
   - Conecten con principios fundamentales
   - Fomenten síntesis de información

3. **Guía Estructurada**: Cuando el estudiante responda:
   - Valida lo correcto sin exceso de entusiasmo
   - Señala imprecisiones de manera directa y constructiva
   - Profundiza con la siguiente pregunta lógica

4. **Resolución Progresiva**: Cada intercambio debe acercar al estudiante a la comprensión completa del concepto.

`;
    } else {
      return `## METODOLOGÍA SOCRÁTICA ADAPTADA

1. **Escenarios Concretos**: Presenta conceptos a través de situaciones que el estudiante pueda visualizar e imaginar.

2. **Preguntas Paso a Paso**: Una pregunta clara a la vez. Espera respuesta antes de continuar.

3. **Pistas Visuales**: Si hay dificultad, ofrece pistas usando analogías concretas (objetos cotidianos, situaciones familiares).

4. **Celebra el Proceso**: Reconoce el esfuerzo y el razonamiento, no solo las respuestas correctas.

`;
    }
  }

  /**
   * Lesson content context
   */
  private buildLessonContext(lessonContent: string): string {
    return `## CONTENIDO DE LA LECCIÓN

El estudiante está estudiando el siguiente material. Todas tus interacciones deben estar fundamentadas en este contenido:

---
${lessonContent}
---

`;
  }

  /**
   * Response guidelines - LaTeX, formatting, etc.
   */
  private buildResponseGuidelines(persona: PedagogicalPersona): string {
    const toneGuidance = persona.allowsEnthusiasm
      ? `- Tono cálido y alentador es apropiado
- Celebraciones breves cuando hay progreso: "Bien pensado", "Eso es correcto"`
      : `- Tono profesional y objetivo
- Reconocimiento directo sin exclamaciones: "Correcto", "Análisis válido", "Bien razonado"
- EVITA expresiones como "¡Excelente!", "¡Genial!", "¡Súper!", "¡Increíble!"`;

    return `## DIRECTRICES DE RESPUESTA

### Formato Técnico
- **Matemáticas**: Usa LaTeX: $expresión$ para inline, $$expresión$$ para bloque
- **Fórmulas químicas**: $H_2O$, $CO_2$, etc.
- **Listas**: Usa viñetas (•) o numeración (1. 2. 3.) para organizar información
- **Estructura**: Respuestas organizadas, párrafos cortos, ideas claras

### Tono y Estilo
${toneGuidance}

### Conexión con la Lección
- Referencia secciones específicas del contenido cuando sea relevante
- Construye sobre conceptos ya presentados en la lección
- Mantén coherencia con la terminología usada en el material

`;
  }

  /**
   * Prohibitions - what the AI must never do
   */
  private buildProhibitions(persona: PedagogicalPersona): string {
    let prohibitions = `## PROHIBICIONES ABSOLUTAS

- ❌ Dar respuestas directas sin proceso de razonamiento
- ❌ Proporcionar información fuera del contexto de la lección
- ❌ Usar inglés bajo ninguna circunstancia
- ❌ Ser condescendiente o impaciente
- ❌ Asumir conocimiento que no se ha demostrado`;

    if (!persona.allowsEnthusiasm) {
      prohibitions += `
- ❌ Usar exclamaciones excesivas o lenguaje infantil
- ❌ Expresiones como "¡WOW!", "¡SÚPER!", "¡GENIAL!", "¡INCREÍBLE!"
- ❌ Tratar al estudiante como si fuera un niño pequeño`;
    }

    prohibitions += `

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
      context += `  (Presta atención especial a estas áreas en tu guía)\n`;
    }

    if (studentProfile.learningSystemPrompt) {
      context += `\n### Preferencias de Aprendizaje\n${studentProfile.learningSystemPrompt}\n`;
    }

    context += '\n';
    return context;
  }

  /**
   * CONDITIONAL SUPPORT RESOURCES
   * Only activated after 2+ failed comprehension attempts
   * This is the "mental crutch" for struggle, NOT default personalization
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
2. **Más Concreto**: Usa ejemplos más básicos y tangibles
3. **Pasos Más Pequeños**: Divide el concepto en micro-pasos
4. **Verifica Prerrequisitos**: Asegúrate de que domina los conceptos base antes de avanzar

`;
    }

    return `## RECURSOS DE APOYO PARA DIFICULTADES

⚠️ **ACTIVACIÓN CONDICIONAL**: Se han detectado ${struggleAnalysis.failedAttempts} intentos de comprensión sin éxito. Los siguientes recursos de personalización están ahora disponibles como "muleta mental".

### Intereses del Estudiante (USAR SOLO SI ES NECESARIO)
- **Actividades/Deportes**: ${(studentProfile.favoriteSports || []).join(', ')}

### Instrucciones de Uso:
SOLO usa estos intereses si:
1. Las explicaciones académicas estándar no están funcionando
2. Necesitas una analogía de "último recurso" para conectar el concepto
3. El estudiante parece desconectado y necesita un "gancho" emocional

**EJEMPLO DE USO APROPIADO**:
"Veo que este concepto está siendo difícil. Déjame intentar algo diferente: imagina que estás [actividad del estudiante]. En ese contexto, [concepto] funcionaría como..."

**EJEMPLO DE USO INAPROPIADO**:
"¡Hola! Como te gusta [deporte], ¡vamos a aprender matemáticas con [deporte]!" ← NUNCA hagas esto

### Estrategias de Apoyo Adicionales:
1. **Simplifica el lenguaje** sin perder precisión
2. **Usa ejemplos más concretos** del mundo cotidiano
3. **Divide en pasos más pequeños**
4. **Verifica comprensión de prerrequisitos**

`;
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
   *
   * Implements the sophisticated pedagogical engine with:
   * - Dynamic persona selection based on age/grade
   * - Conditional interest-based support (only when struggling)
   * - Professional tone for mature students (13+)
   * - RAG-based long-term memory for conversational continuity
   *
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

      // Get conversation history BEFORE building system prompt (for struggle analysis)
      const history = lessonChatQueries.getRecentMessages(session.id, 20);

      // RAG PIPELINE: Retrieve relevant past interactions from long-term memory
      let retrievedMemories: RetrievedMemory[] = [];
      if (memoryService.isAvailable()) {
        retrievedMemories = await memoryService.retrieveRelevantMemories(
          studentId,
          message,
          3 // Top 3 most relevant memories
        );
      }

      // Build system prompt with lesson context, conversation history, AND long-term memory
      // This enables conditional interest-based support based on struggle detection
      const systemPrompt = this.buildSystemPrompt(
        personalizedLesson.personalizedContent,
        studentProfile,
        history, // Pass history for struggle analysis
        retrievedMemories // Pass retrieved memories for RAG injection
      );

      // Save user message
      const userMessage = lessonChatQueries.createMessage(session.id, 'user', message);

      // Create placeholder for assistant message
      const assistantMessage = lessonChatQueries.createMessage(session.id, 'assistant', '');

      // Build conversation prompt (use recent history, exclude the just-saved message)
      const recentHistory = history.slice(-10);
      const conversationPrompt = this.buildConversationPrompt(
        recentHistory,
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

      // RAG PIPELINE: Store this Q&A interaction in long-term memory
      // Run asynchronously to not block the response
      if (memoryService.isAvailable()) {
        memoryService.storeInteraction(
          studentId,
          message,
          formattedResult.content,
          {
            lessonId: personalizedLessonId,
            lessonTitle: personalizedLesson.lesson?.title || undefined,
            subject: personalizedLesson.lesson?.subject || undefined,
          }
        ).catch(err => {
          console.error('[LessonChat] Failed to store memory:', err);
        });
      }

      // ANALYTICS: Calculate and persist Multi-Dimensional Struggle Score
      // Get updated message history after saving the new messages
      const updatedHistory = lessonChatQueries.getRecentMessages(session.id, 50);
      analyticsService.calculateAndPersist(
        session.id,
        updatedHistory,
        studentProfile?.age ?? null,
        studentProfile?.gradeLevel ?? null
      );

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
