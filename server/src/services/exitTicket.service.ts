import { ollamaService } from './ollama.service';
import { getPedagogicalPersona, PedagogicalPersona } from './aiGatekeeper.service';
import { analyticsQueries } from '../database/queries/analytics.queries';

export interface ExitTicketQuestion {
  id: number;
  question: string;
}

export interface ExitTicketResult {
  passed: boolean;
  comprehensionScore: number;  // 0-1
  feedback: string;
  questionsCorrect: number;
  questionsTotal: number;
}

/**
 * Exit Ticket Service
 *
 * Generates 2-3 targeted comprehension verification questions based on lesson content.
 * Before a student can mark a lesson "complete", they answer these questions.
 * The AI evaluates responses and produces a comprehension score stored in learning_analytics.
 */
class ExitTicketService {
  /**
   * Generate 2-3 comprehension questions grounded in the lesson content.
   * Uses the student's persona to set appropriate difficulty.
   */
  async generateQuestions(
    lessonContent: string,
    topic: string,
    studentAge?: number | null,
    studentGradeLevel?: string | null
  ): Promise<ExitTicketQuestion[]> {
    const persona = getPedagogicalPersona(studentAge ?? undefined, studentGradeLevel ?? undefined);

    const systemPrompt = `# IDIOMA: ESPAÑOL MEXICANO OBLIGATORIO
Debes responder ÚNICAMENTE en ESPAÑOL MEXICANO. CERO inglés.

Eres un experto pedagógico mexicano que genera preguntas de verificación de comprensión.
Tu objetivo es comprobar si el estudiante entendió los conceptos clave de la lección.`;

    const prompt = this.buildGenerationPrompt(lessonContent, topic, persona);

    try {
      const response = await ollamaService.generate(prompt, undefined, systemPrompt);

      // Extract JSON array
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const raw = JSON.parse(jsonMatch[0]) as Array<{ id: number; question: string }>;
      const questions = raw
        .slice(0, 3)
        .map((q, i) => ({ id: q.id ?? i + 1, question: String(q.question) }));

      if (questions.length === 0) throw new Error('Empty questions array');

      return questions;
    } catch (error) {
      console.error('[ExitTicket] Failed to generate questions:', error);
      // Fallback: generic comprehension questions
      return this.getFallbackQuestions(topic);
    }
  }

