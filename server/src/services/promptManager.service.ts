/**
 * PromptManager Service
 *
 * Single source of truth for AI system prompt assembly.
 * Implements the 4-Layer Student Prompt Engine:
 *
 *   Layer 1: DNA Master       — Velocity Coach global identity
 *   Layer 2: Cognitive Tranche — Grade-based persona + methodology
 *   Layer 3: Product Directive — Interface-specific behavior (highest override weight)
 *   Layer 4: Personalization  — Individual student context (highest data weight)
 *
 * Override hierarchy:
 *   homework_chat  → BLOCKS  Layer 1 direct-answer permission
 *   lesson_copilot → KEEPS   Layer 1 Socratic default (+ adds real-world segment)
 *   tutor_ia       → RELAXES Layer 1 Socratic default (direct answers permitted)
 *
 * Config files:
 *   server/data/prompts/student_master.yaml  (v3.0.0)
 *   server/data/prompts/teacher_master.yaml  (v2.0.0)
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// ─────────────────────────────────────────────────────────────────────────────
// YAML config types
// ─────────────────────────────────────────────────────────────────────────────

interface GradeLevelConfig {
  label: string;
  tranche: string;
  age_range: string;
  vocabulary_limit: string;
  instructional_style: string;
  persona_segment: string;
  methodology: string;
  response_guidelines: string;
  prohibitions: string;
}

type Layer1Override = 'relaxed' | 'standard' | 'blocked';

interface ModuleConfig {
  description: string;
  layer1_override: Layer1Override;
  constraint: string;
}

interface PersonalizationLayer {
  template: string;
  fields: Record<string, string>; // documentation only
}

interface StudentMasterConfig {
  version: string;
  core_identity: string;
  grade_levels: {
    t1: GradeLevelConfig;
    t2: GradeLevelConfig;
    t3: GradeLevelConfig;
    t4: GradeLevelConfig;
    university: GradeLevelConfig;
    [key: string]: GradeLevelConfig;
  };
  modules: {
    tutor_ia: ModuleConfig;
    lesson_copilot: ModuleConfig;
    homework_chat: ModuleConfig;
    [key: string]: ModuleConfig;
  };
  personalization_layer: PersonalizationLayer;
}

interface TeacherFunctionConfig {
  description: string;
  prompt: string;
}

interface TeacherFormatConfig {
  description: string;
  prompt: string;
}

interface TeacherMasterConfig {
  version: string;
  core_identity: string;
  functions: {
    lesson_planner: TeacherFunctionConfig;
    grading_assistant: TeacherFunctionConfig;
    behavioral_insights: TeacherFunctionConfig;
    analytics_review: TeacherFunctionConfig;
    general: TeacherFunctionConfig;
    [key: string]: TeacherFunctionConfig;
  };
  formatting: {
    dashboard_summary: TeacherFormatConfig;
    parent_report: TeacherFormatConfig;
    [key: string]: TeacherFormatConfig;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public context types
// ─────────────────────────────────────────────────────────────────────────────

/** The three student-facing product interfaces. */
export type StudentModule = 'tutor_ia' | 'lesson_copilot' | 'homework_chat';

/**
 * Full personalization context (Layer 4).
 * All fields are optional — PromptManager substitutes safe defaults when absent.
 */
export interface StudentPersonalization {
  /** Areas of demonstrated strength (e.g., ['Álgebra', 'Geometría']). */
  skills?: string[];
  /** Known concepts the student struggles with (e.g., ['Fracciones equivalentes']). */
  learningGaps?: string[];
  /** Current concept the student is actively struggling with. */
  topic?: string;
  /** Prescribed remediation strategy for the active topic. */
  remediationStrategy?: string;
  /** Brief summary of recent conversation context. */
  recentChatHistory?: string;
}

export interface StudentPromptContext {
  /** Which student interface is calling — determines Layer 3 directive + override. */
  module: StudentModule;
  /** Student's grade level string, e.g. "2° de Secundaria". Used for tranche selection. */
  gradeLevel?: string;
  /** Student's age. Fallback when gradeLevel is absent. */
  age?: number;
  /** Layer 4 personalization data. Only injected when provided. */
  personalization?: StudentPersonalization;
}

export type TeacherFunction =
  | 'lesson_planner'
  | 'grading_assistant'
  | 'behavioral_insights'
  | 'analytics_review'
  | 'general';

export type TeacherFormat = 'dashboard_summary' | 'parent_report';

