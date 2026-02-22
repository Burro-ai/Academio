import { analyticsQueries } from '../database/queries/analytics.queries';
import { getPedagogicalPersona } from './aiGatekeeper.service';
import { LessonChatMessage } from '../database/queries/lessonChat.queries';

/**
 * Multi-Dimensional Struggle Matrix dimensions
 * Each dimension is a 0-1 float where 1 = highest struggle
 */
export interface StruggleDimensions {
  socraticDepth: number;        // High surface questions ratio → higher score
  errorPersistence: number;     // Repeated conceptual confusion → higher score
  frustrationSentiment: number; // Frustration markers in last 3 messages → higher score
  composite: number;            // Weighted combination, normalized by developmental tranche
}

// ─── Lexical Markers ─────────────────────────────────────────────────────────

/** Surface questions: student is probing at definitional level only */
const SURFACE_QUESTION_MARKERS = [
  '¿qué es', 'qué es ', 'que es ',
  '¿cuál es la definición', 'cuál es la definición',
  'qué significa', '¿qué significa',
  'qué quiere decir', '¿qué quiere decir',
  'cómo se llama', '¿cómo se llama',
];

/** Deep questions: student is probing reasoning, causality, implications */
const DEEP_QUESTION_MARKERS = [
  '¿cómo funciona', 'cómo funciona',
  '¿por qué', 'por qué ',
  '¿qué pasaría', 'qué pasaría',
  '¿qué ocurriría', 'qué ocurriría',
  '¿cuál es la diferencia', 'cuál es la diferencia',
  '¿cómo se relaciona', 'cómo se relaciona',
  '¿qué tiene que ver', 'qué tiene que ver',
  '¿para qué sirve', 'para qué sirve',
  'por qué es importante',
  '¿qué consecuencias', 'qué consecuencias',
];

/** Confusion: student explicitly expresses not understanding */
const CONFUSION_MARKERS = [
  'no entiendo', 'no comprendo', 'no le entiendo', 'no lo entiendo',
  'sigo sin entender', 'todavía no entiendo', 'sigo confundido',
  'sigo confundida', 'me confunde', 'sigo perdido', 'sigo perdida',
  'no me queda claro', 'no lo sé', 'no sé cómo', 'no sé por qué',
];

/** Frustration: resignation, negative self-talk, giving up */
const FRUSTRATION_MARKERS = [
  'no puedo', 'me rindo', 'es muy difícil', 'es demasiado difícil',
  'no lo voy a entender', 'nunca voy a entender', 'no sirvo para esto',
  'odio esto', 'esto es imposible', 'ya no quiero', 'ya no me importa',
  'qué asco', 'qué difícil', 'no entiendo nada',
];

// ─── Developmental Calibration Multipliers ───────────────────────────────────

/**
 * Younger students express confusion naturally; normalise their struggle score down.
 * Older students expressing confusion is a stronger pedagogical signal.
 *
 * Maps rough age brackets to a score multiplier (applied before capping at 1.0).
 */
function getDevelopmentalMultiplier(age?: number | null, gradeLevel?: string | null): number {
  const persona = getPedagogicalPersona(age ?? undefined, gradeLevel ?? undefined);

  switch (persona.type) {
    case 'the-storyteller':          return 0.70;  // 7-9:  high baseline confusion expression
    case 'the-friendly-guide':       return 0.85;  // 10-12
    case 'the-structured-mentor':    return 1.00;  // 13-15: reference point
    case 'the-academic-challenger':  return 1.20;  // 16-18: silence = masking struggle
    case 'the-research-colleague':   return 1.20;  // 19+: explicit confusion = serious gap
    default:                         return 1.00;
  }
}

// ─── Dimension Calculators ────────────────────────────────────────────────────

/**
 * Socratic Depth score (0-1)
 * Measures ratio of surface questions to all student questions.
 * High surface ratio → high struggle (student can't form deeper questions).
 */
function calcSocraticDepth(userMessages: LessonChatMessage[]): number {
  if (userMessages.length === 0) return 0;

  let surfaceCount = 0;
  let deepCount = 0;

  for (const msg of userMessages) {
    const content = msg.content.toLowerCase();
    const hasSurface = SURFACE_QUESTION_MARKERS.some(m => content.includes(m));
    const hasDeep = DEEP_QUESTION_MARKERS.some(m => content.includes(m));

    if (hasSurface) surfaceCount++;
    if (hasDeep) deepCount++;
  }

  const totalSignaled = surfaceCount + deepCount;
  if (totalSignaled === 0) return 0;

  // High surface proportion = higher struggle score
  return Math.min(1, surfaceCount / totalSignaled);
}

