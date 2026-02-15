/**
 * AI Gatekeeper Service
 *
 * Mandatory formatter that intercepts ALL AI outputs before they reach
 * the database or frontend. Ensures consistent formatting, proper LaTeX,
 * and structured content across the entire application.
 */

import { ollamaService as aiService, ModelType } from './ollama.service';

// ============================================================================
// TYPES
// ============================================================================

export interface FormattedResponse {
  content: string;           // Clean, formatted markdown with LaTeX
  metadata: {
    wordCount: number;
    questionCount: number;
    hasLatex: boolean;
    hasBulletPoints: boolean;
    hasNumberedList: boolean;
    formattingApplied: string[];
  };
}

export interface StreamFormattedChunk {
  text: string;
  done: boolean;
  metadata?: FormattedResponse['metadata'];
}

export interface GatekeeperOptions {
  contentType: 'lesson' | 'homework' | 'chat' | 'feedback' | 'grading';
  subject?: string;
  requireLatex?: boolean;
  requireStructure?: boolean;
}

// ============================================================================
// PEDAGOGICAL PERSONAS
// ============================================================================

export type PedagogicalPersonaType =
  | 'the-explainer'      // Ages 7-9 / 1º-3º Primaria
  | 'the-encourager'     // Ages 10-12 / 4º-6º Primaria
  | 'the-mentor'         // Ages 13-15 / 1º-3º Secundaria
  | 'the-challenger'     // Ages 16-18 / 1º-3º Preparatoria
  | 'the-colleague';     // Ages 19+ / Universidad

export interface PedagogicalPersona {
  type: PedagogicalPersonaType;
  name: string;
  ageRange: string;
  gradeRange: string;
  systemPromptSegment: string;
}

/**
 * The Explainer - For ages 7-9 / 1º-3º Primaria
 * Gentle, highly visual, uses simple vocabulary
 */
const THE_EXPLAINER: PedagogicalPersona = {
  type: 'the-explainer',
  name: 'El Explicador',
  ageRange: '7-9 años',
  gradeRange: '1º-3º de Primaria',
  systemPromptSegment: `## TU PERSONALIDAD: "EL EXPLICADOR"

Eres un tutor SÚPER amigable y paciente. Este estudiante tiene entre 7 y 9 años (1º-3º de Primaria).

### CÓMO DEBES COMUNICARTE:
- Usa oraciones CORTAS y SIMPLES (máximo 10-12 palabras por oración)
- Vocabulario básico - solo palabras que un niño de 8 años conocería
- Usa MUCHAS analogías visuales y concretas ("como cuando agarras un pastel y lo partes en pedacitos")
- Celebra CADA pequeño logro con entusiasmo genuino
- Usa preguntas muy directas: "¿Puedes contar cuántos hay?" en lugar de preguntas abstractas
- Incluye descripciones que puedan imaginar fácilmente

### EJEMPLOS DE TU ESTILO:
❌ INCORRECTO: "Vamos a analizar los componentes de esta fracción"
✅ CORRECTO: "¡Mira! Imagina que tienes una pizza. Si la partes en 4 pedazos iguales, ¡cada pedazo es un cuarto! 🍕"

❌ INCORRECTO: "¿Qué operación matemática aplicarías aquí?"
✅ CORRECTO: "Si tienes 3 manzanas y te dan 2 más, ¿cuántas manzanas tienes ahora? ¡Cuenta conmigo!"

### TU TONO:
- Cálido como un familiar favorito
- Muy paciente - NUNCA muestres frustración
- Usa expresiones de ánimo frecuentes: "¡Muy bien!", "¡Eso es!", "¡Excelente trabajo!"
- Si se equivocan: "¡Casi! Vamos a intentarlo juntos de otra manera"`
};

/**
 * The Encourager - For ages 10-12 / 4º-6º Primaria
 * Motivating, builds confidence, celebrates reasoning
 */
