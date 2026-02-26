import { getDb } from '../database/db';
import { memoryService } from './memory.service';
import { ollamaService } from './ollama.service';
import {
  ClassroomSnapshot,
  StudentSnapshot,
  TopicCell,
  SemanticCluster,
  DiagnosticAudit,
  FailureType,
  DiagnosticSeverity,
} from '../../../shared/types/insight.types';
import { RubricScores } from '../../../shared/types/lesson.types';

// ============================================================
// AI Diagnostic System Prompt
// ============================================================

const DIAGNOSTIC_SYSTEM_PROMPT = `Eres un experto en diagnóstico pedagógico especializado en educación K-12 mexicana.
Tu tarea es analizar datos de dificultad del salón de clases y generar diagnósticos pedagógicos precisos y accionables.

## REGLA CRÍTICA DE IDIOMA
- TODO tu contenido DEBE estar en ESPAÑOL MEXICANO
- NUNCA uses inglés bajo ninguna circunstancia
- Mantén el español natural y apropiado para maestros mexicanos

## TIPOS DE FALLA
- conceptual: El estudiante no comprende el concepto fundamental
- procedural: El estudiante sabe el concepto pero no puede aplicarlo
- motivational: El estudiante muestra signos de rendición o apatía
- prerequisite: Falta conocimiento previo necesario
- linguistic: Barrera de vocabulario académico

Responde ÚNICAMENTE con JSON válido. Sin texto adicional antes o después del JSON.`;

// ============================================================
// Helper: Build AI prompt for diagnostic audit
// ============================================================

function buildDiagnosticPrompt(snapshot: ClassroomSnapshot): string {
  const topClusters = snapshot.clusters.slice(0, 5).map(c => ({
    tema: c.topic,
    materia: c.subject,
    promedioEsfuerzo: c.avgStruggleScore.toFixed(2),
    estudiantesAfectados: c.studentCount,
    dimensionDominante: c.dominantDimension,
    insight: c.memoryInsight,
  }));

  // Find worst-performing cells
  const worstCells: { student: string; lesson: string; struggle: number }[] = [];
  for (const student of snapshot.students) {
    for (const cell of Object.values(student.cells)) {
      if (cell.hasData && cell.struggleScore !== null && cell.struggleScore >= 0.6) {
        worstCells.push({
          student: student.studentName,
          lesson: cell.lessonTitle,
          struggle: cell.struggleScore,
        });
      }
    }
  }
  worstCells.sort((a, b) => b.struggle - a.struggle);

  const summaryData = {
    salon: snapshot.classroomName,
    totalEstudiantes: snapshot.students.length,
    totalLecciones: snapshot.lessons.length,
    clustersDificultad: topClusters,
    celdas_criticas: worstCells.slice(0, 8),
  };

  return `Analiza los siguientes datos de dificultad del salón de clases y genera un diagnóstico pedagógico:

## DATOS DEL SALÓN
${JSON.stringify(summaryData, null, 2)}

## TU TAREA
Genera un diagnóstico pedagógico en el siguiente formato JSON exacto:

{
  "rootCause": "Descripción clara de la causa raíz del problema de aprendizaje (2-3 oraciones)",
  "failureType": "conceptual|procedural|motivational|prerequisite|linguistic",
  "severity": "low|medium|high|critical",
  "bridgeActivity": "## Actividad Puente (10 minutos)\\n\\n**Objetivo:** [objetivo claro]\\n\\n**Materiales:** [materiales necesarios]\\n\\n**Pasos:**\\n1. [paso 1]\\n2. [paso 2]\\n3. [paso 3]\\n\\n**Cierre:** [cómo cerrar la actividad]",
  "recommendations": [
    "Recomendación específica 1 para el maestro",
    "Recomendación específica 2 para el maestro",
    "Recomendación específica 3 para el maestro"
  ]
}

Responde ÚNICAMENTE con el JSON. Sin texto adicional.`;
}

// ============================================================
// Helper: Parse diagnostic JSON safely
// ============================================================

function parseDiagnosticJson(raw: string): DiagnosticAudit {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Find the first { and last } to extract JSON
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in AI response');
  }
  const jsonStr = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(jsonStr);

  const validFailureTypes: FailureType[] = ['conceptual', 'procedural', 'motivational', 'prerequisite', 'linguistic'];
  const validSeverities: DiagnosticSeverity[] = ['low', 'medium', 'high', 'critical'];

  return {
    generatedAt: new Date().toISOString(),
    rootCause: String(parsed.rootCause || 'No se pudo determinar la causa raíz.'),
    failureType: validFailureTypes.includes(parsed.failureType) ? parsed.failureType : 'conceptual',
    severity: validSeverities.includes(parsed.severity) ? parsed.severity : 'medium',
    bridgeActivity: String(parsed.bridgeActivity || 'No se generó actividad puente.'),
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String).slice(0, 5)
      : [],
  };
}