/**
 * Error Persistence score (0-1)
 * Measures how often confusion markers repeat across consecutive messages,
 * indicating the same conceptual wall is not being cleared.
 */
function calcErrorPersistence(userMessages: LessonChatMessage[]): number {
  if (userMessages.length < 2) return 0;

  let confusionCount = 0;
  let consecutiveConfusionRuns = 0;
  let prevWasConfused = false;

  for (const msg of userMessages) {
    const content = msg.content.toLowerCase();
    const isConfused = CONFUSION_MARKERS.some(m => content.includes(m));

    if (isConfused) {
      confusionCount++;
      if (prevWasConfused) consecutiveConfusionRuns++;
    }
    prevWasConfused = isConfused;
  }

  // Combine raw confusion rate and consecutive run penalty
  const rawRate = confusionCount / userMessages.length;
  const runPenalty = consecutiveConfusionRuns > 0 ? Math.min(0.3, consecutiveConfusionRuns * 0.1) : 0;

  return Math.min(1, rawRate + runPenalty);
}

/**
 * Frustration Sentiment score (0-1)
 * Examines only the last 3 student messages for resignation or negative affect.
 * Recency-weighted: recent frustration is more actionable than old frustration.
 */
function calcFrustrationSentiment(userMessages: LessonChatMessage[]): number {
  if (userMessages.length === 0) return 0;

  // Take last 3 messages (or fewer if short conversation)
  const recentMessages = userMessages.slice(-3);
  let frustrationSignals = 0;

  for (let i = 0; i < recentMessages.length; i++) {
    const content = recentMessages[i].content.toLowerCase();
    const hasFrustration = FRUSTRATION_MARKERS.some(m => content.includes(m));

    // Very short terse messages in recent context (< 15 chars) are also a signal
    const isTerse = content.trim().length < 15;

    if (hasFrustration) frustrationSignals += 1;
    else if (isTerse && i >= recentMessages.length - 2) frustrationSignals += 0.3;
  }

  return Math.min(1, frustrationSignals / 3);
}

// ─── Public API ──────────────────────────────────────────────────────────────

class AnalyticsService {
  /**
   * Calculate the full Multi-Dimensional Struggle Matrix from chat history.
   * Does NOT write to DB — use calculateAndPersist() for that.
   */
  calculateStruggleDimensions(
    messages: LessonChatMessage[],
    studentAge?: number | null,
    studentGradeLevel?: string | null
  ): StruggleDimensions {
    const userMessages = messages.filter(m => m.role === 'user');

    const socraticDepth = calcSocraticDepth(userMessages);
    const errorPersistence = calcErrorPersistence(userMessages);
    const frustrationSentiment = calcFrustrationSentiment(userMessages);

    // Weighted composite (before developmental calibration)
    const rawComposite =
      socraticDepth * 0.25 +
      errorPersistence * 0.35 +
      frustrationSentiment * 0.40;

    // Apply developmental multiplier and cap at [0, 1]
    const multiplier = getDevelopmentalMultiplier(studentAge, studentGradeLevel);
    const composite = Math.min(1, Math.max(0, rawComposite * multiplier));

    return {
      socraticDepth: Math.round(socraticDepth * 1000) / 1000,
      errorPersistence: Math.round(errorPersistence * 1000) / 1000,
      frustrationSentiment: Math.round(frustrationSentiment * 1000) / 1000,
      composite: Math.round(composite * 1000) / 1000,
    };
  }

  /**
   * Calculate struggle dimensions AND persist them to learning_analytics for a session.
   * Call this after each assistant response in the lesson chat.
   */
  calculateAndPersist(
    sessionId: string,
    messages: LessonChatMessage[],
    studentAge?: number | null,
    studentGradeLevel?: string | null
  ): StruggleDimensions {
    const dimensions = this.calculateStruggleDimensions(messages, studentAge, studentGradeLevel);

    try {
      analyticsQueries.updateStruggleDimensions(sessionId, dimensions);
    } catch (err) {
      // Analytics failure must never break the lesson chat
      console.warn('[Analytics] Failed to persist struggle dimensions:', err);
    }

    return dimensions;
  }

  /**
   * Lightweight struggle check for use in lessonChat.service.ts system prompt building.
   * Returns a simple { isStruggling, score } without DB writes.
   */
  quickStruggleCheck(
    messages: LessonChatMessage[],
    studentAge?: number | null,
    studentGradeLevel?: string | null
  ): { isStruggling: boolean; score: number } {
    const dims = this.calculateStruggleDimensions(messages, studentAge, studentGradeLevel);
    return {
      isStruggling: dims.composite >= 0.5,
      score: dims.composite,
    };
  }
}

export const analyticsService = new AnalyticsService();
