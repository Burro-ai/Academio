import { ollamaService } from './ollama.service';
import { aiGatekeeper } from './aiGatekeeper.service';
import { homeworkSubmissionsQueries, HomeworkAnswer } from '../database/queries/homeworkSubmissions.queries';

/**
 * Homework Grading Service
 * Provides AI-powered grading suggestions for homework submissions
 */
class HomeworkGradingService {
  /**
   * Build a prompt for AI grading
   */
  private buildGradingPrompt(
    homeworkContent: string,
    answers: HomeworkAnswer[]
  ): string {
    const answersFormatted = answers
      .map((a, i) => `Pregunta ${i + 1} (ID: ${a.questionId}):\nRespuesta del Estudiante: ${a.value}`)
      .join('\n\n');

    return `Eres un evaluador educativo experto. Evalúa la entrega de tarea del estudiante y proporciona una evaluación justa y constructiva.

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
   - Explique cualquier error de manera alentadora
   - Sugiera cómo pueden mejorar

## Formato de Respuesta
Responde ÚNICAMENTE en el siguiente formato JSON (sin texto adicional):
{
  "grade": <número 0-100>,
  "feedback": "<cadena de retroalimentación constructiva>"
}`;
  }

  /**
   * Generate AI grading suggestion for a submission
   */
  async generateAISuggestion(
    submissionId: string,
    homeworkContent: string,
    answers: HomeworkAnswer[]
  ): Promise<{ grade: number; feedback: string }> {
    const systemPrompt = `Eres una IA de evaluación educativa. Proporcionas calificaciones justas y alentadoras y retroalimentación para las tareas de los estudiantes. Siempre responde únicamente en formato JSON válido.`;

    const prompt = this.buildGradingPrompt(homeworkContent, answers);

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

    // Generate AI suggestion asynchronously
    let aiSuggestion: { grade: number; feedback: string } | undefined;
    try {
      aiSuggestion = await this.generateAISuggestion(
        submission.id,
        homeworkContent,
        answers
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
