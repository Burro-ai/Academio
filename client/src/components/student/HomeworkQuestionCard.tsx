/**
 * HomeworkQuestionCard - Focus Mode Question Card
 *
 * An enhanced question card with:
 * - Distinct GlassCard surfaces
 * - Primary-colored focus rings on inputs
 * - Visual progress indicators
 * - Smooth animations
 * - Liquid Glass design system
 */

import { useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/glass';
import { HomeworkQuestion } from '@/types';

interface HomeworkQuestionCardProps {
  question: HomeworkQuestion;
  questionNumber: number;
  totalQuestions?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isAnswered?: boolean;
}

export function HomeworkQuestionCard({
  question,
  questionNumber,
  totalQuestions,
  value,
  onChange,
  disabled = false,
  isAnswered = false,
}: HomeworkQuestionCardProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && question.type === 'textarea') {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value, question.type]);

  // Base input classes with primary focus ring
  const inputBaseClasses = `
    w-full rounded-xl px-4 py-3.5
    backdrop-blur-md bg-white/15 border border-white/20
    focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/60
    placeholder:text-white/40 text-solid
    disabled:bg-white/5 disabled:border-white/10 disabled:text-white/50 disabled:cursor-not-allowed
    transition-all duration-200
  `;

  return (
    <GlassCard
      variant="elevated"
      blur="xl"
      className={`relative overflow-hidden transition-all duration-300 ${
        isAnswered ? 'ring-2 ring-emerald-400/30' : ''
      }`}
    >
      {/* Progress indicator on left edge */}
      <motion.div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          isAnswered
            ? 'bg-gradient-to-b from-emerald-400 to-blue-400'
            : 'bg-white/10'
        }`}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Answered checkmark overlay */}
      {isAnswered && !disabled && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-4 right-4 w-6 h-6 backdrop-blur-md bg-emerald-500/30 border border-emerald-400/50 rounded-full flex items-center justify-center"
        >
          <svg className="w-3.5 h-3.5 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}

      <div className="p-6 lg:p-8">
        <div className="flex items-start gap-4">
          {/* Question Number Badge */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-semibold transition-all duration-300 ${
            isAnswered
              ? 'backdrop-blur-md bg-gradient-to-br from-emerald-500/40 to-blue-500/40 border border-emerald-400/50 text-emerald-100'
              : 'backdrop-blur-md bg-white/15 border border-white/20 text-prominent'
          }`}>
            {questionNumber}
          </div>

          <div className="flex-1 min-w-0">
            {/* Question Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-solid font-medium text-lg leading-relaxed pr-8">
                {question.text}
              </p>
            </div>

            {/* Question Meta */}
            {totalQuestions && (
              <p className="text-xs text-prominent/60 mb-4">
                {t('student.homeworkForm.questionOf', { current: questionNumber, total: totalQuestions })}
              </p>
            )}

            {/* Input Field */}
            <div className="relative">
              {question.type === 'textarea' ? (
                <div className="relative group">
                  <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={t('student.homeworkForm.yourAnswer')}
                    disabled={disabled}
                    rows={4}
                    className={`${inputBaseClasses} resize-none min-h-[120px]`}
                  />
                  {/* Character count */}
                  <div className="absolute bottom-3 right-3 text-xs text-white/30">
                    {value.length > 0 && `${value.length} ${t('student.homeworkForm.characters')}`}
                  </div>
                </div>
              ) : question.type === 'number' ? (
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={t('student.homeworkForm.enterNumber')}
                    disabled={disabled}
                    className={inputBaseClasses}
                  />
                  {/* Number icon */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={t('student.homeworkForm.yourAnswer')}
                  disabled={disabled}
                  className={inputBaseClasses}
                />
              )}

              {/* Focus glow effect */}
              <div className="absolute inset-0 -z-10 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-0 rounded-xl bg-emerald-500/10 blur-xl" />
              </div>
            </div>

            {/* Helper text for unanswered */}
            {!value && !disabled && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-xs text-white/40 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('student.homeworkForm.answerHint')}
              </motion.p>
            )}
          </div>
        </div>
      </div>

      {/* Decorative corner gradient */}
      <div className={`absolute -bottom-8 -right-8 w-24 h-24 rounded-full blur-2xl transition-opacity duration-300 ${
        isAnswered ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20" />
      </div>
    </GlassCard>
  );
}