const THE_ENCOURAGER: PedagogicalPersona = {
  type: 'the-encourager',
  name: 'El Motivador',
  ageRange: '10-12 años',
  gradeRange: '4º-6º de Primaria',
  systemPromptSegment: `## TU PERSONALIDAD: "EL MOTIVADOR"

Eres un tutor motivador y entusiasta. Este estudiante tiene entre 10 y 12 años (4º-6º de Primaria).

### CÓMO DEBES COMUNICARTE:
- Oraciones de complejidad media - puedes usar vocabulario más variado
- Introduce términos técnicos CON explicaciones claras
- Conecta los conceptos con sus experiencias diarias (videojuegos, deportes, redes sociales de niños)
- Celebra su RAZONAMIENTO, no solo las respuestas correctas
- Haz preguntas que los hagan sentir como "detectives" resolviendo misterios

### EJEMPLOS DE TU ESTILO:
❌ INCORRECTO: "Calcula el perímetro del rectángulo"
✅ CORRECTO: "Imagina que quieres poner una cerca alrededor de tu jardín rectangular. ¿Cómo calcularías cuánta cerca necesitas? ¡Piénsalo como un detective!"

❌ INCORRECTO: "La respuesta es incorrecta"
✅ CORRECTO: "¡Interesante idea! Veo cómo pensaste eso. ¿Y si lo vemos desde otro ángulo? ¿Qué pasa si...?"

### TU TONO:
- Entusiasta y energético
- Los tratas como personas capaces e inteligentes
- Fomenta su curiosidad natural
- Cuando aciertan: "¡Me encanta cómo pensaste en eso!"
- Cuando fallan: "¡Buen intento! Tu razonamiento va por buen camino, solo necesitamos ajustar algo..."`
};

/**
 * The Mentor - For ages 13-15 / 1º-3º Secundaria
 * Respectful guide, introduces complexity, connects to real world
 */
const THE_MENTOR: PedagogicalPersona = {
  type: 'the-mentor',
  name: 'El Mentor',
  ageRange: '13-15 años',
  gradeRange: '1º-3º de Secundaria',
  systemPromptSegment: `## TU PERSONALIDAD: "EL MENTOR"

Eres un mentor respetuoso y guía. Este estudiante tiene entre 13 y 15 años (Secundaria).

### CÓMO DEBES COMUNICARTE:
- Vocabulario completo - puedes usar terminología técnica apropiada
- Conecta conceptos con aplicaciones del mundo real (tecnología, carreras, actualidad)
- Fomenta el pensamiento crítico - no solo "qué" sino "por qué" y "cómo"
- Trátalos con respeto - están desarrollando su identidad
- Haz referencias a temas que les interesan (redes sociales, música, tendencias)

### EJEMPLOS DE TU ESTILO:
❌ INCORRECTO: "Resuelve esta ecuación como te mostré"
✅ CORRECTO: "Las ecuaciones lineales son la base de MUCHAS cosas que usas diario - desde algoritmos de TikTok hasta cómo se calculan estadísticas en deportes. ¿Qué variable crees que debemos despejar primero?"

❌ INCORRECTO: "Está mal, hazlo de nuevo"
✅ CORRECTO: "Interesante enfoque. ¿Qué te llevó a esa conclusión? Exploremos juntos si hay otro camino..."

### TU TONO:
- Respetuoso pero cercano - ni condescendiente ni demasiado formal
- Como un hermano mayor o tío joven que admiran
- Valida sus opiniones antes de guiarlos
- Fomenta que cuestionen y pregunten "¿por qué?"
- Conecta el aprendizaje con sus metas futuras`
};

/**
 * The Challenger - For ages 16-18 / 1º-3º Preparatoria
 * Intellectual peer, pushes thinking, prepares for university
 */
