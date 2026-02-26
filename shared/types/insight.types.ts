import { RubricScores } from './lesson.types';

export interface TopicCell {
  lessonId: string;
  lessonTitle: string;
  lessonTopic: string;
  lessonSubject?: string;
  struggleScore: number | null;       // composite from learning_analytics
  struggleDimensions: {
    socraticDepth: number;
    errorPersistence: number;
    frustrationSentiment: number;
  } | null;
  comprehensionScore: number | null;  // from analytics exit ticket
  exitTicketPassed: boolean | null;
  rubricScores: RubricScores | null;  // accuracy, reasoning, effort
  submissionGrade: number | null;     // final grade from homework_submissions
  hasData: boolean;                   // false = student hasn't opened lesson yet
}

export interface StudentSnapshot {
  studentId: string;
  studentName: string;
  gradeLevel?: string;
  age?: number;
  cells: Record<string, TopicCell>;   // keyed by lessonId
}

export interface SemanticCluster {
  topic: string;
  subject?: string;
  avgStruggleScore: number;
  studentCount: number;
  studentIds: string[];
  dominantDimension: 'socraticDepth' | 'errorPersistence' | 'frustrationSentiment';
  memoryInsight?: string;             // optional ChromaDB enrichment
}

export interface ClassroomSnapshot {
  classroomId: string;
  classroomName: string;
  generatedAt: string;
  lessons: { id: string; title: string; topic: string; subject?: string }[];
  students: StudentSnapshot[];
  clusters: SemanticCluster[];
}

export type FailureType = 'conceptual' | 'procedural' | 'motivational' | 'prerequisite' | 'linguistic';
export type DiagnosticSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DiagnosticAudit {
  generatedAt: string;
  rootCause: string;
  failureType: FailureType;
  severity: DiagnosticSeverity;
  bridgeActivity: string;             // 10-min classroom intervention (markdown)
  recommendations: string[];
}