  /**
   * Evaluate student's answers and produce a comprehension score.
   * Persists the result to learning_analytics.
   */
  async evaluateAnswers(
    questions: ExitTicketQuestion[],
    answers: string[],
    lessonContent: string,
    sessionId: string,
    studentAge?: number | null,
    studentGradeLevel?: string | null
  ): Promise<ExitTicketResult> {
    const persona = getPedagogicalPersona(studentAge ?? undefined, studentGradeLevel ?? undefined);

    const systemPrompt = `# IDIOMA: ESPAÑOL MEXICANO OBLIGATORIO
Debes responder ÚNICAMENTE en ESPAÑOL MEXICANO. CERO inglés.

Eres un evaluador pedagógico mexicano que verifica la comprensión de los estudiantes.`;

    const prompt = this.buildEvaluationPrompt(questions, answers, lessonContent, persona);

    try {
      const response = await ollamaService.generate(prompt, undefined, systemPrompt);

      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) throw new Error('No JSON found in evaluation response');

      const raw = JSON.parse(jsonMatch[0]) as {
        questionsCorrect?: number;
        comprehensionScore?: number;
        passed?: boolean;
        feedback?: string;
      };

      const questionsTotal = questions.length;
      const questionsCorrect = Math.min(
        questionsTotal,
        Math.max(0, Math.round(raw.questionsCorrect ?? 0))
      );
      const comprehensionScore = Math.min(1, Math.max(0, raw.comprehensionScore ?? questionsCorrect / questionsTotal));
      const passed = raw.passed ?? comprehensionScore >= 0.6;
      const feedback = raw.feedback || (passed
        ? '¡Buen trabajo! Demostraste comprensión del tema.'
        : 'Revisa los conceptos clave antes de continuar.');

      const result: ExitTicketResult = {
        passed,
        comprehensionScore: Math.round(comprehensionScore * 100) / 100,
        feedback,
        questionsCorrect,
        questionsTotal,
      };

      // Persist to learning_analytics
      try {
        analyticsQueries.updateComprehensionScore(sessionId, comprehensionScore, passed);
      } catch (err) {
        console.warn('[ExitTicket] Failed to persist comprehension score:', err);
      }

      return result;
    } catch (error) {
      console.error('[ExitTicket] Evaluation failed:', error);

      // Graceful degradation: auto-pass with note to review
      const fallback: ExitTicketResult = {
        passed: true,
        comprehensionScore: 0.5,
        feedback: 'No se pudo verificar automáticamente. Continúa y repasa el material si tienes dudas.',
        questionsCorrect: Math.floor(questions.length / 2),
        questionsTotal: questions.length,
      };

      try {
        analyticsQueries.updateComprehensionScore(sessionId, 0.5, true);
      } catch { /* ignore */ }

      return fallback;
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildGenerationPrompt(
    lessonContent: string,
    topic: string,
    persona: PedagogicalPersona
  ): string {
    return `Genera exactamente 2 o 3 preguntas de verificación de comprensión para la siguiente lección.

## TEMA: ${topic}
## NIVEL DEL ESTUDIANTE: ${persona.gradeRange} (${persona.ageRange})

## CONTENIDO DE LA LECCIÓN:
${lessonContent.slice(0, 2500)}

## INSTRUCCIONES PARA LAS PREGUNTAS:
- Cada pregunta debe verificar un concepto CLAVE distinto de la lección
- Las preguntas deben ser ABIERTAS (no de opción múltiple) — el estudiante escribe su respuesta
- El nivel de dificultad debe ser apropiado para ${persona.gradeRange}
- Las preguntas deben poder responderse con 1-3 oraciones basándose SOLO en la lección
- NO hagas preguntas que requieran conocimiento externo no visto en la lección

## FORMATO DE RESPUESTA (JSON array obligatorio):
[
  { "id": 1, "question": "<primera pregunta en español>" },
  { "id": 2, "question": "<segunda pregunta en español>" }
]

Solo JSON. Sin texto adicional.`;
  }

  private buildEvaluationPrompt(
    questions: ExitTicketQuestion[],
    answers: string[],
    lessonContent: string,
    persona: PedagogicalPersona
  ): string {
    const qa = questions
      .map((q, i) => `Pregunta ${q.id}: ${q.question}\nRespuesta: ${answers[i] || '(sin respuesta)'}`)
      .join('\n\n');

    return `Evalúa las respuestas del estudiante a las preguntas de comprensión.

## NIVEL DEL ESTUDIANTE: ${persona.gradeRange} (${persona.ageRange})

## CONTENIDO DE LA LECCIÓN (fuente de verdad):
${lessonContent.slice(0, 2000)}

## PREGUNTAS Y RESPUESTAS DEL ESTUDIANTE:
${qa}

## CRITERIOS DE EVALUACIÓN:
- Considera correcta una respuesta que demuestre comprensión del concepto, aunque no sea textualmente perfecta
- Para el nivel ${persona.gradeRange}, aplica el estándar de rigor apropiado
- Una respuesta en blanco cuenta como incorrecta
- "comprehensionScore" debe ser entre 0.0 y 1.0 (ej: 2/3 preguntas correctas = 0.67)
- "passed" es true si comprehensionScore >= 0.60

## FORMATO DE RESPUESTA (JSON):
{
  "questionsCorrect": <número de preguntas respondidas correctamente>,
  "comprehensionScore": <0.0 a 1.0>,
  "passed": <true o false>,
  "feedback": "<mensaje breve EN ESPAÑOL que le diga al estudiante qué entendió bien y qué repasar>"
}

Solo JSON. Sin texto adicional.`;
  }

  private getFallbackQuestions(topic: string): ExitTicketQuestion[] {
    return [
      { id: 1, question: `¿Cuál es el concepto más importante que aprendiste sobre "${topic}"?` },
      { id: 2, question: `Explica con tus propias palabras cómo aplicarías lo que aprendiste sobre "${topic}".` },
    ];
  }
}

export const exitTicketService = new ExitTicketService();
