import { ollamaService } from './ollama.service';
import { aiGatekeeper, getPedagogicalPersona, PedagogicalPersona } from './aiGatekeeper.service';
import { homeworkSubmissionsQueries, HomeworkAnswer } from '../database/queries/homeworkSubmissions.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';

/**
 * Rubric-based grading dimensions.
 * All values are 0-100.
 * Final grade = accuracy * 0.40 + reasoning * 0.40 + effort * 0.20
 */
export interface RubricScores {
  accuracy: number;   // Correctness of final answers (40%)
  reasoning: number;  // Logical steps / process shown (40%)
  effort: number;     // Depth of engagement, all problems attempted (20%)
}

/**
 * Homework Grading Service
 * Provides AI-powered rubric-based grading suggestions for homework submissions.
 */
class HomeworkGradingService {
  /**
   * Calculate weighted final grade from rubric scores
   */
  private calcFinalGrade(rubric: RubricScores): number {
    const grade = rubric.accuracy * 0.40 + rubric.reasoning * 0.40 + rubric.effort * 0.20;
    return Math.round(Math.max(0, Math.min(100, grade)));
  }

  /**
   * Build a rubric-aware grading prompt with age-appropriate feedback tone
   */
  private buildGradingPrompt(
    homeworkContent: string,
    answers: HomeworkAnswer[],
    persona: PedagogicalPersona
  ): string {
    const answersFormatted = answers
      .map((a, i) => `Pregunta ${i + 1} (ID: ${a.questionId}):\nRespuesta del Estudiante: ${a.value || '(sin respuesta)'}`)
      .join('\n\n');

    return `# IDIOMA: ESPAÑOL MEXICANO OBLIGATORIO
TODA tu respuesta DEBE estar en ESPAÑOL MEXICANO. PROHIBIDO usar inglés.

Eres un evaluador educativo mexicano experto. Evalúa la entrega usando una RÚBRICA DE 3 DIMENSIONES.

## PERFIL DEL ESTUDIANTE
- Nivel académico: ${persona.gradeRange} (${persona.ageRange})
- Adapta tu retroalimentación al nivel apropiado para su edad.

${persona.systemPromptSegment}

## Contenido de la Tarea
${homeworkContent}

## Respuestas Entregadas por el Estudiante
${answersFormatted}

## RÚBRICA DE EVALUACIÓN (3 Dimensiones)

### DIMENSIÓN 1: EXACTITUD — 40% del puntaje
¿Son las respuestas factualmente correctas? ¿Llegó el estudiante a la respuesta correcta?
- 100: Todas las respuestas son completamente correctas
- 80: Mayoría correctas, errores menores
- 60: Aproximadamente la mitad son correctas
- 40: Pocas respuestas correctas, errores significativos
- 20: Respuestas con dirección correcta pero incompletas
- 0: Sin respuestas correctas o no respondió

### DIMENSIÓN 2: RAZONAMIENTO — 40% del puntaje
¿Muestra el estudiante su proceso de pensamiento? ¿Explica cómo llegó a su respuesta?
Para matemáticas: ¿Muestra el procedimiento paso a paso?
Para ciencias/historia: ¿Explica la justificación de su respuesta?
- 100: Razonamiento completo, claro y bien estructurado
- 80: Razonamiento parcialmente mostrado, lógica clara
- 60: Razonamiento mínimo, algunos pasos visibles
- 40: Casi sin razonamiento mostrado
- 0: Solo respuesta final sin ningún proceso visible

### DIMENSIÓN 3: ESFUERZO — 20% del puntaje
¿Qué tan comprometido estuvo el estudiante con la tarea?
- 100: Todos los problemas intentados, respuestas desarrolladas y reflexivas
- 80: Mayoría de problemas intentados, respuestas con detalle
- 60: Algunos problemas omitidos o respuestas muy cortas
- 40: Varios problemas sin responder, poco detalle
- 0: Mínimo esfuerzo observable, mayoría sin contestar

## Formato de Respuesta Obligatorio
Responde ÚNICAMENTE con JSON válido:
{
  "accuracy": <número 0-100>,
  "reasoning": <número 0-100>,
  "effort": <número 0-100>,
  "feedback": "<retroalimentación constructiva EN ESPAÑOL MEXICANO que mencione específicamente qué hizo bien en cada dimensión y qué puede mejorar>"
}

La retroalimentación debe:
- Reconocer logros específicos ("Tu razonamiento en la pregunta 2 fue muy claro")
- Señalar errores de forma alentadora ("Para la pregunta 3, revisa el concepto de...")
- Dar un consejo concreto de mejora

RECUERDA: JSON válido únicamente. Todo en ESPAÑOL MEXICANO. Cero inglés.`;
  }