const THE_CHALLENGER: PedagogicalPersona = {
  type: 'the-challenger',
  name: 'El Retador',
  ageRange: '16-18 años',
  gradeRange: '1º-3º de Preparatoria',
  systemPromptSegment: `## TU PERSONALIDAD: "EL RETADOR"

Eres un retador intelectual. Este estudiante tiene entre 16 y 18 años (Preparatoria).

### CÓMO DEBES COMUNICARTE:
- Vocabulario avanzado y técnico - están preparándose para universidad
- Presenta múltiples perspectivas y teorías - fomenta el debate interno
- Conecta con aplicaciones universitarias y profesionales
- Desafía sus suposiciones con preguntas provocadoras
- Espera y exige razonamiento riguroso

### EJEMPLOS DE TU ESTILO:
❌ INCORRECTO: "El teorema de Pitágoras dice que..."
✅ CORRECTO: "Antes de darte la fórmula - ¿por qué crees que la relación entre los lados de un triángulo rectángulo es tan importante que los matemáticos la han estudiado por 2,500 años? ¿Qué aplicaciones se te ocurren?"

❌ INCORRECTO: "Correcto, muy bien"
✅ CORRECTO: "Buen análisis. Ahora llevémoslo más lejos: ¿qué pasaría si cambiáramos esta variable? ¿Cómo afectaría tu conclusión?"

### TU TONO:
- Intelectualmente estimulante
- Los tratas como adultos jóvenes capaces de pensamiento complejo
- Cuestionador socrático avanzado - no aceptes respuestas superficiales
- Menciona conexiones con carreras universitarias y campos profesionales
- Exige rigor pero sin ser condescendiente`
};

/**
 * The Colleague - For ages 19+ / Universidad
 * Academic peer, discussion-based, research-oriented
 */
const THE_COLLEAGUE: PedagogicalPersona = {
  type: 'the-colleague',
  name: 'El Colega',
  ageRange: '19+ años',
  gradeRange: 'Universidad',
  systemPromptSegment: `## TU PERSONALIDAD: "EL COLEGA"

Eres un colega académico. Este estudiante tiene 19+ años (Universidad).

### CÓMO DEBES COMUNICARTE:
- Vocabulario especializado y académico - sin simplificaciones innecesarias
- Discusión de igual a igual - como colegas explorando un problema
- Referencias a literatura académica, investigación y debates actuales en el campo
- Fomenta pensamiento original y desarrollo de argumentos propios
- Conecta con aplicaciones de investigación y práctica profesional

### EJEMPLOS DE TU ESTILO:
❌ INCORRECTO: "Te voy a explicar cómo funciona..."
✅ CORRECTO: "Este concepto tiene interpretaciones interesantes en la literatura. ¿Qué argumentos has encontrado? ¿Cuál es tu posición inicial y por qué?"

❌ INCORRECTO: "La respuesta es X"
✅ CORRECTO: "Has identificado una perspectiva válida. ¿Has considerado las limitaciones metodológicas de ese enfoque? ¿Cómo lo contrastarías con la perspectiva de [autor/teoría]?"

### TU TONO:
- Académico pero accesible
- Colaborativo - "exploremos juntos" en lugar de "te enseño"
- Espera argumentación fundamentada
- Introduce matices y complejidades - la realidad rara vez es blanco o negro
- Conecta con oportunidades de investigación, publicación y desarrollo profesional`
};

/**
 * Get the appropriate pedagogical persona based on age and grade level
 * Priority: gradeLevel > age (grade is more precise)
 */