export interface TeacherPromptContext {
  function?: TeacherFunction;
  format?: TeacherFormat;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade tranche resolution
// ─────────────────────────────────────────────────────────────────────────────

export type GradeKey = 't1' | 't2' | 't3' | 't4' | 'university';

/**
 * Maps gradeLevel string + optional age to one of the five YAML tranche keys.
 *
 * T1: G1–G3 (Ages 7–9)   — Primary Low
 * T2: G4–G6 (Ages 10–12) — Primary High
 * T3: G7–G9 (Ages 13–15) — Middle School
 * T4: G10–12 (Ages 16–18) — High School
 * T5: University (Ages 19+)
 *
 * Priority: gradeLevel string > age fallback > default (t3).
 */
function resolveGradeKey(gradeLevel?: string, age?: number): GradeKey {
  const g = gradeLevel?.toLowerCase() || '';

  if (g) {
    if (g.includes('universidad') || g.includes('university') || g.includes('uni')) {
      return 'university';
    }
    if (g.includes('preparatoria') || g.includes('prepa') || g.includes('bachillerato') || g.includes('bachiller')) {
      return 't4';
    }
    if (g.includes('secundaria') || g.includes('secun')) {
      return 't3';
    }
    // Primaria — distinguish 4°–6° (T2) from 1°–3° (T1)
    if (g.includes('primaria')) {
      const numMatch = g.match(/\b([1-6])\b/);
      if (numMatch) {
        const n = parseInt(numMatch[1], 10);
        return n >= 4 ? 't2' : 't1';
      }
      return 't1'; // default primaria to T1
    }
  }

  if (age !== undefined && age > 0) {
    if (age >= 19) return 'university';
    if (age >= 16) return 't4';
    if (age >= 13) return 't3';
    if (age >= 10) return 't2';
    if (age >= 7)  return 't1';
  }

  return 't3'; // safe default: middle school
}

// ─────────────────────────────────────────────────────────────────────────────
// Personalization template filler
// ─────────────────────────────────────────────────────────────────────────────

function fillPersonalizationTemplate(
  template: string,
  p: StudentPersonalization
): string {
  const skills = p.skills?.join(', ') || 'No especificado';
  const learningGaps = p.learningGaps?.join(', ') || 'Ninguna identificada';
  const topic = p.topic || 'General';
  const remediationStrategy = p.remediationStrategy || 'Analogías visuales y ejemplos cotidianos';
  const recentChatHistory = p.recentChatHistory || 'Primera sesión — sin historial previo.';

  return template
    .replace(/\{skills\}/g, skills)
    .replace(/\{learning_gaps\}/g, learningGaps)
    .replace(/\{topic\}/g, topic)
    .replace(/\{remediation_strategy\}/g, remediationStrategy)
    .replace(/\{recent_chat_history\}/g, recentChatHistory);
}

// ─────────────────────────────────────────────────────────────────────────────
// PromptManager class
// ─────────────────────────────────────────────────────────────────────────────

class PromptManagerService {
  private studentConfig: StudentMasterConfig | null = null;
  private teacherConfig: TeacherMasterConfig | null = null;

  private readonly studentYamlPath = path.resolve(
    __dirname, '../../data/prompts/student_master.yaml'
  );
  private readonly teacherYamlPath = path.resolve(
    __dirname, '../../data/prompts/teacher_master.yaml'
  );

  // ── Config loading ──────────────────────────────────────────────────────────

  /**
   * Load and cache both YAML configs.
   * Called once at server startup. Safe to call multiple times (no-op if cached).
   */
  loadConfigs(): void {
    if (!this.studentConfig) {
      try {
        const raw = fs.readFileSync(this.studentYamlPath, 'utf-8');
        this.studentConfig = yaml.load(raw) as StudentMasterConfig;
        console.log('[PromptManager] student_master.yaml loaded (v' + this.studentConfig.version + ')');
      } catch (err) {
        console.error('[PromptManager] Failed to load student_master.yaml:', err);
        throw new Error('PromptManager: student_master.yaml is required but could not be loaded.');
      }
    }

    if (!this.teacherConfig) {
      try {
        const raw = fs.readFileSync(this.teacherYamlPath, 'utf-8');
        this.teacherConfig = yaml.load(raw) as TeacherMasterConfig;
        console.log('[PromptManager] teacher_master.yaml loaded (v' + this.teacherConfig.version + ')');
      } catch (err) {
        console.error('[PromptManager] Failed to load teacher_master.yaml:', err);
        throw new Error('PromptManager: teacher_master.yaml is required but could not be loaded.');
      }
    }
  }

  /**
   * Hot-reload YAML configs from disk (useful during prompt iteration).
   * Clears cache and reloads both files.
   */
  reloadConfigs(): void {
    this.studentConfig = null;
    this.teacherConfig = null;
    this.loadConfigs();
    console.log('[PromptManager] Configs hot-reloaded.');
  }

  // ── Student prompt assembly ─────────────────────────────────────────────────