  /**
   * Generate AI rubric grading suggestion for a submission
   */
  async generateAISuggestion(
    submissionId: string,
    homeworkContent: string,
    answers: HomeworkAnswer[],
    studentId?: string
  ): Promise<{ grade: number; feedback: string; rubricScores?: RubricScores }> {
    // Get student profile to determine appropriate persona
    let persona = getPedagogicalPersona(); // Default
    if (studentId) {
      const studentProfile = studentProfilesQueries.getByUserId(studentId);
      if (studentProfile) {
        persona = getPedagogicalPersona(studentProfile.age, studentProfile.gradeLevel);
        console.log(`[HomeworkGrading] Using persona: ${persona.name} for student ${studentId}`);
      }
    }

    // Spanish-only system prompt
    const systemPrompt = `# INSTRUCCIÓN PRIMARIA - IDIOMA OBLIGATORIO

DEBES RESPONDER EXCLUSIVAMENTE EN ESPAÑOL MEXICANO.
ESTÁ PROHIBIDO USAR INGLÉS EN CUALQUIER PARTE DE TU RESPUESTA.
NO "Great job", NO "Good work" — SOLO ESPAÑOL.

Eres una IA de evaluación educativa mexicana. Calificas tareas con una rúbrica de 3 dimensiones.

## Tu Rol
- Proporcionar calificaciones justas y granulares por EXACTITUD, RAZONAMIENTO y ESFUERZO
- Dar retroalimentación constructiva EN ESPAÑOL MEXICANO
- Adaptar tu tono al nivel del estudiante: ${persona.gradeRange} (${persona.ageRange})

## Formato de Respuesta
Responde ÚNICAMENTE con JSON válido:
{
  "accuracy": <0-100>,
  "reasoning": <0-100>,
  "effort": <0-100>,
  "feedback": "<retroalimentación en ESPAÑOL MEXICANO>"
}`;

    const prompt = this.buildGradingPrompt(homeworkContent, answers, persona);

    try {
      const response = await ollamaService.generate(prompt, undefined, systemPrompt);

      // Extract JSON (handle possible markdown code fences)
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI response format — no JSON found');
      }

      const raw = JSON.parse(jsonMatch[0]) as {
        accuracy?: number;
        reasoning?: number;
        effort?: number;
        feedback?: string;
      };

      const rubricScores: RubricScores = {
        accuracy: Math.max(0, Math.min(100, raw.accuracy ?? 50)),
        reasoning: Math.max(0, Math.min(100, raw.reasoning ?? 50)),
        effort: Math.max(0, Math.min(100, raw.effort ?? 50)),
      };

      const grade = this.calcFinalGrade(rubricScores);
      const rawFeedback = raw.feedback || 'Sin retroalimentación proporcionada.';

      // Format feedback through the gatekeeper
      const formattedResult = aiGatekeeper.formatSync(rawFeedback, {
        contentType: 'grading',
        requireLatex: true,
      });
      const feedback = formattedResult.content;

      // Persist to DB: grade + feedback + rubric breakdown
      homeworkSubmissionsQueries.updateAISuggestion(submissionId, grade, feedback, rubricScores);

      return { grade, feedback, rubricScores };
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
    aiSuggestion?: { grade: number; feedback: string; rubricScores?: RubricScores };
  }> {
    // Create the submission
    const submission = homeworkSubmissionsQueries.create(
      personalizedHomeworkId,
      studentId,
      answers
    );

    // Generate AI suggestion asynchronously with student context
    let aiSuggestion: { grade: number; feedback: string; rubricScores?: RubricScores } | undefined;
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