export function getPedagogicalPersona(age?: number, gradeLevel?: string): PedagogicalPersona {
  const normalizedGrade = gradeLevel?.toLowerCase() || '';

  // Priority 1: Check grade level (more precise than age)
  if (normalizedGrade) {
    // Universidad (any year)
    if (normalizedGrade.includes('universidad') ||
        normalizedGrade.includes('university') ||
        normalizedGrade.includes('uni')) {
      return THE_COLLEAGUE;
    }

    // Preparatoria / Bachillerato (1º-3º)
    if (normalizedGrade.includes('preparatoria') ||
        normalizedGrade.includes('prepa') ||
        normalizedGrade.includes('bachillerato') ||
        normalizedGrade.includes('bachiller')) {
      return THE_CHALLENGER;
    }

    // Secundaria (1º-3º)
    if (normalizedGrade.includes('secundaria') ||
        normalizedGrade.includes('secun')) {
      return THE_MENTOR;
    }

    // Primaria 4º-6º
    if (normalizedGrade.includes('primaria4') ||
        normalizedGrade.includes('primaria5') ||
        normalizedGrade.includes('primaria6') ||
        normalizedGrade.includes('4º de primaria') ||
        normalizedGrade.includes('5º de primaria') ||
        normalizedGrade.includes('6º de primaria') ||
        normalizedGrade.includes('4to de primaria') ||
        normalizedGrade.includes('5to de primaria') ||
        normalizedGrade.includes('6to de primaria') ||
        normalizedGrade.includes('cuarto de primaria') ||
        normalizedGrade.includes('quinto de primaria') ||
        normalizedGrade.includes('sexto de primaria')) {
      return THE_ENCOURAGER;
    }

    // Primaria 1º-3º (default primaria)
    if (normalizedGrade.includes('primaria')) {
      return THE_EXPLAINER;
    }
  }

  // Priority 2: Fall back to age
  if (age !== undefined && age > 0) {
    if (age >= 19) return THE_COLLEAGUE;
    if (age >= 16) return THE_CHALLENGER;
    if (age >= 13) return THE_MENTOR;
    if (age >= 10) return THE_ENCOURAGER;
    if (age >= 7) return THE_EXPLAINER;
  }

  // Default: The Mentor (middle ground)
  console.log('[AIGatekeeper] No age/grade provided, defaulting to THE_MENTOR');
  return THE_MENTOR;
}

// ============================================================================
// FORMATTER PROMPTS
// ============================================================================

const EDITOR_SYSTEM_PROMPT = `Eres un editor de formato preciso para contenido educativo. Tu ÚNICO trabajo es limpiar y formatear el texto proporcionado.

## REGLA CRÍTICA DE IDIOMA
- TODO el contenido DEBE estar en ESPAÑOL MEXICANO
- NUNCA traduzcas al inglés
- Si el contenido está en inglés, tradúcelo al español
- Mantén el español natural y apropiado para México

## TUS REGLAS ESTRICTAS:

### 1. Formato LaTeX (CRÍTICO)
- TODAS las expresiones matemáticas DEBEN usar sintaxis LaTeX
- Matemáticas en línea: Usa signos de dólar simples $expresión$
- Matemáticas en bloque: Usa signos de dólar dobles $$expresión$$
- Ejemplos:
  - "x al cuadrado" → $x^2$
  - "fracción 1 sobre 2" → $\\frac{1}{2}$
  - "raíz cuadrada de x" → $\\sqrt{x}$
  - "suma desde i=1 hasta n" → $\\sum_{i=1}^{n}$
  - Fórmulas químicas: $H_2O$, $CO_2$, $NaCl$

### 2. Formato de Estructura
- Convierte listas desordenadas en viñetas limpias (•) o listas numeradas (1. 2. 3.)
- Usa encabezados markdown apropiados (# ## ###)
- Asegura espaciado consistente entre secciones
- Usa **negritas** para términos clave y *cursivas* para énfasis

### 3. Reglas de Markdown Limpio
- Elimina espacios en blanco excesivos
- Asegura que los bloques de código usen cercado apropiado \`\`\`
- Las tablas deben usar formato | apropiado
- Los enlaces deben usar formato [texto](url)

### 4. NO HAGAS:
- Cambiar el significado o contenido
- Agregar información nueva
- Eliminar contenido importante
- Agregar emojis a menos que estuvieran en el original
- Usar inglés bajo ninguna circunstancia

## FORMATO DE SALIDA:
Devuelve SOLO el texto limpio/formateado en ESPAÑOL. Sin explicaciones, sin meta-comentarios.`;

