import { ollamaService, ModelType } from './ollama.service';
import { aiGatekeeper, getPedagogicalPersona } from './aiGatekeeper.service';
import { homeworkQueries } from '../database/queries/homework.queries';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { HomeworkAssignment, PersonalizationContext, StudentProfileWithUser, HomeworkQuestionJson, HomeworkContentJson } from '../types';

/**
 * Progress tracking for personalization
 */
export interface PersonalizationProgress {
  homeworkId: string;
  total: number;
  completed: number;
  current: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

// In-memory progress tracking (can be replaced with Redis for production)
const progressMap = new Map<string, PersonalizationProgress>();

/**
 * Socratic personalization prompt - creates tailored problems with analogies and reflection questions
 * Uses pedagogical persona for age-appropriate content
 */
const SOCRATIC_PERSONALIZATION_PROMPT = `Eres un tutor socrático personalizando tareas para un estudiante específico.

## REGLA CRÍTICA DE IDIOMA
- TODO tu contenido DEBE estar en ESPAÑOL MEXICANO
- NUNCA uses inglés bajo ninguna circunstancia

{PERSONA_SEGMENT}

## Tu Tarea
Dado la tarea maestra y el perfil del estudiante, crea una BREVE adición personalizada que incluya:
1. **Un Problema Basado en sus Intereses**: Reformula un problema usando sus intereses ({INTERESTS}), con vocabulario apropiado para su nivel ({GRADE_LEVEL})
2. **Una Pregunta de Reflexión**: Una pregunta socrática que les ayude a pensar en el "por qué" detrás del concepto, apropiada para su nivel

IMPORTANTE: Adapta el tono, vocabulario y complejidad a su nivel educativo ({GRADE_LEVEL}).

Mantén la brevedad (2-3 párrafos cortos máximo). No reescribas toda la tarea - solo agrega el toque personalizado.

## Formato de Salida de Ejemplo:
**Tu Reto Personal:**
[Problema reformulado con su interés, apropiado para su edad]

**Piensa Más Profundo:**
[Pregunta socrática que los haga reflexionar, apropiada para su nivel]

## Tarea Maestra:
{MASTER_CONTENT}

## Perfil del Estudiante:
- Edad: {AGE}
- Nivel de Grado: {GRADE_LEVEL}
- Intereses: {INTERESTS}
- Habilidades a Mejorar: {SKILLS}
{LEARNING_STYLE}

## Adición Personalizada:`;

/**
 * Lesson context segment injected into the homework generation prompt
 * when a source lesson is selected by the teacher.
 */
const LESSON_CONTEXT_SEGMENT = `## CONTEXTO DE LA LECCIÓN (BASE DE CONOCIMIENTO)
El siguiente es el contenido de la lección que se impartió. Debes basar las preguntas de la tarea ESTRICTAMENTE en este contenido. Asegúrate de que el nivel de dificultad y la terminología coincidan exactamente con lo que se enseñó.

{LESSON_CONTENT}

## INSTRUCCIÓN ADICIONAL
Genera preguntas que evalúen específicamente el contenido de la lección anterior. No incluyas conceptos que no aparezcan en la lección.

---
`;

/**
 * JSON-focused prompt for generating structured homework content
 * Returns both displayable content AND structured questions array
 */
const MASTER_HOMEWORK_PROMPT = `Eres un educador experto creando tareas estructuradas para estudiantes de primaria y secundaria.

## INSTRUCCIONES CRÍTICAS
1. TODA tu respuesta DEBE estar en ESPAÑOL MEXICANO
2. DEBES responder ÚNICAMENTE con JSON válido - sin texto adicional antes ni después
3. El JSON debe incluir tanto el contenido para mostrar como las preguntas estructuradas

## FORMATO DE RESPUESTA OBLIGATORIO
{
  "title": "Título de la Tarea",
  "instructions": "Instrucciones generales para el estudiante (opcional)",
  "content": "# Contenido markdown completo de la tarea para mostrar al estudiante...",
  "questions": [
    {
      "id": 1,
      "text": "Texto completo de la pregunta 1",
      "type": "open"
    },
    {
      "id": 2,
      "text": "Texto completo de la pregunta 2",
      "type": "open"
    }
  ]
}

## TIPOS DE PREGUNTAS
- "open": Respuesta abierta (texto libre, problemas matemáticos, ensayos)
- "choice": Opción múltiple (incluir campo "options": ["A", "B", "C", "D"])

## EJEMPLO 1: Matemáticas
{
  "title": "Práctica de Multiplicación",
  "instructions": "Resuelve cada problema mostrando tu trabajo.",
  "content": "# Hoja de Práctica de Multiplicación\\n\\n## Parte 1: Multiplicación Básica\\n1. 7 × 8 = ___\\n2. 6 × 9 = ___\\n\\n## Parte 2: Problemas con Palabras\\n3. Un panadero hace 6 charolas de galletas. Cada charola tiene 8 galletas. ¿Cuántas galletas hay en total?\\n\\n4. Hay 7 días en una semana. ¿Cuántos días hay en 4 semanas?",
  "questions": [
    {"id": 1, "text": "7 × 8 = ___", "type": "open"},
    {"id": 2, "text": "6 × 9 = ___", "type": "open"},
    {"id": 3, "text": "Un panadero hace 6 charolas de galletas. Cada charola tiene 8 galletas. ¿Cuántas galletas hay en total?", "type": "open"},
    {"id": 4, "text": "Hay 7 días en una semana. ¿Cuántos días hay en 4 semanas?", "type": "open"}
  ]
}

## EJEMPLO 2: Ciencias
{
  "title": "El Ciclo del Agua",
  "instructions": "Lee cada pregunta cuidadosamente y responde con oraciones completas.",
  "content": "# Tarea: El Ciclo del Agua\\n\\nResponde las siguientes preguntas sobre el ciclo del agua:\\n\\n1. ¿Qué es la evaporación?\\n2. ¿Qué sucede durante la condensación?\\n3. ¿Por qué es importante el ciclo del agua para los seres vivos?",
  "questions": [
    {"id": 1, "text": "¿Qué es la evaporación?", "type": "open"},
    {"id": 2, "text": "¿Qué sucede durante la condensación?", "type": "open"},
    {"id": 3, "text": "¿Por qué es importante el ciclo del agua para los seres vivos?", "type": "open"}
  ]
}

## TU TAREA
Crea una tarea completa sobre el tema dado. Incluye:
- 3-8 preguntas variadas
- Instrucciones claras
- Contenido educativo apropiado para el nivel

**Tema:** {{TOPIC}}
**Materia:** {{SUBJECT}}

RESPONDE ÚNICAMENTE CON JSON VÁLIDO:`;

export const homeworkService = {
  /**
   * Get personalization progress
   */
  getProgress(homeworkId: string): PersonalizationProgress | null {
    return progressMap.get(homeworkId) || null;
  },

  /**
   * Generate master homework content using AI (streaming)
   * Uses 'reasoner' model for high-quality content generation
   */
  async *generateMasterContentStream(
    topic: string,
    subject?: string,
    lessonId?: string
  ): AsyncGenerator<{ text: string; done: boolean }> {
    let prompt = MASTER_HOMEWORK_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    // Inject lesson context if a source lesson is provided
    if (lessonId) {
      const lesson = lessonsQueries.getById(lessonId);
      if (lesson) {
        const contextSegment = LESSON_CONTEXT_SEGMENT.replace('{LESSON_CONTENT}', lesson.masterContent);
        // Prepend lesson context before the ## TU TAREA block
        prompt = prompt.replace('## TU TAREA', contextSegment + '## TU TAREA');
        console.log(`[Homework] Using lesson context from "${lesson.title}" for generation`);
      }
    }

    // Use reasoner model for high-quality master content
    yield* ollamaService.generateStream(prompt, undefined, undefined, 'reasoner');
  },

  /**
   * Parse JSON homework content from AI response
   * Handles various edge cases like markdown code blocks
   */
  parseHomeworkJson(rawContent: string): HomeworkContentJson | null {
    try {
      // Remove markdown code blocks if present
      let jsonStr = rawContent.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      // Try to find JSON object in the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[Homework] No JSON object found in response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]) as HomeworkContentJson;

      // Validate required fields
      if (!parsed.title || !parsed.questions || !Array.isArray(parsed.questions)) {
        console.error('[Homework] Invalid JSON structure - missing title or questions');
        return null;
      }

      // Validate questions array
      if (parsed.questions.length === 0) {
        console.error('[Homework] No questions in parsed JSON');
        return null;
      }

      // Ensure all questions have required fields
      const validatedQuestions: HomeworkQuestionJson[] = parsed.questions.map((q, index) => ({
        id: q.id || index + 1,
        text: q.text || `Pregunta ${index + 1}`,
        type: q.type === 'choice' ? 'choice' : 'open',
        options: q.options,
      }));

      return {
        title: parsed.title,
        instructions: parsed.instructions,
        questions: validatedQuestions,
      };
    } catch (err) {
      console.error('[Homework] Failed to parse JSON:', err);
      return null;
    }
  },

  /**
   * Generate master homework content using AI (non-streaming)
   * Uses 'reasoner' model for high-quality content generation
   * Returns both displayable content AND structured questions array
   */
  async generateMasterContent(topic: string, subject?: string, lessonId?: string): Promise<{ content: string; questions: HomeworkQuestionJson[] }> {
    let prompt = MASTER_HOMEWORK_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    // Inject lesson context if a source lesson is provided
    if (lessonId) {
      const lesson = lessonsQueries.getById(lessonId);
      if (lesson) {
        const contextSegment = LESSON_CONTEXT_SEGMENT.replace('{LESSON_CONTENT}', lesson.masterContent);
        prompt = prompt.replace('## TU TAREA', contextSegment + '## TU TAREA');
        console.log(`[Homework] Using lesson context from "${lesson.title}" for generation`);
      }
    }

    // Use reasoner model for high-quality master content
    const rawContent = await ollamaService.generate(prompt, undefined, undefined, 'reasoner');

    // Parse JSON response
    const parsedJson = this.parseHomeworkJson(rawContent);

    if (parsedJson) {
      console.log(`[Homework] Generated ${parsedJson.questions.length} questions for "${parsedJson.title}"`);

      // Format the content through gatekeeper for proper LaTeX
      const contentToFormat = parsedJson.instructions
        ? `# ${parsedJson.title}\n\n${parsedJson.instructions}\n\n${parsedJson.questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n\n')}`
        : `# ${parsedJson.title}\n\n${parsedJson.questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n\n')}`;

      const formatted = await aiGatekeeper.formatHomeworkContent(contentToFormat, subject);

      return {
        content: formatted.content,
        questions: parsedJson.questions,
      };
    }

    // Fallback: If JSON parsing failed, use legacy format and extract questions
    console.warn('[Homework] JSON parsing failed, using legacy content format');
    const formatted = await aiGatekeeper.formatHomeworkContent(rawContent.trim(), subject);

    // Generate fallback questions from content
    const fallbackQuestions = this.extractQuestionsFromContent(formatted.content);

    console.log(`[Homework] Generated master content (fallback): ${formatted.metadata.wordCount} words, ${fallbackQuestions.length} questions`);

    return {
      content: formatted.content,
      questions: fallbackQuestions,
    };
  },

  /**
   * Extract questions from legacy markdown content (fallback method)
   */
  extractQuestionsFromContent(content: string): HomeworkQuestionJson[] {
    const questions: HomeworkQuestionJson[] = [];

    // Pattern to match numbered questions: "1. Question text" or "1) Question text"
    const pattern = /(?:^|\n)\s*(\d+)[.)]\s*(.+?)(?=(?:\n\s*\d+[.)])|$)/gs;
    const matches = [...content.matchAll(pattern)];

