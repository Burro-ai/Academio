import { ChromaClient, IncludeEnum } from 'chromadb';
import { ollamaService } from './ollama.service';
import { aiGatekeeper, getPedagogicalPersona, PedagogicalPersona, getVelocityLeapDirective } from './aiGatekeeper.service';
import { memoryService, RetrievedMemory } from './memory.service';
import { analyticsService } from './analytics.service';
import { lessonChatQueries, LessonChatMessage } from '../database/queries/lessonChat.queries';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { StudentProfile } from '../types';

const CHROMA_HOST       = process.env.CHROMA_HOST       || 'localhost';
const CHROMA_PORT       = process.env.CHROMA_PORT       || '8000';
const OLLAMA_BASE_URL   = process.env.OLLAMA_BASE_URL   || 'http://localhost:11434';
const NEM_COLLECTION    = 'curriculum_standards';
const NEM_EMBED_MODEL   = 'qwen3-embedding';
const NEM_TOP_K         = 3;

/**
 * Lesson Chat Service
 *
 * Implements a sophisticated "Grok/ChatGPT-style" pedagogical engine with:
 * - Anti-cringe directive: No forced personalization in initial interactions
 * - Conditional interest-based support: Only after 2+ failed comprehension attempts
 * - Age-appropriate tone: Professional for 13+, warm for younger students
 */
class LessonChatService {
  // ── NEM Curriculum RAG ────────────────────────────────────────────────────
  private nemClient: ChromaClient | null = null;
  private nemInitialized = false;

  /**
   * Lazy-init the ChromaDB client for curriculum retrieval.
   * Silently sets nemClient=null if ChromaDB is unavailable.
   */
  private async initNEMClient(): Promise<void> {
    if (this.nemInitialized) return;
    this.nemInitialized = true;
    try {
      const client = new ChromaClient({ path: `http://${CHROMA_HOST}:${CHROMA_PORT}` });
      await client.listCollections(); // connection test
      this.nemClient = client;
      console.log('[LessonChat] ChromaDB connected for NEM curriculum RAG');
    } catch {
      this.nemClient = null;
      console.warn('[LessonChat] ChromaDB unavailable — NEM curriculum enrichment disabled');
    }
  }

  /**
   * Map a student's gradeLevel string to the `grade_dir` stored in ChromaDB metadata.
   *
   * Examples:
   *   "1° de Primaria"        → "01_primaria_1"
   *   "3er Grado de Primaria" → "03_primaria_3"
   *   "2° de Secundaria"      → "08_secundaria_2"
   *   "Preparatoria"          → null  (outside NEM scope)
   */
  private resolveGradeDir(gradeLevel?: string): string | null {
    if (!gradeLevel) return null;
    const g = gradeLevel.toLowerCase();

    // NEM only covers Primaria (1–6) and Secundaria (1–3)
    if (
      g.includes('preparatoria') || g.includes('prepa') ||
      g.includes('bachillerato') || g.includes('universidad') ||
      g.includes('university')
    ) {
      return null;
    }

    const isSecundaria = g.includes('secundaria') || g.includes('secun');
    const isPrimaria   = g.includes('primaria')   || g.includes('prim');
    if (!isSecundaria && !isPrimaria) return null;

    // Extract the first digit 1–6 present in the string
    const numMatch = g.match(/\b([1-6])\b/);
    if (!numMatch) return null;
    const n = parseInt(numMatch[1], 10);

    if (isSecundaria && n >= 1 && n <= 3) {
      return `${String(n + 6).padStart(2, '0')}_secundaria_${n}`;
    }
    if (isPrimaria && n >= 1 && n <= 6) {
      return `${String(n).padStart(2, '0')}_primaria_${n}`;
    }
    return null;
  }