// ============================================================
// Insight Engine Service
// ============================================================

class InsightEngineService {
  /**
   * Build the full classroom heatmap snapshot.
   * Uses a CROSS JOIN so every (student × lesson) pair appears even with no data.
   */
  async getClassroomSnapshot(classroomId: string, teacherId: string): Promise<ClassroomSnapshot> {
    const db = getDb();

    // Get classroom name
    const classroom = db
      .prepare('SELECT id, name FROM classrooms WHERE id = ? AND teacher_id = ?')
      .get(classroomId, teacherId) as { id: string; name: string } | undefined;

    if (!classroom) {
      throw new Error('Classroom not found or access denied');
    }

    // ----------------------------------------------------------------
    // Main heatmap query: CROSS JOIN → every (student × lesson) pair
    // ----------------------------------------------------------------
    const heatmapRows = db
      .prepare(`
        SELECT
          sp.user_id          AS student_id,
          sp.name             AS student_name,
          sp.grade_level,
          sp.age,
          l.id                AS lesson_id,
          l.title             AS lesson_title,
          l.topic             AS lesson_topic,
          l.subject           AS lesson_subject,
          la.struggle_score,
          la.struggle_dimensions,
          la.comprehension_score,
          la.exit_ticket_passed,
          hw.rubric_scores,
          hw.grade            AS submission_grade
        FROM student_profiles sp
        CROSS JOIN lessons l
        LEFT JOIN personalized_lessons pl
          ON pl.student_id = sp.user_id AND pl.lesson_id = l.id
        LEFT JOIN lesson_chat_sessions lcs
          ON lcs.personalized_lesson_id = pl.id AND lcs.student_id = sp.user_id
        LEFT JOIN learning_analytics la
          ON la.session_id = lcs.id
        LEFT JOIN (
          SELECT
            ph.student_id,
            ha.topic,
            hs.rubric_scores,
            hs.grade,
            ROW_NUMBER() OVER (PARTITION BY ph.student_id, ha.topic ORDER BY hs.submitted_at DESC) AS rn
          FROM homework_submissions hs
          JOIN personalized_homework ph ON ph.id = hs.personalized_homework_id
          JOIN homework_assignments ha ON ha.id = ph.homework_id
          WHERE hs.rubric_scores IS NOT NULL
        ) hw ON hw.student_id = sp.user_id AND hw.topic = l.topic AND hw.rn = 1
        WHERE sp.teacher_id = ?
          AND l.teacher_id = ?
        ORDER BY sp.name, l.created_at
      `)
      .all(teacherId, teacherId) as Array<{
        student_id: string;
        student_name: string;
        grade_level?: string;
        age?: number;
        lesson_id: string;
        lesson_title: string;
        lesson_topic: string;
        lesson_subject?: string;
        struggle_score: number | null;
        struggle_dimensions: string | null;
        comprehension_score: number | null;
        exit_ticket_passed: number | null;
        rubric_scores: string | null;
        submission_grade: number | null;
      }>;

    // ----------------------------------------------------------------
    // Cluster query: group by topic, find dominant dimension
    // ----------------------------------------------------------------
    const clusterRows = db
      .prepare(`
        SELECT
          l.topic,
          l.subject,
          AVG(la.struggle_score)                                            AS avg_struggle,
          COUNT(DISTINCT sp.user_id)                                        AS student_count,
          GROUP_CONCAT(DISTINCT sp.user_id)                                AS student_ids,
          AVG(JSON_EXTRACT(la.struggle_dimensions, '$.socraticDepth'))      AS avg_socratic,
          AVG(JSON_EXTRACT(la.struggle_dimensions, '$.errorPersistence'))   AS avg_persistence,
          AVG(JSON_EXTRACT(la.struggle_dimensions, '$.frustrationSentiment')) AS avg_frustration
        FROM learning_analytics la
        JOIN lesson_chat_sessions lcs ON lcs.id = la.session_id
        JOIN personalized_lessons pl ON pl.id = lcs.personalized_lesson_id
        JOIN lessons l ON l.id = pl.lesson_id
        JOIN student_profiles sp ON sp.user_id = lcs.student_id
        WHERE l.teacher_id = ?
          AND la.struggle_score > 0.4
        GROUP BY l.topic
        HAVING student_count >= 2
        ORDER BY avg_struggle DESC
      `)
      .all(teacherId) as Array<{
        topic: string;
        subject?: string;
        avg_struggle: number;
        student_count: number;
        student_ids: string;
        avg_socratic: number | null;
        avg_persistence: number | null;
        avg_frustration: number | null;
      }>;

    // ----------------------------------------------------------------
    // Build student snapshots
    // ----------------------------------------------------------------
    const studentMap = new Map<string, StudentSnapshot>();
    const lessonMap = new Map<string, { id: string; title: string; topic: string; subject?: string }>();

    for (const row of heatmapRows) {
      // Track unique lessons
      if (!lessonMap.has(row.lesson_id)) {
        lessonMap.set(row.lesson_id, {
          id: row.lesson_id,
          title: row.lesson_title,
          topic: row.lesson_topic,
          subject: row.lesson_subject,
        });
      }

      // Track unique students
      if (!studentMap.has(row.student_id)) {
        studentMap.set(row.student_id, {
          studentId: row.student_id,
          studentName: row.student_name,
          gradeLevel: row.grade_level,
          age: row.age,
          cells: {},
        });
      }

      const student = studentMap.get(row.student_id)!;
      const hasData =
        row.struggle_score !== null ||
        row.comprehension_score !== null ||
        row.rubric_scores !== null ||
        row.submission_grade !== null;

      let parsedDimensions: TopicCell['struggleDimensions'] = null;
      if (row.struggle_dimensions) {
        try {
          parsedDimensions = JSON.parse(row.struggle_dimensions);
        } catch {
          parsedDimensions = null;
        }
      }

      let parsedRubric: RubricScores | null = null;
      if (row.rubric_scores) {
        try {
          parsedRubric = JSON.parse(row.rubric_scores);
        } catch {
          parsedRubric = null;
        }
      }

      student.cells[row.lesson_id] = {
        lessonId: row.lesson_id,
        lessonTitle: row.lesson_title,
        lessonTopic: row.lesson_topic,
        lessonSubject: row.lesson_subject,
        struggleScore: row.struggle_score,
        struggleDimensions: parsedDimensions,
        comprehensionScore: row.comprehension_score,
        exitTicketPassed: row.exit_ticket_passed === null ? null : row.exit_ticket_passed === 1,
        rubricScores: parsedRubric,
        submissionGrade: row.submission_grade,
        hasData,
      };
    }

    // ----------------------------------------------------------------
    // Build clusters
    // ----------------------------------------------------------------
    const clusters: SemanticCluster[] = clusterRows.map(row => {
      const socratic = row.avg_socratic ?? 0;
      const persistence = row.avg_persistence ?? 0;
      const frustration = row.avg_frustration ?? 0;

      let dominantDimension: SemanticCluster['dominantDimension'] = 'socraticDepth';
      if (persistence >= socratic && persistence >= frustration) {
        dominantDimension = 'errorPersistence';
      } else if (frustration >= socratic && frustration >= persistence) {
        dominantDimension = 'frustrationSentiment';
      }

      return {
        topic: row.topic,
        subject: row.subject,
        avgStruggleScore: row.avg_struggle,
        studentCount: row.student_count,
        studentIds: row.student_ids ? row.student_ids.split(',') : [],
        dominantDimension,
      };
    });

    const snapshot: ClassroomSnapshot = {
      classroomId,
      classroomName: classroom.name,
      generatedAt: new Date().toISOString(),
      lessons: Array.from(lessonMap.values()),
      students: Array.from(studentMap.values()),
      clusters,
    };

    // ----------------------------------------------------------------
    // Optional ChromaDB enrichment for top 3 clusters
    // ----------------------------------------------------------------
    if (memoryService.isAvailable()) {
      for (const cluster of snapshot.clusters.slice(0, 3)) {
        try {
          const memories = await this.retrieveClusterMemories(cluster.studentIds, cluster.topic);
          if (memories.length > 0) {
            cluster.memoryInsight = memories.join(' | ');
          }
        } catch (err) {
          // ChromaDB enrichment is optional — never throw
          console.warn('[InsightEngine] ChromaDB enrichment failed for cluster:', cluster.topic, err);
        }
      }
    }

    return snapshot;
  }

  /**
   * Retrieve relevant memory snippets across multiple students for a topic.
   * Gracefully skips if memory service is unavailable.
   */
  private async retrieveClusterMemories(studentIds: string[], topic: string): Promise<string[]> {
    // Use the memory service's retrieveRelevantMemories per student, then merge
    const allQuestions: string[] = [];
    for (const studentId of studentIds.slice(0, 5)) {
      try {
        const memories = await memoryService.retrieveRelevantMemories(studentId, topic, 2);
        if (Array.isArray(memories)) {
          for (const m of memories) {
            if (m?.question) allQuestions.push(m.question);
          }
        }
      } catch {
        // ignore per-student failures
      }
    }
    return allQuestions.slice(0, 4);
  }

  /**
   * Generate an AI-powered diagnostic audit for a classroom snapshot.
   */
  async generateDiagnosticAudit(snapshot: ClassroomSnapshot): Promise<DiagnosticAudit> {
    const prompt = buildDiagnosticPrompt(snapshot);

    const raw = await ollamaService.generate(prompt, undefined, DIAGNOSTIC_SYSTEM_PROMPT, 'chat');

    return parseDiagnosticJson(raw);
  }
}

export const insightEngineService = new InsightEngineService();
