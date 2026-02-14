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