  /**
   * Retrieve grade-filtered NEM curriculum chunks relevant to the student's message.
   *
   * Returns null (gracefully) when:
   *  - ChromaDB is unavailable
   *  - The curriculum_standards collection is empty or missing
   *  - Ollama embedding fails
   *  - No chunks score above 0.25 similarity
   */
  async getNEMContext(
    message: string,
    gradeLevel?: string
  ): Promise<string | null> {
    await this.initNEMClient();
    if (!this.nemClient) return null;

    try {
      // 1. Get (or create) the curriculum collection
      const collections = await this.nemClient.listCollections();
      const names = (collections as unknown as Array<{ name: string } | string>)
        .map(c => (typeof c === 'string' ? c : c.name));
      if (!names.includes(NEM_COLLECTION)) return null;

      const collection = await this.nemClient.getOrCreateCollection({ name: NEM_COLLECTION });
      if ((await collection.count()) === 0) return null;

      // 2. Embed the student's message via Ollama
      const embedRes = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: NEM_EMBED_MODEL, prompt: message }),
      });
      if (!embedRes.ok) return null;
      const { embedding } = await embedRes.json() as { embedding: number[] };
      if (!embedding?.length) return null;

      // 3. Grade-filtered similarity search
      const gradeDir = this.resolveGradeDir(gradeLevel);
      const queryParams: Parameters<typeof collection.query>[0] = {
        queryEmbeddings: [embedding],
        nResults: NEM_TOP_K,
        include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
      };
      if (gradeDir) {
        // Restrict results to the student's exact grade level
        (queryParams as Record<string, unknown>).where = { grade_dir: { $eq: gradeDir } };
      }

      const results = await collection.query(queryParams);
      const docs      = results.documents?.[0] ?? [];
      const metas     = results.metadatas?.[0]  ?? [];
      const distances = results.distances?.[0]  ?? [];

      // 4. Filter by minimum similarity (L2 distance → similarity)
      const MIN_SIMILARITY = 0.25;
      const relevant: string[] = [];

      for (let i = 0; i < docs.length; i++) {
        const doc  = docs[i];
        const meta = metas[i] as Record<string, string | number> | null ?? {};
        const sim  = 1 / (1 + (distances[i] ?? 999));
        if (doc && sim >= MIN_SIMILARITY) {
          const label = meta.book_title
            ? `[${meta.book_title}, pág. ~${meta.source_page ?? '?'}]`
            : '';
          relevant.push(`${label}\n${doc.trim()}`);
        }
      }

      if (relevant.length === 0) return null;

      console.log(
        `[LessonChat] NEM RAG: ${relevant.length} chunk(s) retrieved` +
        (gradeDir ? ` for grade_dir=${gradeDir}` : ' (no grade filter)')
      );
      return relevant.join('\n\n---\n\n');

    } catch (err) {
      console.warn('[LessonChat] NEM context retrieval failed (non-fatal):', err);
      return null;
    }
  }

  /**
   * Inject NEM curriculum context into the system prompt.
   *
   * Positioned AFTER the specific lesson content so the AI treats it as
   * deep background knowledge — not as content to cite verbatim.
   */
  private buildNEMFramework(nemChunks: string): string {
    return `## MARCO PEDAGÓGICO NEM

El siguiente contexto proviene de los libros de texto oficiales de la **Nueva Escuela Mexicana 2023** correspondientes al nivel del estudiante. Úsalo como base de conocimiento de fondo para fundamentar tus explicaciones.

### Instrucciones de uso:
- Utiliza este contexto para asegurar que tus explicaciones sean **modernas, precisas y alineadas al currículo mexicano NEM 2023**
- **NO cites el libro directamente** a menos que el estudiante lo solicite explícitamente
- Úsalo para enriquecer tus analogías, marcos conceptuales y vocabulario disciplinar
- **Prioriza siempre** el contenido específico de la lección del estudiante sobre este contexto
- Si el contexto no es relevante para la pregunta, ignóralo y responde con base en la lección

### Contexto curricular relevante:

---
${nemChunks}
---

`;
  }

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
    retrievedMemories?: RetrievedMemory[],
    nemContext?: string | null
  ): string {
    // Get the appropriate pedagogical persona based on age/grade
    const persona = getPedagogicalPersona(studentProfile?.age, studentProfile?.gradeLevel);

    // Analyze if student is struggling
    const struggleAnalysis = conversationHistory
      ? this.analyzeStruggleLevel(conversationHistory)
      : { isStruggling: false, failedAttempts: 0, conceptsStruggledWith: [] };

    const memoryCount = retrievedMemories?.length || 0;
    console.log(
      `[LessonChat] Persona: ${persona.name} (${persona.type}) | ` +
      `Age: ${studentProfile?.age} | Grade: ${studentProfile?.gradeLevel} | ` +
      `Struggling: ${struggleAnalysis.isStruggling} (${struggleAnalysis.failedAttempts} attempts) | ` +
      `Memories: ${memoryCount} | NEM chunks: ${nemContext ? 'yes' : 'no'}`
    );

    // Build the hierarchical system prompt
    // ┌─ 1. Core Directive (Socratic role + persona)
    // ├─ 2. Socratic Methodology (adapted to age)
    // ├─ 3. Lesson Content (specific material student is studying)
    // ├─ 4. NEM Framework (grade-filtered curriculum background) ← NEW
    // ├─ 5. Response Guidelines (formatting, tone)
    // ├─ 6. Prohibitions
    // ├─ 7. Student Context (age/grade — NO interests yet)
    // ├─ 8. Struggle Support (conditional — only after 2+ failed attempts)
    // └─ 9. Long-Term Memory (RAG — past interactions)
    let prompt = this.buildCoreDirective(persona);
    prompt += this.buildSocraticMethodology(persona);
    prompt += this.buildLessonContext(lessonContent);

    // NEM CURRICULUM ENRICHMENT: inject after lesson content, before response rules
    if (nemContext) {
      prompt += this.buildNEMFramework(nemContext);
    }

    prompt += this.buildResponseGuidelines(persona);
    prompt += this.buildProhibitions(persona);

    // Add student context (age/grade only - NO interests yet)
    if (studentProfile) {
      prompt += this.buildStudentContext(studentProfile, persona);
    }

    // CONDITIONAL: Add support resources ONLY if struggling
    if (struggleAnalysis.isStruggling && studentProfile) {
      prompt += this.buildStruggleSupportResources(studentProfile, struggleAnalysis, persona);
    }

    // RAG: Inject relevant past interactions from long-term memory
    if (retrievedMemories && retrievedMemories.length > 0) {
      prompt += memoryService.formatMemoriesForPrompt(retrievedMemories);
    }

    return prompt;
  }

  /**
   * Core directive — establishes the Velocity Coach identity and adaptive mode protocol.
   */
  private buildCoreDirective(persona: PedagogicalPersona): string {
    return `Eres un Velocity Coach educativo de alto nivel. Tu misión es hacer que el estudiante aprenda 2 veces más rápido y 2 veces mejor mediante un método adaptativo e inteligente.

## REGLA CRÍTICA DE IDIOMA
- TODO tu contenido DEBE estar en ESPAÑOL MEXICANO
- NUNCA uses inglés bajo ninguna circunstancia
- Usa expresiones naturales y apropiadas para México

## DIRECTIVA VELOCITY COACH — TRES MODOS ADAPTATIVOS

Lees el estado del estudiante en la conversación y seleccionas el modo correcto en tiempo real:

| Modo | Cuándo activarlo | Comportamiento |
|------|-----------------|----------------|
| **Socrático** (default) | Estudiante progresando y respondiendo | Guía mediante preguntas; nunca des la respuesta directamente |
| **Directo + Depth-Check** | Estudiante bloqueado (2+ intentos fallidos o señales de frustración) | Da la respuesta directa, seguida INMEDIATAMENTE de una pregunta Depth-Check |
| **Sprint** | Estudiante en flujo (3+ respuestas rápidas, correctas y confiadas) | Mensajes cortos, ritmo acelerado — mantén el momentum |

**Regla de Respuesta Directa:** SOLO está permitida cuando el estudiante está genuinamente bloqueado. Después de cada respuesta directa, DEBES hacer un Depth-Check sin excepción:
> *"Ahora que lo sabes — ¿por qué crees que funciona así?"*

${persona.systemPromptSegment}

`;
  }

  /**
   * Adaptive methodology section — Velocity Coach three-mode protocol, adapted by persona age.
   */
  private buildSocraticMethodology(persona: PedagogicalPersona): string {
    const isMature = !persona.allowsEnthusiasm; // 13+ students

    const gamificationGuidance = isMature
      ? `### Gamificación (Versión Profesional para 13+)
- **Concepto dominado:** Cuando el estudiante demuestre dominio: "Concepto dominado: [nombre]."
- **Ritmo elevado:** En modo Sprint usa frases directas: "Sólido. Siguiente:"
- Sin emojis ni lenguaje infantil — el reconocimiento es directo y sobrio`
      : `### Gamificación (Versión Energética para ≤12 años)
- **Power-Up:** Cuando el estudiante domine un concepto: "⚡ Power-Up desbloqueado: [Nombre del Concepto]"
- **Sprint:** Cuando detectes 3+ respuestas correctas rápidas: "🔥 ¡Estás en Sprint! Siguiente:"
- Energía alta pero auténtica — celebra el logro, no el proceso de forma artificial`;

    if (isMature) {
      return `## METODOLOGÍA ADAPTATIVA — ALTA VELOCIDAD (13+)

### Modo Socrático (default)
1. **Clarifica Primero**: Si hay confusión de base, proporciona una explicación estructurada antes de preguntar.
2. **Preguntas de Alto Nivel**: Que expongan supuestos implícitos, requieran justificación lógica y conecten principios fundamentales.
3. **Guía Estructurada**: Valida lo correcto directamente; señala imprecisiones de forma constructiva.
4. **Resolución Progresiva**: Cada intercambio acerca al estudiante a la comprensión completa.

### Modo Directo + Depth-Check (bloqueado)
Cuando detectes 2+ señales de frustración o bloqueo real:
- Da la respuesta directa con explicación breve del razonamiento
- Sigue inmediatamente con una pregunta Depth-Check: verifica comprensión, no solo memorización
- Formato: "[Respuesta]. [Por qué]. Ahora: [pregunta de verificación]"

### Modo Sprint (flujo)
Cuando detectes 3+ respuestas correctas y rápidas consecutivas:
- Acorta tus respuestas al mínimo necesario
- Pasa rápido al siguiente concepto sin sobre-explicar
- Mantén el ritmo hasta que el flujo se rompa naturalmente

${gamificationGuidance}

`;
    } else {
      return `## METODOLOGÍA ADAPTATIVA — ALTA VELOCIDAD (≤12 años)

### Modo Socrático (default)
1. **Escenarios Concretos**: Presenta conceptos a través de situaciones visualizables e imaginables.
2. **Una Pregunta a la Vez**: Clara, específica. Espera respuesta antes de continuar.
3. **Pistas Visuales**: Si hay dificultad, usa analogías con objetos cotidianos y situaciones familiares.
4. **Celebra el Proceso**: Reconoce el esfuerzo y el razonamiento, no solo las respuestas correctas.

### Modo Directo + Depth-Check (bloqueado)
Cuando el estudiante lleve 2+ intentos sin éxito o exprese frustración clara:
- Da la respuesta de forma simple y visual
- Inmediatamente lanza un Depth-Check accesible: "¿Y si te pregunto esto ahora: [verificación sencilla]?"
- Tono: cálido, nunca "te lo dije antes"

### Modo Sprint (flujo)
Cuando el estudiante responda rápido y correcto 3+ veces seguidas:
- Entra en modo Sprint: mensajes de 1–2 oraciones máximo
- Afirmaciones breves y lanza el siguiente reto de inmediato
- Mantén la energía hasta que el ritmo se rompa

${gamificationGuidance}

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

- ❌ Dar una respuesta directa sin seguirla inmediatamente de un Depth-Check (sin excepción)
- ❌ Romper el modo Sprint con sobre-explicaciones innecesarias
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
   * Only activated after 2+ failed comprehension attempts.
   *
   * Injects two layers:
   *  1. Velocity Leap directive (from aiGatekeeper) — switches AI to Direct+Depth-Check mode
   *  2. Personalization resources — interests only as last-resort analogies
   */
  private buildStruggleSupportResources(
    studentProfile: StudentProfile,
    struggleAnalysis: { failedAttempts: number },
    persona: PedagogicalPersona
  ): string {
    // ── Layer 1: Velocity Leap — always present when struggling ──────────────
    const leap = getVelocityLeapDirective(struggleAnalysis.failedAttempts, persona);
    let block = leap ? leap.promptSegment + '\n\n' : '';

    // ── Layer 2: Personalization resources (interest-based analogies) ─────────
    const hasInterests = studentProfile.favoriteSports && studentProfile.favoriteSports.length > 0;

    if (!hasInterests) {
      block += `## RECURSO DE APOYO: BLOQUEO DETECTADO

Se han detectado ${struggleAnalysis.failedAttempts} intentos sin éxito.

### Estrategias de Apoyo (si la Verificación de Comprensión sigue fallando):
1. **Simplifica** — reduce la complejidad de la explicación al mínimo
2. **Más Concreto** — usa ejemplos tangibles del mundo cotidiano
3. **Micro-pasos** — divide el concepto en el paso más pequeño posible
4. **Verifica Prerrequisitos** — confirma que domina los conceptos base

`;
      return block;
    }

    block += `## RECURSOS DE APOYO PARA BLOQUEO PERSISTENTE

⚠️ ${struggleAnalysis.failedAttempts} intentos fallidos — recursos de personalización activados como última opción.

### Intereses del Estudiante (USAR SOLO COMO ANALOGÍA DE ÚLTIMO RECURSO)
- **Actividades/Deportes**: ${(studentProfile.favoriteSports || []).join(', ')}

### Cuándo usarlos:
SOLO después de que la Verificación de Comprensión falle dos veces más:
1. Si las explicaciones directas + Verificación siguen sin funcionar
2. Necesitas una analogía de "gancho" para que el concepto conecte

**USO CORRECTO**: "Déjame intentar algo diferente: imagina que estás [actividad]. En ese contexto, [concepto] funcionaría como..."
**USO INCORRECTO**: "¡Como te gusta [deporte], aprendamos matemáticas con [deporte]!" ← NUNCA

`;
    return block;
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

      // RAG PIPELINE: Retrieve long-term memory AND NEM curriculum context concurrently
      const [retrievedMemories, nemContext] = await Promise.all([
        memoryService.isAvailable()
          ? memoryService.retrieveRelevantMemories(studentId, message, 3)
          : Promise.resolve([] as RetrievedMemory[]),
        this.getNEMContext(message, studentProfile?.gradeLevel ?? undefined),
      ]);

      // Build system prompt: lesson content + NEM curriculum enrichment + memory
      const systemPrompt = this.buildSystemPrompt(
        personalizedLesson.personalizedContent,
        studentProfile,
        history,
        retrievedMemories,
        nemContext
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
        studentProfile?.gradeLevel ?? null,
        {
          userId: studentId,
          subject: personalizedLesson.lesson?.subject || undefined,
          topic: personalizedLesson.lesson?.title || undefined,
          questionsAsked: updatedHistory.filter(m => m.role === 'user').length,
        }
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