  /**
   * Assemble the full student base prompt from all 4 layers.
   *
   * Assembly order (lower index = injected first):
   *   1. core_identity                — Velocity Coach DNA + 3-mode directive
   *   2. grade.persona_segment        — Tranche-specific persona + vocabulary ceiling
   *   3. grade.methodology            — 3-mode methodology for this tranche
   *   4. grade.response_guidelines    — Tone + formatting rules
   *   5. grade.prohibitions           — What is never allowed for this tranche
   *   6. module.constraint            — Product directive + Layer 1 override note
   *   7. personalization              — Individual context (conditional, highest data weight)
   *
   * Layer 3 override weighting:
   *   'relaxed' (tutor_ia)      → direct answers explicitly permitted
   *   'standard' (lesson_copilot) → Socratic default unchanged
   *   'blocked' (homework_chat)  → direct answers explicitly forbidden
   *
   * Dynamic content added by calling services (lesson content, NEM RAG,
   * struggle resources, memories) is NOT part of this method.
   */
  getStudentBasePrompt(context: StudentPromptContext): string {
    this.ensureLoaded();
    const cfg = this.studentConfig!;

    const gradeKey = resolveGradeKey(context.gradeLevel, context.age);
    const grade = cfg.grade_levels[gradeKey];
    const module = cfg.modules[context.module] ?? cfg.modules['lesson_copilot'];

    console.log(
      `[PromptManager] Assembling student prompt | module=${context.module} | ` +
      `tranche=${grade.tranche} (${gradeKey}) | override=${module.layer1_override}`
    );

    const parts: string[] = [
      // Layer 1 — DNA Master
      cfg.core_identity.trim(),
      // Layer 2 — Cognitive Tranche
      grade.persona_segment.trim(),
      grade.methodology.trim(),
      grade.response_guidelines.trim(),
      grade.prohibitions.trim(),
      // Layer 3 — Product Directive (with override note)
      this.buildModuleSection(module),
    ];

    // Layer 4 — Personalization (injected only when data is provided)
    if (context.personalization && this.hasPersonalizationData(context.personalization)) {
      const filled = fillPersonalizationTemplate(
        cfg.personalization_layer.template,
        context.personalization
      );
      parts.push(filled.trim());
    }

    return parts.join('\n\n') + '\n\n';
  }

  /**
   * Check if a student tranche allows enthusiasm (ages ≤12 → T1 and T2).
   * Used by services that branch on tone for Velocity Leap formatting.
   */
  allowsEnthusiasm(gradeLevel?: string, age?: number): boolean {
    const key = resolveGradeKey(gradeLevel, age);
    return key === 't1' || key === 't2';
  }

  /**
   * Expose the resolved grade key for callers that need it (e.g., for logging).
   */
  getGradeKey(gradeLevel?: string, age?: number): GradeKey {
    return resolveGradeKey(gradeLevel, age);
  }

  /**
   * Returns the Layer 1 override mode for a given module.
   * Used by services that need to know if direct answers are blocked/relaxed.
   */
  getModuleOverride(module: StudentModule): Layer1Override {
    this.ensureLoaded();
    return this.studentConfig!.modules[module]?.layer1_override ?? 'standard';
  }

  // ── Teacher prompt assembly ─────────────────────────────────────────────────

  /**
   * Assemble the teacher system prompt.
   *
   *   1. core_identity — Architect Co-Pilot directive
   *   2. function      — Feature-specific behavior (conditional)
   *   3. format        — Output format rules (conditional)
   */
  getTeacherBasePrompt(context: TeacherPromptContext = {}): string {
    this.ensureLoaded();
    const cfg = this.teacherConfig!;

    const parts: string[] = [cfg.core_identity.trim()];

    if (context.function) {
      const fn = cfg.functions[context.function] ?? cfg.functions['general'];
      parts.push(fn.prompt.trim());
    }

    if (context.format) {
      const fmt = cfg.formatting[context.format];
      if (fmt) parts.push(fmt.prompt.trim());
    }

    return parts.join('\n\n') + '\n\n';
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private ensureLoaded(): void {
    if (!this.studentConfig || !this.teacherConfig) {
      this.loadConfigs();
    }
  }

  /**
   * Build the module section with a header and the constraint text.
   * The constraint already embeds the Layer 1 override note (from YAML).
   */
  private buildModuleSection(module: ModuleConfig): string {
    return `## DIRECTIVA DE INTERFAZ: ${module.description.toUpperCase()}\n\n${module.constraint.trim()}`;
  }

  /**
   * Returns true if any personalization field has meaningful data.
   * Prevents injecting an empty personalization block.
   */
  private hasPersonalizationData(p: StudentPersonalization): boolean {
    return !!(
      (p.skills?.length) ||
      (p.learningGaps?.length) ||
      p.topic ||
      p.remediationStrategy ||
      p.recentChatHistory
    );
  }
}

export const promptManager = new PromptManagerService();