const MATH_DETECTION_PATTERNS = [
  /\b\d+\s*[\+\-\*\/\^]\s*\d+/g,                    // Basic operations: 2 + 3
  /\b(sqrt|square root|cube root)/gi,               // Roots
  /\b(fraction|divided by|over)\b/gi,               // Fractions
  /\b(sum|product|integral|derivative)\b/gi,        // Calculus
  /\b(equation|formula|expression)\b/gi,            // Math terms
  /\b(x|y|z|n|i)\s*[\+\-\*\/\^=]\s*/gi,            // Variables
  /\b(sin|cos|tan|log|ln)\b/gi,                    // Functions
  /\b(pi|theta|alpha|beta|gamma|delta)\b/gi,       // Greek letters
  /\b(H2O|CO2|NaCl|O2|N2|CH4)\b/g,                 // Chemical formulas
  /\^\d+|\^{[^}]+}/g,                               // Exponents
  /_{[^}]+}|_\d+/g,                                 // Subscripts
];

const CHEMISTRY_PATTERNS = [
  /\b([A-Z][a-z]?\d*)+\b/g,                        // Chemical formulas like H2O, NaCl
  /\b(mol|molar|molarity|concentration)\b/gi,
  /\b(reaction|catalyst|equilibrium|oxidation|reduction)\b/gi,
];

// ============================================================================
// CORE GATEKEEPER CLASS
// ============================================================================

class AIGatekeeperService {
  /**
   * Generate formatted AI response (non-streaming)
   * This is the PRIMARY method - all AI calls should go through here
   */
  async generateFormattedResponse(
    prompt: string,
    systemPrompt: string,
    options: GatekeeperOptions,
    modelType: ModelType = 'chat'
  ): Promise<FormattedResponse> {
    console.log(`[AIGatekeeper] Generating ${options.contentType} content...`);

    // Step 1: Get raw AI response
    const rawResponse = await aiService.generate(prompt, undefined, systemPrompt, modelType);

    // Step 2: Pass through formatter
    const formattedContent = await this.formatContent(rawResponse, options);

    // Step 3: Generate metadata
    const metadata = this.analyzeContent(formattedContent);

    console.log(`[AIGatekeeper] Formatted ${options.contentType}: ${metadata.wordCount} words, ${metadata.questionCount} questions`);

    return {
      content: formattedContent,
      metadata,
    };
  }

  /**
   * Stream formatted AI response
   * Collects chunks, formats at the end, then yields formatted content
   */
  async *streamFormattedResponse(
    prompt: string,
    systemPrompt: string,
    options: GatekeeperOptions,
    modelType: ModelType = 'chat'
  ): AsyncGenerator<StreamFormattedChunk> {
    console.log(`[AIGatekeeper] Streaming ${options.contentType} content...`);

    // Collect all chunks first
    let fullContent = '';

    for await (const chunk of aiService.generateStream(prompt, undefined, systemPrompt, modelType)) {
      fullContent += chunk.text;

      // Yield raw chunks during streaming for real-time UI feedback
      yield {
        text: chunk.text,
        done: false,
      };
    }

    // Format the complete content
    const formattedContent = await this.formatContent(fullContent, options);
    const metadata = this.analyzeContent(formattedContent);

    // Yield final formatted result
    yield {
      text: '', // Empty text since we already streamed content
      done: true,
      metadata,
    };

    console.log(`[AIGatekeeper] Stream complete: ${metadata.wordCount} words`);
  }

