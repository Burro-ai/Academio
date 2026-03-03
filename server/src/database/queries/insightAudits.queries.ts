import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import {
  StoredDiagnosticAudit,
  SnapshotSummary,
  FailureType,
  DiagnosticSeverity,
  DiagnosticAudit,
} from '../../../../shared/types/insight.types';

interface DbRow {
  id: string;
  classroom_id: string;
  teacher_id: string;
  generated_at: string;
  root_cause: string;
  failure_type: string;
  severity: string;
  bridge_activity: string;
  recommendations: string;
  snapshot_summary: string;
}

function rowToAudit(row: DbRow): StoredDiagnosticAudit {
  return {
    id: row.id,
    classroomId: row.classroom_id,
    teacherId: row.teacher_id,
    generatedAt: row.generated_at,
    rootCause: row.root_cause,
    failureType: row.failure_type as FailureType,
    severity: row.severity as DiagnosticSeverity,
    bridgeActivity: row.bridge_activity,
    recommendations: JSON.parse(row.recommendations) as string[],
    snapshotSummary: JSON.parse(row.snapshot_summary) as SnapshotSummary,
  };
}

export const insightAuditsQueries = {
  create(
    classroomId: string,
    teacherId: string,
    audit: DiagnosticAudit,
    snapshotSummary: SnapshotSummary
  ): StoredDiagnosticAudit {
    const db = getDb();
    const id = uuidv4();

    db.prepare(
      `INSERT INTO insight_audits
         (id, classroom_id, teacher_id, generated_at, root_cause, failure_type,
          severity, bridge_activity, recommendations, snapshot_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      classroomId,
      teacherId,
      audit.generatedAt,
      audit.rootCause,
      audit.failureType,
      audit.severity,
      audit.bridgeActivity,
      JSON.stringify(audit.recommendations),
      JSON.stringify(snapshotSummary)
    );

    return { id, classroomId, teacherId, ...audit, snapshotSummary };
  },

  getByClassroom(classroomId: string, limit = 20): StoredDiagnosticAudit[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM insight_audits
         WHERE classroom_id = ?
         ORDER BY generated_at DESC
         LIMIT ?`
      )
      .all(classroomId, limit) as DbRow[];
    return rows.map(rowToAudit);
  },

  getById(id: string): StoredDiagnosticAudit | null {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM insight_audits WHERE id = ?')
      .get(id) as DbRow | undefined;
    return row ? rowToAudit(row) : null;
  },
};
