import { ollamaService, ModelType } from './ollama.service';
import { aiGatekeeper } from './aiGatekeeper.service';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { Lesson, PersonalizationContext, StudentProfileWithUser } from '../types';

/**
 * Progress tracking for personalization
 */
export interface PersonalizationProgress {
  lessonId: string;
  total: number;
  completed: number;
  current: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

// In-memory progress tracking (can be replaced with Redis for production)
const progressMap = new Map<string, PersonalizationProgress>();

/**
 * Socratic personalization prompt - creates tailored analogies and reflection questions
 */
const SOCRATIC_PERSONALIZATION_PROMPT = `Eres un tutor socrático personalizando contenido educativo para un estudiante específico.

## Tu Tarea
Dado el contenido maestro de la lección y el perfil del estudiante, crea una BREVE adición personalizada que incluya:
1. **Una Analogía Específica**: Crea una analogía relacionable usando sus intereses (${'{INTERESTS}'})
2. **Una Pregunta de Reflexión**: Una pregunta que invite a la reflexión y conecte el tema con su vida y ayude con sus habilidades (${'{SKILLS}'})

Mantén la brevedad (2-3 párrafos cortos máximo). No reescribas toda la lección - solo agrega el toque personalizado.

## Formato de Salida de Ejemplo:
**Tu Conexión Personal:**
[Analogía conectando con su interés]

**Piensa en Esto:**
[Pregunta socrática que los haga reflexionar y conecte con las habilidades que quieren mejorar]

## Contenido Maestro:
{MASTER_CONTENT}

## Perfil del Estudiante:
- Edad: {AGE}
- Intereses: {INTERESTS}
- Habilidades a Mejorar: {SKILLS}
{LEARNING_STYLE}

## Adición Personalizada:`;

/**
 * Few-shot prompt for generating master lesson content (uses reasoner model)
 */
const MASTER_LESSON_PROMPT = `Eres un educador experto creando contenido de lecciones para estudiantes de primaria y secundaria.

## Ejemplo 1:
**Tema:** Introducción a las Fracciones
**Materia:** Matemáticas
**Contenido:**
# ¿Qué Son las Fracciones?

Una fracción representa una parte de un todo. ¡Cuando dividimos algo en partes iguales y tomamos algunas de esas partes, estamos usando fracciones!

## Las Partes de una Fracción
- **Numerador** (número de arriba): Cuántas partes tenemos
- **Denominador** (número de abajo): En cuántas partes iguales está dividido el todo

## Ejemplos de la Vida Real
- Media pizza: 1/2 (1 rebanada de 2 rebanadas iguales)
- Tres cuartos de un peso: 3/4 (3 monedas de 4)
- Dos tercios de una barra de chocolate: 2/3

## Conceptos Clave
1. El denominador nos dice el TAMAÑO de cada pieza
2. El numerador nos dice CUÁNTAS piezas tenemos
3. Cuando el numerador = denominador, tenemos un entero (4/4 = 1)

## Preguntas de Práctica
1. Si comes 2 rebanadas de una pizza de 8 rebanadas, ¿qué fracción comiste?
2. Dibuja un rectángulo dividido en 5 partes iguales. Sombrea 3 de ellas. ¿Qué fracción está sombreada?

## Tu Tarea:
Crea una lección completa y educativa sobre el tema dado. Incluye explicaciones claras, ejemplos y preguntas para verificar la comprensión.

**Tema:** {{TOPIC}}
**Materia:** {{SUBJECT}}
**Contenido:**`;

export const lessonService = {
  /**
   * Get personalization progress
   */
  getProgress(lessonId: string): PersonalizationProgress | null {
    return progressMap.get(lessonId) || null;
  },

  /**
   * Generate master lesson content using AI (streaming)
   * Uses 'reasoner' model for high-quality content generation
   */
  async *generateMasterContentStream(
    topic: string,
    subject?: string
  ): AsyncGenerator<{ text: string; done: boolean }> {
    const prompt = MASTER_LESSON_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    // Use reasoner model for high-quality master content
    yield* ollamaService.generateStream(prompt, undefined, undefined, 'reasoner');
  },

  /**
   * Generate master lesson content using AI (non-streaming)
   * Uses 'reasoner' model for high-quality content generation
   * Content is formatted through the AI Gatekeeper for proper LaTeX and structure
   */
  async generateMasterContent(topic: string, subject?: string): Promise<string> {
    const prompt = MASTER_LESSON_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    // Use reasoner model for high-quality master content
    const rawContent = await ollamaService.generate(prompt, undefined, undefined, 'reasoner');

    // Format through gatekeeper for proper LaTeX and structure
    const formatted = await aiGatekeeper.formatLessonContent(rawContent.trim(), subject);

    console.log(`[Lesson] Generated master content: ${formatted.metadata.wordCount} words, LaTeX: ${formatted.metadata.hasLatex}`);

    return formatted.content;
  },

  /**
   * Personalize lesson content for a specific student (uses chat model for speed)
   * Personalized content is formatted through the AI Gatekeeper
   */
  async personalizeContent(
    masterContent: string,
    profile: PersonalizationContext
  ): Promise<string> {
    const interests = profile.interests.length > 0 ? profile.interests.join(', ') : 'general topics';
    const skills = profile.skillsToImprove.length > 0 ? profile.skillsToImprove.join(', ') : 'general learning';

    let prompt = SOCRATIC_PERSONALIZATION_PROMPT
      .replace('{MASTER_CONTENT}', masterContent)
      .replace(/\{AGE\}/g, profile.age?.toString() || 'unknown')
      .replace(/\{INTERESTS\}/g, interests)
      .replace(/\{SKILLS\}/g, skills);

    // Add learning style if present
    if (profile.learningSystemPrompt) {
      prompt = prompt.replace(
        '{LEARNING_STYLE}',
        `- Learning Style: ${profile.learningSystemPrompt}`
      );
    } else {
      prompt = prompt.replace('{LEARNING_STYLE}', '');
    }

    // Use chat model for fast personalization
    const rawContent = await ollamaService.generate(prompt, undefined, undefined, 'chat');

    // Format through gatekeeper (quick format for speed)
    const formatted = aiGatekeeper.formatSync(rawContent.trim(), {
      contentType: 'lesson',
      requireLatex: true,
    });

    return formatted.content;
  },

  /**
   * Create a lesson and optionally personalize for students (in classroom or all)
   */
  async createLesson(
    teacherId: string,
    data: {
      title: string;
      topic: string;
      subject?: string;
      masterContent?: string;
      classroomId?: string;
      generateForStudents?: boolean;
    }
  ): Promise<Lesson> {
    // Generate master content if not provided
    let masterContent = data.masterContent;
    if (!masterContent) {
      masterContent = await this.generateMasterContent(data.topic, data.subject);
    }

    // Create the lesson
    const lesson = lessonsQueries.create({
      teacherId,
      title: data.title,
      topic: data.topic,
      subject: data.subject,
      masterContent,
      classroomId: data.classroomId,
    });

    // Personalize for students if requested (run in background)
    if (data.generateForStudents) {
      // Don't await - let it run in background
      this.personalizeForStudentsInClassroom(lesson.id, data.classroomId).catch((err) => {
        console.error('[Lesson] Background personalization failed:', err);
      });
    }

    return lesson;
  },

  /**
   * Personalize a lesson for students in a specific classroom (or all if no classroom)
   * Uses Promise.all for concurrent personalization (much faster!)
   */
  async personalizeForStudentsInClassroom(lessonId: string, classroomId?: string): Promise<number> {
    const lesson = lessonsQueries.getById(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
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
      const existing = lessonsQueries.getPersonalizedByLessonAndStudent(
        lessonId,
        profile.userId
      );
      return !existing;
    });

    if (profilesToPersonalize.length === 0) {
      return 0;
    }

    // Initialize progress tracking
    progressMap.set(lessonId, {
      lessonId,
      total: profilesToPersonalize.length,
      completed: 0,
      current: null,
      status: 'in_progress',
    });

    console.log(`[Lesson] Starting parallel personalization for ${profilesToPersonalize.length} students`);
    const startTime = Date.now();

    // Create personalization promises for all students (CONCURRENT!)
    const personalizationPromises = profilesToPersonalize.map(async (profile) => {
      const context: PersonalizationContext = {
        age: profile.age,
        interests: profile.favoriteSports || [],
        skillsToImprove: profile.skillsToImprove || [],
        learningSystemPrompt: profile.learningSystemPrompt,
      };

      try {
        // Update progress
        const progress = progressMap.get(lessonId);
        if (progress) {
          progress.current = profile.user?.name || profile.userId;
        }

        const personalizedContent = await this.personalizeContent(
          lesson.masterContent,
          context
        );

        lessonsQueries.createPersonalized({
          lessonId,
          studentId: profile.userId,
          personalizedContent,
        });

        // Update progress
        if (progress) {
          progress.completed++;
        }

        return { success: true, studentId: profile.userId };
      } catch (error) {
        console.error(`Failed to personalize lesson for student ${profile.userId}:`, error);
        return { success: false, studentId: profile.userId, error };
      }
    });

    // Run all personalizations concurrently
    const results = await Promise.all(personalizationPromises);

    const elapsed = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;

    console.log(`[Lesson] Completed personalization for ${successCount}/${profilesToPersonalize.length} students in ${elapsed}ms`);

    // Update progress to completed
    const progress = progressMap.get(lessonId);
    if (progress) {
      progress.status = 'completed';
      progress.current = null;
    }

    // Clean up progress after 5 minutes
    setTimeout(() => {
      progressMap.delete(lessonId);
    }, 5 * 60 * 1000);

    return successCount;
  },

  /**
   * Personalize a lesson for all students (backwards compatible)
   */
  async personalizeForAllStudents(lessonId: string): Promise<number> {
    return this.personalizeForStudentsInClassroom(lessonId, undefined);
  },

  /**
   * Personalize a lesson for a specific student
   */
  async personalizeForStudent(lessonId: string, studentId: string): Promise<void> {
    const lesson = lessonsQueries.getById(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    // Check if already personalized
    const existing = lessonsQueries.getPersonalizedByLessonAndStudent(lessonId, studentId);
    if (existing) {
      return;
    }

    // Get student profile
    const context = studentProfilesQueries.getPersonalizationContext(studentId);
    if (!context) {
      // Create basic personalized content without profile
      lessonsQueries.createPersonalized({
        lessonId,
        studentId,
        personalizedContent: lesson.masterContent,
      });
      return;
    }

    const personalizedContent = await this.personalizeContent(lesson.masterContent, context);

    lessonsQueries.createPersonalized({
      lessonId,
      studentId,
      personalizedContent,
    });
  },
};
