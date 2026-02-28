/**
 * SmartMarkdown - Universal Markdown Renderer with LaTeX Support
 *
 * This component renders formatted content from the AI Gatekeeper with:
 * - Full LaTeX/KaTeX math rendering ($...$ and $$...$$)
 * - Proper syntax highlighting for code blocks
 * - Clean markdown formatting (headers, lists, tables)
 * - Responsive styling with glass design system
 * - Focus Mode typography with 1.8 line-height
 * - Analogy Boxes for blockquotes (Socratic context)
 * - Primary-colored text glows for key vocabulary
 */

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

// Import KaTeX CSS for math rendering
import 'katex/dist/katex.min.css';

export interface SmartMarkdownProps {
  content: string;
  className?: string;
  variant?: 'default' | 'lesson' | 'homework' | 'chat' | 'feedback' | 'focus';
  compact?: boolean;
  /**
   * Number of Depth-Checks the student has completed this session.
   * A "Velocity Streak" badge renders when this reaches 3+.
   * Tracked externally by the chat hook; SmartMarkdown only renders it.
   */
  velocityStreak?: number;
}

/**
 * Pre-process content to fix common LaTeX issues
 */
function preprocessContent(content: string): string {
  let processed = content;

  // Convert \(...\) to $...$ for inline math
  processed = processed.replace(/\\\(([^)]+)\\\)/g, '$$$1$$');

  // Convert \[...\] to $$...$$ for block math
  processed = processed.replace(/\\\[([^\]]+)\\\]/g, '\n\n$$$$$1$$$$\n\n');

  // Fix escaped dollar signs that should be LaTeX delimiters
  // Sometimes AI outputs \$ instead of $
  processed = processed.replace(/\\\$/g, '$');

  // Ensure proper spacing around block math
  processed = processed.replace(/\$\$([^$]+)\$\$/g, '\n\n$$$$$1$$$$\n\n');

  // Fix common LaTeX escaping issues
  processed = processed.replace(/\\frac\s+/g, '\\frac');
  processed = processed.replace(/\\sqrt\s+/g, '\\sqrt');

  // Clean up excessive newlines
  processed = processed.replace(/\n{4,}/g, '\n\n\n');

  return processed;
}

/**
 * Detect if content looks like an analogy (Socratic personalization)
 */
function isAnalogyContent(children: React.ReactNode): boolean {
  const text = String(children || '').toLowerCase();
  return (
    text.includes('imagina') ||
    text.includes('piensa en') ||
    text.includes('es como') ||
    text.includes('analogía') ||
    text.includes('ejemplo') ||
    text.includes('💡') ||
    text.includes('🤔')
  );
}

/**
 * Custom components for different markdown elements
 */
