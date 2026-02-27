/**
 * Velocity Coach — type definitions for the adaptive pedagogy system.
 *
 * Three operating modes:
 *  - socratic         : default; guide via questions, never give answers directly
 *  - direct_with_depth_check : student is blocked; give answer + mandatory Depth-Check
 *  - sprint           : student in flow (3+ consecutive correct responses); short, fast-paced
 */

export type VelocityMode = 'socratic' | 'direct_with_depth_check' | 'sprint';

/**
 * A concept the student has demonstrably mastered during a session.
 */
export interface PowerUp {
  conceptName: string;
  masteredAt: string;   // ISO timestamp
  sessionId: string;
  confidence: number;   // 0–1, derived from response accuracy + speed
}

/**
 * A continuous high-performance burst (3+ correct responses in a row).
 */
export interface VelocitySprint {
  sessionId: string;
  startedAt: string;    // ISO timestamp
  endedAt?: string;     // ISO timestamp; undefined if sprint is still active
  conceptsHit: number;  // Number of concepts covered during this sprint
}

/**
 * Per-session velocity metrics tracked by the coaching engine.
 */
export interface VelocitySessionStats {
  powerUpsEarned: PowerUp[];
  sprintsCompleted: VelocitySprint[];
  currentMode: VelocityMode;
  velocityScore: number;  // 0–1 composite; reflects learning pace relative to average
}
