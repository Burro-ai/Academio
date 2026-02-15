import { ollamaService } from './ollama.service';
import { aiGatekeeper, getPedagogicalPersona, PedagogicalPersona } from './aiGatekeeper.service';
import { homeworkSubmissionsQueries, HomeworkAnswer } from '../database/queries/homeworkSubmissions.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';

/**
 * Homework Grading Service
 * Provides AI-powered grading suggestions for homework submissions
 */
class HomeworkGradingService {
  /**
   * Build a prompt for AI grading with age-appropriate feedback
   */
  private buildGradingPrompt(
    homeworkContent: string,
    answers: HomeworkAnswer[],
    persona: PedagogicalPersona
  ): string {
    const answersFormatted = answers
      .map((a, i) => `Pregunta ${i + 1} (ID: ${a.questionId}):\nRespuesta del Estudiante: ${a.value}`)
      .join('\n\n');

    return `Eres un evaluador educativo experto. Evalúa la entrega de tarea del estudiante y proporciona una evaluación justa y constructiva.

## REGLA CRÍTICA DE IDIOMA
- TODO tu contenido DEBE estar en ESPAÑOL MEXICANO
- NUNCA uses inglés bajo ninguna circunstancia

## PERFIL DEL ESTUDIANTE
Este estudiante es de nivel: ${persona.gradeRange} (${persona.ageRange})
Adapta tu retroalimentación al nivel y tono apropiado para su edad.

${persona.systemPromptSegment}

## Contenido de la Tarea
${homeworkContent}

## Respuestas Entregadas por el Estudiante
${answersFormatted}

## Tu Tarea
1. Evalúa cada respuesta por corrección, completitud y comprensión
2. Considera crédito parcial para respuestas parcialmente correctas
3. Proporciona una calificación numérica de 0 a 100
4. Escribe retroalimentación constructiva que:
   - Reconozca lo que el estudiante hizo bien
   - Explique cualquier error de manera alentadora usando el tono apropiado para su edad
   - Sugiera cómo pueden mejorar de forma motivadora

## Formato de Respuesta
Responde ÚNICAMENTE en el siguiente formato JSON (sin texto adicional):
{
  "grade": <número 0-100>,
  "feedback": "<retroalimentación constructiva EN ESPAÑOL, adaptada a la edad del estudiante>"
}

IMPORTANTE: El campo "feedback" DEBE estar completamente en ESPAÑOL MEXICANO y adaptado al nivel del estudiante.`;
  }

  /**
   * Generate AI grading suggestion for a submission
   */
  async generateAISuggestion(
    submissionId: string,
    homeworkContent: string,
    answers: HomeworkAnswer[],
    studentId?: string
  ): Promise<{ grade: number; feedback: string }> {
    // Get student profile to determine appropriate persona
    let persona = getPedagogicalPersona(); // Default
    if (studentId) {
      const studentProfile = studentProfilesQueries.getByUserId(studentId);
      if (studentProfile) {
        persona = getPedagogicalPersona(studentProfile.age, studentProfile.gradeLevel);
        console.log(`[HomeworkGrading] Using persona: ${persona.name} for student ${studentId}`);
      }
    }

    const systemPrompt = `Eres una IA de evaluación educativa. Proporcionas calificaciones justas y alentadoras y retroalimentación para las tareas de los estudiantes.

REGLA CRÍTICA DE IDIOMA: SIEMPRE debes responder en ESPAÑOL MEXICANO. Nunca uses inglés. Toda la retroalimentación debe estar en español.

Adapta tu tono y vocabulario al nivel del estudiante: ${persona.gradeRange} (${persona.ageRange}).

Siempre responde únicamente en formato JSON válido con el campo "feedback" en español.`;

    const prompt = this.buildGradingPrompt(homeworkContent, answers, persona);

    try {
      // Use the AI service to generate grading suggestion
      const response = await ollamaService.generate(prompt, undefined, systemPrompt);

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI response format');
      }

      const result = JSON.parse(jsonMatch[0]) as { grade: number; feedback: string };

      // Validate grade is in range
      const grade = Math.max(0, Math.min(100, result.grade));
      const rawFeedback = result.feedback || 'Sin retroalimentación proporcionada.';

      // Format the feedback through the gatekeeper for proper LaTeX and structure
      const formattedResult = aiGatekeeper.formatSync(rawFeedback, {
        contentType: 'grading',
        requireLatex: true,
      });

      const feedback = formattedResult.content;

      // Save the AI suggestion to the database
      homeworkSubmissionsQueries.updateAISuggestion(submissionId, grade, feedback);

      return { grade, feedback };
    } catch (error) {
      console.error('[HomeworkGrading] AI suggestion error:', error);

      // Return a neutral response on error
      return {
        grade: 0,
        feedback: 'No se pudo generar la sugerencia de IA. Por favor califique manualmente.',
      };
    }
  }

  /**
   * Process a new submission and generate AI suggestions
   */
  async processSubmission(
    personalizedHomeworkId: string,
    studentId: string,
    answers: HomeworkAnswer[],
    homeworkContent: string
  ): Promise<{
    submissionId: string;
    aiSuggestion?: { grade: number; feedback: string };
  }> {
    // Create the submission
    const submission = homeworkSubmissionsQueries.create(
      personalizedHomeworkId,
      studentId,
      answers
    );

    // Generate AI suggestion asynchronously with student context
    let aiSuggestion: { grade: number; feedback: string } | undefined;
    try {
      aiSuggestion = await this.generateAISuggestion(
        submission.id,
        homeworkContent,
        answers,
        studentId
      );
    } catch (error) {
      console.error('[HomeworkGrading] Failed to generate AI suggestion:', error);
    }

    return {
      submissionId: submission.id,
      aiSuggestion,
    };
  }

  /**
   * Get pending submissions for a teacher
   */
  getPendingSubmissions(teacherId: string) {
    return homeworkSubmissionsQueries.getPendingByTeacher(teacherId);
  }

  /**
   * Get all submissions for a homework assignment
   */
  getSubmissionsByHomework(homeworkId: string) {
    return homeworkSubmissionsQueries.getAllByHomework(homeworkId);
  }

  /**
   * Get submission by ID
   */
  getSubmission(submissionId: string) {
    return homeworkSubmissionsQueries.getById(submissionId);
  }

  /**
   * Get submission by homework and student
   */
  getSubmissionByHomeworkAndStudent(personalizedHomeworkId: string, studentId: string) {
    return homeworkSubmissionsQueries.getByHomeworkAndStudent(personalizedHomeworkId, studentId);
  }

  /**
   * Grade a submission
   */
  gradeSubmission(
    submissionId: string,
    grade: number,
    feedback: string,
    gradedBy: string
  ) {
    return homeworkSubmissionsQueries.updateGrade(submissionId, grade, feedback, gradedBy);
  }

  /**
   * Check if a student has already submitted
   */
  hasSubmitted(personalizedHomeworkId: string, studentId: string): boolean {
    return homeworkSubmissionsQueries.hasSubmitted(personalizedHomeworkId, studentId);
  }

  /**
   * Get submission statistics for a homework
   */
  getSubmissionStats(homeworkId: string) {
    return homeworkSubmissionsQueries.countByHomework(homeworkId);
  }
}

export const homeworkGradingService = new HomeworkGradingService();
