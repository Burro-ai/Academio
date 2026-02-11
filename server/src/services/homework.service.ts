import { ollamaService, ModelType } from './ollama.service';
import { homeworkQueries } from '../database/queries/homework.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { HomeworkAssignment, PersonalizationContext, StudentProfileWithUser } from '../types';

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
 */
const SOCRATIC_PERSONALIZATION_PROMPT = `Eres un tutor socrático personalizando tareas para un estudiante específico.

## Tu Tarea
Dado la tarea maestra y el perfil del estudiante, crea una BREVE adición personalizada que incluya:
1. **Un Problema Basado en sus Intereses**: Reformula un problema usando sus intereses ({INTERESTS})
2. **Una Pregunta de Reflexión**: Una pregunta socrática que les ayude a pensar en el "por qué" detrás del concepto

Mantén la brevedad (2-3 párrafos cortos máximo). No reescribas toda la tarea - solo agrega el toque personalizado.

## Formato de Salida de Ejemplo:
**Tu Reto Personal:**
[Problema reformulado con su interés]

**Piensa Más Profundo:**
[Pregunta socrática que los haga reflexionar sobre el concepto subyacente]

## Tarea Maestra:
{MASTER_CONTENT}

## Perfil del Estudiante:
- Edad: {AGE}
- Intereses: {INTERESTS}
- Habilidades a Mejorar: {SKILLS}
{LEARNING_STYLE}

## Adición Personalizada:`;

/**
 * Few-shot prompt for generating master homework content (uses reasoner model)
 */
const MASTER_HOMEWORK_PROMPT = `Eres un educador experto creando tareas para estudiantes de primaria y secundaria.

## Ejemplo 1:
**Tema:** Práctica de Multiplicación
**Materia:** Matemáticas
**Contenido:**
# Hoja de Práctica de Multiplicación

## Parte 1: Multiplicación Básica (5 puntos cada una)
1. 7 × 8 = ___
2. 6 × 9 = ___
3. 12 × 5 = ___
4. 8 × 8 = ___
5. 9 × 7 = ___

## Parte 2: Problemas con Palabras (10 puntos cada uno)
1. Un panadero hace 6 charolas de galletas. Cada charola tiene 8 galletas. ¿Cuántas galletas hay en total?

2. Hay 7 días en una semana. ¿Cuántos días hay en 4 semanas?

3. Un salón tiene 5 filas de escritorios con 6 escritorios en cada fila. ¿Cuántos escritorios hay en total?

## Parte 3: Desafío (15 puntos)
Un granjero planta 8 filas de maíz con 12 plantas en cada fila. Cada planta produce 3 mazorcas de maíz. ¿Cuántas mazorcas de maíz cosecha el granjero en total?

**¡Muestra tu trabajo!**

## Ejemplo 2:
**Tema:** Escritura de Ensayos: Argumentos Persuasivos
**Materia:** Español
**Contenido:**
# Tarea de Ensayo Persuasivo

## Objetivo
Escribe un ensayo persuasivo de 3 párrafos sobre uno de estos temas:
- ¿Deberían los estudiantes tener tarea los fines de semana?
- ¿Debería la escuela empezar más tarde en la mañana?
- ¿Deberían los estudiantes poder usar teléfonos en clase?

## Requisitos
1. **Introducción (1 párrafo)**
   - Gancho para captar la atención
   - Tesis clara (tu posición)

2. **Cuerpo (1 párrafo)**
   - Al menos 2 razones de apoyo
   - Evidencia o ejemplos para cada razón

3. **Conclusión (1 párrafo)**
   - Reafirma tu posición
   - Llamada a la acción

## Rúbrica
- Tesis clara: 10 puntos
- Evidencia de apoyo: 15 puntos
- Organización: 10 puntos
- Gramática/ortografía: 5 puntos
- Total: 40 puntos

**Fecha de entrega: ___________**

## Tu Tarea:
Crea una tarea completa sobre el tema dado. Incluye instrucciones claras, múltiples tipos de problemas y una rúbrica de calificación si es apropiado.

**Tema:** {{TOPIC}}
**Materia:** {{SUBJECT}}
**Contenido:`;

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
    subject?: string
  ): AsyncGenerator<{ text: string; done: boolean }> {
    const prompt = MASTER_HOMEWORK_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    // Use reasoner model for high-quality master content
    yield* ollamaService.generateStream(prompt, undefined, undefined, 'reasoner');
  },

  /**
   * Generate master homework content using AI (non-streaming)
   * Uses 'reasoner' model for high-quality content generation
   */
  async generateMasterContent(topic: string, subject?: string): Promise<string> {
    const prompt = MASTER_HOMEWORK_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    // Use reasoner model for high-quality master content
    const content = await ollamaService.generate(prompt, undefined, undefined, 'reasoner');
    return content.trim();
  },

  /**
   * Personalize homework content for a specific student (uses chat model for speed)
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
    const content = await ollamaService.generate(prompt, undefined, undefined, 'chat');
    return content.trim();
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
      dueDate?: string;
      classroomId?: string;
      generateForStudents?: boolean;
    }
  ): Promise<HomeworkAssignment> {
    // Generate master content if not provided
    let masterContent = data.masterContent;
    if (!masterContent) {
      masterContent = await this.generateMasterContent(data.topic, data.subject);
    }

    // Create the homework
    const homework = homeworkQueries.create({
      teacherId,
      title: data.title,
      topic: data.topic,
      subject: data.subject,
      masterContent,
      dueDate: data.dueDate,
      classroomId: data.classroomId,
    });

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

        homeworkQueries.createPersonalized({
          homeworkId,
          studentId: profile.userId,
          personalizedContent,
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
      // Create basic personalized content without profile
      homeworkQueries.createPersonalized({
        homeworkId,
        studentId,
        personalizedContent: homework.masterContent,
      });
      return;
    }

    const personalizedContent = await this.personalizeContent(homework.masterContent, context);

    homeworkQueries.createPersonalized({
      homeworkId,
      studentId,
      personalizedContent,
    });
  },
};