    if (matches.length > 0) {
      matches.forEach((match) => {
        const questionNumber = parseInt(match[1], 10);
        let questionText = match[2].trim()
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/\*{2,}/g, '')
          .trim();

        // Skip empty or too short questions
        if (questionText.length < 5) return;

        questions.push({
          id: questionNumber,
          text: questionText,
          type: 'open',
        });
      });
    }

    // If no questions found, create a single response question
    if (questions.length === 0) {
      questions.push({
        id: 1,
        text: 'Responde a la tarea',
        type: 'open',
      });
    }

    return questions;
  },

  /**
   * Personalize homework content for a specific student (uses chat model for speed)
   * Uses pedagogical persona for age-appropriate content
   * Personalized content is formatted through the AI Gatekeeper
   */
  async personalizeContent(
    masterContent: string,
    profile: PersonalizationContext
  ): Promise<string> {
    const interests = profile.interests.length > 0 ? profile.interests.join(', ') : 'temas generales';
    const skills = profile.skillsToImprove.length > 0 ? profile.skillsToImprove.join(', ') : 'aprendizaje general';

    // Get the appropriate pedagogical persona
    const persona = getPedagogicalPersona(profile.age, profile.gradeLevel);
    console.log(`[Homework] Personalizing with persona: ${persona.name} for age=${profile.age}, grade=${profile.gradeLevel}`);

    let prompt = SOCRATIC_PERSONALIZATION_PROMPT
      .replace('{MASTER_CONTENT}', masterContent)
      .replace(/\{AGE\}/g, profile.age?.toString() || 'desconocida')
      .replace(/\{GRADE_LEVEL\}/g, profile.gradeLevel || persona.gradeRange)
      .replace(/\{INTERESTS\}/g, interests)
      .replace(/\{SKILLS\}/g, skills)
      .replace('{PERSONA_SEGMENT}', persona.systemPromptSegment);

    // Add learning style if present
    if (profile.learningSystemPrompt) {
      prompt = prompt.replace(
        '{LEARNING_STYLE}',
        `- Estilo de Aprendizaje: ${profile.learningSystemPrompt}`
      );
    } else {
      prompt = prompt.replace('{LEARNING_STYLE}', '');
    }

    // Use chat model for fast personalization
    const rawContent = await ollamaService.generate(prompt, undefined, undefined, 'chat');

    // Format through gatekeeper (quick format for speed)
    const formatted = aiGatekeeper.formatSync(rawContent.trim(), {
      contentType: 'homework',
      requireLatex: true,
    });

    return formatted.content;
  },

  /**
   * Create a homework assignment and optionally personalize for students (in classroom or all)
   */
  async createHomework(
    teacherId: string,
    data: {
      title: string;
      topic: string;
      subject?: string;
      masterContent?: string;
      questionsJson?: HomeworkQuestionJson[];
      dueDate?: string;
      classroomId?: string;
      generateForStudents?: boolean;
      sourceLessonId?: string;
    }
  ): Promise<HomeworkAssignment> {
    // Generate master content if not provided
    let masterContent = data.masterContent;
    let questionsJson = data.questionsJson;

    if (!masterContent) {
      const generated = await this.generateMasterContent(data.topic, data.subject, data.sourceLessonId);
      masterContent = generated.content;
      questionsJson = generated.questions;
    }

    // Create the homework with structured questions
    const homework = homeworkQueries.create({
      teacherId,
      title: data.title,
      topic: data.topic,
      subject: data.subject,
      masterContent,
      questionsJson,
      dueDate: data.dueDate,
      classroomId: data.classroomId,
      sourceLessonId: data.sourceLessonId,
    });

    console.log(`[Homework] Created homework with ${questionsJson?.length || 0} structured questions`);

    // Personalize for students if requested (run in background)
    if (data.generateForStudents) {
      // Don't await - let it run in background
      this.personalizeForStudentsInClassroom(homework.id, data.classroomId).catch((err) => {
        console.error('[Homework] Background personalization failed:', err);
      });
    }

    return homework;
  },

  /**
   * Personalize homework for students in a specific classroom (or all if no classroom)
   * Uses Promise.all for concurrent personalization (much faster!)
   */
  async personalizeForStudentsInClassroom(homeworkId: string, classroomId?: string): Promise<number> {
    const homework = homeworkQueries.getById(homeworkId);
    if (!homework) {
      throw new Error('Homework not found');
    }

    // Get profiles - filter by classroom if specified
    let profiles: StudentProfileWithUser[];
    if (classroomId) {
      // Get only students in the specified classroom
      const allProfiles = studentProfilesQueries.getAllWithUserDetails();
      profiles = allProfiles.filter(p => p.classroomId === classroomId);
    } else {
      profiles = studentProfilesQueries.getAllWithUserDetails();
    }

    // Filter out students who already have personalized content
    const profilesToPersonalize = profiles.filter((profile) => {
      const existing = homeworkQueries.getPersonalizedByHomeworkAndStudent(
        homeworkId,
        profile.userId
      );
      return !existing;
    });

    if (profilesToPersonalize.length === 0) {
      return 0;
    }

    // Initialize progress tracking
    progressMap.set(homeworkId, {
      homeworkId,
      total: profilesToPersonalize.length,
      completed: 0,
      current: null,
      status: 'in_progress',
    });

    console.log(`[Homework] Starting parallel personalization for ${profilesToPersonalize.length} students`);
    const startTime = Date.now();

    // Create personalization promises for all students (CONCURRENT!)
    const personalizationPromises = profilesToPersonalize.map(async (profile) => {
      const context: PersonalizationContext = {
        age: profile.age,
        gradeLevel: profile.gradeLevel,
        interests: profile.favoriteSports || [],
        skillsToImprove: profile.skillsToImprove || [],
        learningSystemPrompt: profile.learningSystemPrompt,
      };

      try {
        // Update progress
        const progress = progressMap.get(homeworkId);
        if (progress) {
          progress.current = profile.user?.name || profile.userId;
        }

        const personalizedContent = await this.personalizeContent(
          homework.masterContent,
          context
        );

        // Inherit questions from master homework
        homeworkQueries.createPersonalized({
          homeworkId,
          studentId: profile.userId,
          personalizedContent,
          questionsJson: homework.questionsJson,
        });

        // Update progress
        if (progress) {
          progress.completed++;
        }

        return { success: true, studentId: profile.userId };
      } catch (error) {
        console.error(`Failed to personalize homework for student ${profile.userId}:`, error);
        return { success: false, studentId: profile.userId, error };
      }
    });

    // Run all personalizations concurrently
    const results = await Promise.all(personalizationPromises);

    const elapsed = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;

    console.log(`[Homework] Completed personalization for ${successCount}/${profilesToPersonalize.length} students in ${elapsed}ms`);

    // Update progress to completed
    const progress = progressMap.get(homeworkId);
    if (progress) {
      progress.status = 'completed';
      progress.current = null;
    }

    // Clean up progress after 5 minutes
    setTimeout(() => {
      progressMap.delete(homeworkId);
    }, 5 * 60 * 1000);

    return successCount;
  },

  /**
   * Personalize homework for all students (backwards compatible)
   */
  async personalizeForAllStudents(homeworkId: string): Promise<number> {
    return this.personalizeForStudentsInClassroom(homeworkId, undefined);
  },

  /**
   * Personalize homework for a specific student
   */
  async personalizeForStudent(homeworkId: string, studentId: string): Promise<void> {
    const homework = homeworkQueries.getById(homeworkId);
    if (!homework) {
      throw new Error('Homework not found');
    }

    // Check if already personalized
    const existing = homeworkQueries.getPersonalizedByHomeworkAndStudent(homeworkId, studentId);
    if (existing) {
      return;
    }

    // Get student profile
    const context = studentProfilesQueries.getPersonalizationContext(studentId);
    if (!context) {
      // Create basic personalized content without profile, inherit questions
      homeworkQueries.createPersonalized({
        homeworkId,
        studentId,
        personalizedContent: homework.masterContent,
        questionsJson: homework.questionsJson,
      });
      return;
    }

    const personalizedContent = await this.personalizeContent(homework.masterContent, context);

    // Inherit questions from master homework
    homeworkQueries.createPersonalized({
      homeworkId,
      studentId,
      personalizedContent,
      questionsJson: homework.questionsJson,
    });
  },
};