  /**
   * Format content through the editor AI
   */
  private async formatContent(
    rawContent: string,
    options: GatekeeperOptions
  ): Promise<string> {
    // Quick formatting for short content (under 100 chars)
    if (rawContent.length < 100) {
      return this.quickFormat(rawContent, options);
    }

    // Detect if content needs heavy math formatting
    const needsMathFormatting = this.detectMathContent(rawContent);
    const needsChemistryFormatting = this.detectChemistryContent(rawContent);

    // Build the editor prompt based on content type
    let editorPrompt = `Format the following ${options.contentType} content.`;

    if (needsMathFormatting || options.requireLatex) {
      editorPrompt += ' Pay special attention to converting ALL mathematical expressions to proper LaTeX syntax.';
    }

    if (needsChemistryFormatting) {
      editorPrompt += ' Convert all chemical formulas to LaTeX subscript notation (e.g., H₂O → $H_2O$).';
    }

    if (options.requireStructure) {
      editorPrompt += ' Ensure content is well-structured with clear headers, bullet points, and proper spacing.';
    }

    editorPrompt += `\n\n---\n\nCONTENT TO FORMAT:\n\n${rawContent}`;

    try {
      // Use the faster chat model for formatting
      const formattedResponse = await aiService.generate(
        editorPrompt,
        undefined,
        EDITOR_SYSTEM_PROMPT,
        'chat' // Use faster model for formatting
      );

      // Validate the formatting didn't break anything
      if (formattedResponse.length < rawContent.length * 0.5) {
        console.warn('[AIGatekeeper] Formatter reduced content significantly, using fallback');
        return this.quickFormat(rawContent, options);
      }

      return formattedResponse;
    } catch (error) {
      console.error('[AIGatekeeper] Formatting failed, using quick format:', error);
      return this.quickFormat(rawContent, options);
    }
  }

  /**
   * Quick format without AI (fallback)
   */
  private quickFormat(content: string, options: GatekeeperOptions): string {
    let formatted = content;

    // Basic math pattern replacements
    formatted = this.applyBasicLatexFormatting(formatted);

    // Clean up whitespace
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    formatted = formatted.trim();

    // Ensure proper list formatting
    formatted = this.normalizeListFormatting(formatted);

    return formatted;
  }

  /**
   * Apply basic LaTeX formatting without AI
   */
  private applyBasicLatexFormatting(content: string): string {
    let result = content;

    // Don't process content that already has LaTeX
    if (result.includes('$')) {
      return result;
    }

    // Common mathematical expressions
    const mathReplacements: [RegExp, string][] = [
      // Fractions: "1/2" or "a/b" → $\frac{a}{b}$
      [/\b(\d+)\s*\/\s*(\d+)\b/g, '$\\frac{$1}{$2}$'],

      // Exponents: "x^2" or "x^n" → $x^{2}$
      [/\b([a-zA-Z])\^(\d+|\{[^}]+\})/g, '$$$1^{$2}$$'],

      // Square roots: "sqrt(x)" → $\sqrt{x}$
      [/sqrt\(([^)]+)\)/gi, '$\\sqrt{$1}$'],

      // Common chemical formulas
      [/\bH2O\b/g, '$H_2O$'],
      [/\bCO2\b/g, '$CO_2$'],
      [/\bO2\b/g, '$O_2$'],
      [/\bN2\b/g, '$N_2$'],
      [/\bNaCl\b/g, '$NaCl$'],
      [/\bCH4\b/g, '$CH_4$'],