const createComponents = (variant: SmartMarkdownProps['variant'], compact: boolean) => {
  const isFocusMode = variant === 'focus' || variant === 'lesson';

  return {
    // Headers with proper styling and border-bottom for Focus Mode
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className={`font-bold text-solid ${
        compact ? 'text-xl mb-3' : isFocusMode ? 'text-3xl mb-6' : 'text-2xl mb-4'
      } mt-8 first:mt-0 ${
        isFocusMode ? 'pb-4 border-b border-white/10' : ''
      }`}>
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className={`font-semibold text-solid ${
        compact ? 'text-lg mb-2' : isFocusMode ? 'text-2xl mb-4' : 'text-xl mb-3'
      } mt-6 first:mt-0 ${
        isFocusMode ? 'pb-3 border-b border-white/10' : ''
      }`}>
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className={`font-semibold text-solid ${
        compact ? 'text-base mb-2' : isFocusMode ? 'text-xl mb-3' : 'text-lg mb-2'
      } mt-5 first:mt-0`}>
        {children}
      </h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className={`font-medium text-solid ${
        isFocusMode ? 'text-lg mb-2' : 'text-base mb-2'
      } mt-4 first:mt-0`}>
        {children}
      </h4>
    ),

    // Paragraphs with enhanced vertical rhythm for Focus Mode
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className={`${
        isFocusMode ? 'text-prominent text-base leading-[1.8] mb-6'
          : compact ? 'text-prominent mb-2 text-sm leading-relaxed'
          : 'text-prominent mb-3 leading-relaxed'
      }`}>
        {children}
      </p>
    ),

    // Lists with proper styling
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className={`list-disc ${
        compact ? 'mb-2 ml-2' : isFocusMode ? 'mb-6 ml-6 space-y-3' : 'mb-3 ml-4 space-y-1'
      }`}>
        {children}
      </ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className={`list-decimal ${
        compact ? 'mb-2 ml-2' : isFocusMode ? 'mb-6 ml-6 space-y-3' : 'mb-3 ml-4 space-y-1'
      }`}>
        {children}
      </ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className={`${
        isFocusMode ? 'text-prominent leading-[1.8] pl-2' : 'text-prominent leading-relaxed'
      }`}>
        {children}
      </li>
    ),

    // Code blocks with syntax highlighting
    code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
      const isInline = !className;

      if (isInline) {
        return (
          <code
            className={`px-1.5 py-0.5 rounded ${
              isFocusMode
                ? 'bg-emerald-500/20 text-emerald-600 font-medium'
                : 'bg-white/10 text-emerald-600'
            } text-sm font-mono`}
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <code
          className={`block p-4 rounded-xl bg-black/30 backdrop-blur-sm text-sm font-mono overflow-x-auto ${
            isFocusMode ? 'my-6' : ''
          } ${className || ''}`}
          {...props}
        >
          {children}
        </code>
      );
    },

    // Pre blocks for code
    pre: ({ children }: { children?: React.ReactNode }) => (
      <pre className={`${isFocusMode ? 'mb-6' : 'mb-3'} rounded-xl overflow-hidden`}>
        {children}
      </pre>
    ),

    // Blockquotes - Special "Analogy Boxes" in Focus Mode for Socratic context
    blockquote: ({ children }: { children?: React.ReactNode }) => {
      const isAnalogy = isAnalogyContent(children);

      if (isFocusMode) {
        return (
          <blockquote className={`relative ${
            isAnalogy
              ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border-l-4 border-emerald-400'
              : 'bg-white/10 border-l-4 border-blue-400/50'
          } backdrop-blur-sm rounded-r-xl pl-5 pr-4 py-4 my-6`}>
            {isAnalogy && (
              <div className="absolute -left-px top-3 -translate-x-1/2 w-8 h-8 bg-emerald-500/30 backdrop-blur-sm rounded-full flex items-center justify-center border border-emerald-400/50">
                <span className="text-lg">💡</span>
              </div>
            )}
            <div className={`italic ${isAnalogy ? 'text-emerald-700' : 'text-prominent/90'} leading-[1.7]`}>
              {children}
            </div>
          </blockquote>
        );
      }

      return (
        <blockquote className="border-l-4 border-emerald-400/50 pl-4 py-1 my-3 text-prominent/80 italic">
          {children}
        </blockquote>
      );
    },

    // Horizontal rules
    hr: () => (
      <hr className={`${isFocusMode ? 'my-8' : 'my-4'} border-white/20`} />
    ),

    // Tables
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className={`overflow-x-auto ${isFocusMode ? 'mb-6' : 'mb-3'}`}>
        <table className="min-w-full border-collapse">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => (
      <thead className="bg-white/10">
        {children}
      </thead>
    ),
    tbody: ({ children }: { children?: React.ReactNode }) => (
      <tbody className="divide-y divide-white/10">
        {children}
      </tbody>
    ),
    tr: ({ children }: { children?: React.ReactNode }) => (
      <tr className="hover:bg-white/5 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className={`px-4 py-3 text-left ${
        isFocusMode ? 'text-base' : 'text-sm'
      } font-semibold text-solid`}>
        {children}
      </th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className={`px-4 py-3 ${isFocusMode ? 'text-base' : 'text-sm'} text-prominent`}>
        {children}
      </td>
    ),

    // Links
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a
        href={href}
        className="text-emerald-600 hover:text-emerald-500 underline underline-offset-2 transition-colors"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),

    // Strong/Bold - Primary-colored text glow for key vocabulary in Focus Mode
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className={`font-semibold ${
        isFocusMode
          ? 'text-emerald-600 [text-shadow:0_0_20px_rgba(52,211,153,0.3)]'
          : 'text-solid'
      }`}>
        {children}
      </strong>
    ),

    // Emphasis/Italic
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic text-prominent">
        {children}
      </em>
    ),

    // Images
    img: ({ src, alt }: { src?: string; alt?: string }) => (
      <img
        src={src}
        alt={alt || ''}
        className={`max-w-full h-auto rounded-xl ${isFocusMode ? 'my-6' : 'my-3'} shadow-lg`}
        loading="lazy"
      />
    ),
  };
};

// ── Velocity Streak Badge ────────────────────────────────────────────────────

interface VelocityStreakBadgeProps {
  streak: number;
}

/**
 * Glassmorphism badge that appears once a student has completed 3+ Depth-Checks.
 * - 3–4 completions: "Racha de Velocidad" (amber)
 * - 5+  completions: "Racha de Fuego"     (orange → red gradient)
 */
function VelocityStreakBadge({ streak }: VelocityStreakBadgeProps) {
  const isFire = streak >= 5;

  return (
    <div
      className={`inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full
        backdrop-blur-sm border w-fit select-none
        ${isFire
          ? 'bg-gradient-to-r from-orange-500/25 to-red-500/20 border-orange-400/40'
          : 'bg-gradient-to-r from-amber-500/20 to-yellow-500/15 border-amber-400/35'
        }`}
    >
      <span className="text-sm leading-none" aria-hidden="true">
        {isFire ? '🔥' : '⚡'}
      </span>
      <span
        className={`text-xs font-semibold tracking-wide ${
          isFire ? 'text-orange-500' : 'text-amber-600'
        }`}
      >
        {isFire ? 'Racha de Fuego' : 'Racha de Velocidad'}
        {' · '}
        <span className="tabular-nums">{streak}</span>
      </span>
    </div>
  );
}

// ── SmartMarkdown Component ───────────────────────────────────────────────────

/**
 * SmartMarkdown Component
 * Renders markdown content with full LaTeX support
 */
export function SmartMarkdown({
  content,
  className = '',
  variant = 'default',
  compact = false,
  velocityStreak,
}: SmartMarkdownProps) {
  // Pre-process content to fix common issues
  const processedContent = useMemo(() => preprocessContent(content), [content]);

  // Memoize components based on variant and compact mode
  const components = useMemo(
    () => createComponents(variant, compact),
    [variant, compact]
  );

  // Variant-specific wrapper classes
  const variantClasses = {
    default: '',
    lesson: 'lesson-content',
    homework: 'homework-content',
    chat: 'chat-content text-sm',
    feedback: 'feedback-content',
    focus: 'focus-content',
  };

  const showStreak = velocityStreak !== undefined && velocityStreak >= 3;

  return (
    <div className={`smart-markdown ${variantClasses[variant]} ${className}`}>
      {showStreak && <VelocityStreakBadge streak={velocityStreak} />}
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Inline math component for simple expressions
 */
export function InlineMath({ expression }: { expression: string }) {
  return <SmartMarkdown content={`$${expression}$`} compact />;
}

/**
 * Block math component for equations
 */
export function BlockMath({ expression }: { expression: string }) {
  return <SmartMarkdown content={`$$${expression}$$`} />;
}

export default SmartMarkdown;
