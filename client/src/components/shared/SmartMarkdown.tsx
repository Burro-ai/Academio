/**
 * SmartMarkdown - Universal Markdown Renderer with LaTeX Support
 *
 * This component renders formatted content from the AI Gatekeeper with:
 * - Full LaTeX/KaTeX math rendering ($...$ and $$...$$)
 * - Proper syntax highlighting for code blocks
 * - Clean markdown formatting (headers, lists, tables)
 * - Responsive styling with glass design system
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
  variant?: 'default' | 'lesson' | 'homework' | 'chat' | 'feedback';
  compact?: boolean;
}

/**
 * Pre-process content to fix common LaTeX issues
 */
function preprocessContent(content: string): string {
  let processed = content;

  // Fix escaped dollar signs that should be LaTeX delimiters
  // Sometimes AI outputs \$ instead of $
  processed = processed.replace(/\\\$/g, '$');

  // Ensure proper spacing around block math
  processed = processed.replace(/\$\$([^$]+)\$\$/g, '\n\n$$$$1$$\n\n');

  // Fix common LaTeX escaping issues
  processed = processed.replace(/\\frac\s+/g, '\\frac');
  processed = processed.replace(/\\sqrt\s+/g, '\\sqrt');

  return processed;
}

/**
 * Custom components for different markdown elements
 */
const createComponents = (_variant: SmartMarkdownProps['variant'], compact: boolean) => ({
  // Headers with proper styling
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className={`font-bold text-solid ${compact ? 'text-xl mb-3' : 'text-2xl mb-4'} mt-6 first:mt-0`}>
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className={`font-semibold text-solid ${compact ? 'text-lg mb-2' : 'text-xl mb-3'} mt-5 first:mt-0`}>
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className={`font-semibold text-solid ${compact ? 'text-base mb-2' : 'text-lg mb-2'} mt-4 first:mt-0`}>
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="font-medium text-solid text-base mb-2 mt-3 first:mt-0">
      {children}
    </h4>
  ),

  // Paragraphs
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className={`text-prominent ${compact ? 'mb-2 text-sm' : 'mb-3'} leading-relaxed`}>
      {children}
    </p>
  ),

  // Lists with proper styling
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className={`list-disc list-inside ${compact ? 'mb-2 ml-2' : 'mb-3 ml-4'} space-y-1`}>
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className={`list-decimal list-inside ${compact ? 'mb-2 ml-2' : 'mb-3 ml-4'} space-y-1`}>
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-prominent leading-relaxed">
      {children}
    </li>
  ),

  // Code blocks with syntax highlighting
  code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className;

    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-white/10 text-emerald-300 text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <code
        className={`block p-3 rounded-lg bg-black/30 backdrop-blur-sm text-sm font-mono overflow-x-auto ${className || ''}`}
        {...props}
      >
        {children}
      </code>
    );
  },

  // Pre blocks for code
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-3 rounded-lg overflow-hidden">
      {children}
    </pre>
  ),

  // Blockquotes
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-emerald-400/50 pl-4 py-1 my-3 text-prominent/80 italic">
      {children}
    </blockquote>
  ),

  // Horizontal rules
  hr: () => (
    <hr className="my-4 border-white/20" />
  ),

  // Tables
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto mb-3">
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
    <tr className="hover:bg-white/5">
      {children}
    </tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left text-sm font-semibold text-solid">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 text-sm text-prominent">
      {children}
    </td>
  ),

  // Links
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),

  // Strong/Bold
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-solid">
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
      className="max-w-full h-auto rounded-lg my-3"
      loading="lazy"
    />
  ),
});

/**
 * SmartMarkdown Component
 * Renders markdown content with full LaTeX support
 */
export function SmartMarkdown({
  content,
  className = '',
  variant = 'default',
  compact = false,
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
  };

  return (
    <div className={`smart-markdown ${variantClasses[variant]} ${className}`}>
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