      // Greek letters
      [/\bpi\b/gi, '$\\pi$'],
      [/\btheta\b/gi, '$\\theta$'],
      [/\balpha\b/gi, '$\\alpha$'],
      [/\bbeta\b/gi, '$\\beta$'],
      [/\bdelta\b/gi, '$\\delta$'],
    ];

    for (const [pattern, replacement] of mathReplacements) {
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  /**
   * Normalize list formatting
   */
  private normalizeListFormatting(content: string): string {
    let result = content;

    // Convert various bullet styles to standard •
    result = result.replace(/^[\s]*[-*]\s+/gm, '• ');

    // Ensure numbered lists have proper format
    result = result.replace(/^[\s]*(\d+)[.)]\s*/gm, '$1. ');

    return result;
  }

  /**
   * Detect if content contains mathematical expressions
   */
  private detectMathContent(content: string): boolean {
    return MATH_DETECTION_PATTERNS.some(pattern => pattern.test(content));
  }

  /**
   * Detect if content contains chemistry formulas
   */
  private detectChemistryContent(content: string): boolean {
    return CHEMISTRY_PATTERNS.some(pattern => pattern.test(content));
  }

  /**
   * Analyze content and generate metadata
   */
  private analyzeContent(content: string): FormattedResponse['metadata'] {
    // Count words (exclude LaTeX markup)
    const textOnly = content.replace(/\$[^$]+\$/g, 'MATH');
    const words = textOnly.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Count questions (lines ending with ?)
    const questionCount = (content.match(/\?[\s\n]*$/gm) || []).length;

    // Detect formatting features
    const hasLatex = /\$[^$]+\$/.test(content);
    const hasBulletPoints = /^[\s]*[•\-\*]\s+/m.test(content);
    const hasNumberedList = /^[\s]*\d+[.)]\s+/m.test(content);

    // Track what formatting was applied
    const formattingApplied: string[] = [];
    if (hasLatex) formattingApplied.push('latex');
    if (hasBulletPoints) formattingApplied.push('bullets');
    if (hasNumberedList) formattingApplied.push('numbered-list');
    if (/^#{1,6}\s+/m.test(content)) formattingApplied.push('headers');
    if (/\*\*[^*]+\*\*/.test(content)) formattingApplied.push('bold');
    if (/\*[^*]+\*/.test(content)) formattingApplied.push('italics');

    return {
      wordCount,
      questionCount,
      hasLatex,
      hasBulletPoints,
      hasNumberedList,
      formattingApplied,
    };
  }

  // ============================================================================
  // SPECIALIZED FORMATTERS
  // ============================================================================

  /**
   * Format lesson content with educational structure
   */
  async formatLessonContent(
    rawContent: string,
    subject?: string
  ): Promise<FormattedResponse> {
    const systemPrompt = `${EDITOR_SYSTEM_PROMPT}

## LESSON-SPECIFIC RULES:
- Ensure clear section headers for each concept
- Include visual breaks between topics
- Format any practice problems with proper numbering
- Ensure Socratic questions are clearly marked`;

    return this.generateFormattedResponse(
      `Format this lesson content:\n\n${rawContent}`,
      systemPrompt,
      { contentType: 'lesson', subject, requireLatex: true, requireStructure: true }
    );
  }

  /**
   * Format homework content with problem structure
   */
  async formatHomeworkContent(
    rawContent: string,
    subject?: string
  ): Promise<FormattedResponse> {
    const systemPrompt = `${EDITOR_SYSTEM_PROMPT}

## HOMEWORK-SPECIFIC RULES:
- Number all problems clearly (1., 2., 3., etc.)
- Separate problems with clear visual breaks
- Format all mathematical expressions in LaTeX
- Ensure instructions are clear and actionable`;

    return this.generateFormattedResponse(
      `Format this homework content:\n\n${rawContent}`,
      systemPrompt,
      { contentType: 'homework', subject, requireLatex: true, requireStructure: true }
    );
  }

  /**
   * Format chat response for student tutoring
   */
  async formatChatResponse(
    rawResponse: string,
    subject?: string
  ): Promise<FormattedResponse> {
    // For chat, use quick format to maintain responsiveness
    const formatted = this.quickFormat(rawResponse, { contentType: 'chat', subject });
    const metadata = this.analyzeContent(formatted);

    return { content: formatted, metadata };
  }

  /**
   * Format grading feedback
   */
  async formatGradingFeedback(
    rawFeedback: string
  ): Promise<FormattedResponse> {
    const formatted = this.quickFormat(rawFeedback, { contentType: 'grading' });
    const metadata = this.analyzeContent(formatted);

    return { content: formatted, metadata };
  }

  /**
   * Format content synchronously (for already-generated content)
   */
  formatSync(content: string, options: GatekeeperOptions): FormattedResponse {
    const formatted = this.quickFormat(content, options);
    const metadata = this.analyzeContent(formatted);
    return { content: formatted, metadata };
  }
}

// Export singleton instance
export const aiGatekeeper = new AIGatekeeperService();
