/**
 * HomeworkQuestionEditor - Single Question Card with Edit Capabilities
 *
 * Features:
 * - Editable question text
 * - Question type dropdown (text, multiple-choice, true-false)
 * - Conditional options editor for choice types
 * - Move up/down/delete buttons
 * - Liquid Glass design system
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/glass';
import { HomeworkQuestionJson } from '@/types';

type QuestionType = 'open' | 'choice';

interface HomeworkQuestionEditorProps {
  question: HomeworkQuestionJson;
  index: number;
  totalQuestions: number;
  onUpdate: (question: HomeworkQuestionJson) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled?: boolean;
}

export function HomeworkQuestionEditor({
  question,
  index,
  totalQuestions,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  disabled = false,
}: HomeworkQuestionEditorProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  const handleTextChange = (text: string) => {
    onUpdate({ ...question, text });
  };

  const handleTypeChange = (type: QuestionType) => {
    const updated: HomeworkQuestionJson = {
      ...question,
      type,
      options: type === 'choice' ? (question.options || ['', '']) : undefined,
    };
    onUpdate(updated);
  };

  const handleOptionChange = (optionIndex: number, value: string) => {
    const options = [...(question.options || [])];
    options[optionIndex] = value;
    onUpdate({ ...question, options });
  };

  const handleAddOption = () => {
    const options = [...(question.options || []), ''];
    onUpdate({ ...question, options });
  };

  const handleRemoveOption = (optionIndex: number) => {
    const options = (question.options || []).filter((_, i) => i !== optionIndex);
    onUpdate({ ...question, options });
  };

  const inputBaseClasses = `
    w-full rounded-xl px-4 py-3
    backdrop-blur-md bg-white/10 border border-white/20
    focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-blue-400/60
    placeholder:text-surface-500 text-solid
    disabled:bg-white/5 disabled:border-white/10 disabled:text-surface-400 disabled:cursor-not-allowed
    transition-all duration-200
  `;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <GlassCard variant="card" className="p-0 overflow-hidden">
        {/* Header - Always visible */}
        <div
          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors ${
            disabled ? 'opacity-60' : ''
          }`}
          onClick={() => !disabled && setIsExpanded(!isExpanded)}
        >
          {/* Drag handle placeholder */}
          <div className="flex flex-col gap-0.5 text-surface-400">
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-current" />
              <div className="w-1 h-1 rounded-full bg-current" />
            </div>
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-current" />
              <div className="w-1 h-1 rounded-full bg-current" />
            </div>
          </div>

          {/* Question number */}
          <div className="w-8 h-8 rounded-lg backdrop-blur-md bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-sm font-semibold text-blue-700">
            {index + 1}
          </div>

          {/* Question preview */}
          <div className="flex-1 min-w-0">
            <p className="text-solid font-medium truncate">
              {question.text || t('homework.editor.untitledQuestion', 'Pregunta sin título')}
            </p>
            <p className="text-xs text-prominent">
              {question.type === 'choice'
                ? t('homework.editor.typeMultipleChoice', 'Opción Múltiple')
                : t('homework.editor.typeText', 'Texto Libre')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              disabled={disabled || index === 0}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={t('common.moveUp', 'Subir')}
            >
              <svg className="w-4 h-4 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              disabled={disabled || index === totalQuestions - 1}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={t('common.moveDown', 'Bajar')}
            >
              <svg className="w-4 h-4 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={disabled}
              className="p-1.5 rounded-lg hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={t('homework.editor.deleteQuestion', 'Eliminar Pregunta')}
            >
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              disabled={disabled}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <svg
                className={`w-4 h-4 text-prominent transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expandable content */}
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4 space-y-4 border-t border-white/10"
          >
            <div className="pt-4">
              {/* Question text */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-prominent mb-1.5">
                  {t('homework.editor.questionText', 'Texto de la pregunta')}
                </label>
                <textarea
                  value={question.text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder={t('homework.editor.questionPlaceholder', 'Escribe la pregunta aquí...')}
                  disabled={disabled}
                  rows={2}
                  className={`${inputBaseClasses} resize-none`}
                />
              </div>

              {/* Question type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-prominent mb-1.5">
                  {t('homework.editor.questionType', 'Tipo de Pregunta')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('open')}
                    disabled={disabled}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm transition-all ${
                      question.type === 'open'
                        ? 'backdrop-blur-md bg-blue-500/30 border border-blue-400/40 text-blue-700'
                        : 'backdrop-blur-md bg-white/10 border border-white/20 text-prominent hover:bg-white/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {t('homework.editor.typeText', 'Texto Libre')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('choice')}
                    disabled={disabled}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm transition-all ${
                      question.type === 'choice'
                        ? 'backdrop-blur-md bg-blue-500/30 border border-blue-400/40 text-blue-700'
                        : 'backdrop-blur-md bg-white/10 border border-white/20 text-prominent hover:bg-white/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {t('homework.editor.typeMultipleChoice', 'Opción Múltiple')}
                  </button>
                </div>
              </div>

              {/* Options for multiple choice */}
              {question.type === 'choice' && (
                <div>
                  <label className="block text-sm font-medium text-prominent mb-1.5">
                    {t('homework.editor.options', 'Opciones')}
                  </label>
                  <div className="space-y-2">
                    {(question.options || []).map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md backdrop-blur-md bg-white/10 border border-white/20 flex items-center justify-center text-xs font-medium text-prominent">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => handleOptionChange(optionIndex, e.target.value)}
                          placeholder={`${t('homework.editor.option', 'Opción')} ${String.fromCharCode(65 + optionIndex)}`}
                          disabled={disabled}
                          className={`${inputBaseClasses} flex-1`}
                        />
                        {(question.options?.length || 0) > 2 && (
                          <button
                            onClick={() => handleRemoveOption(optionIndex)}
                            disabled={disabled}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    {(question.options?.length || 0) < 6 && (
                      <button
                        onClick={handleAddOption}
                        disabled={disabled}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-prominent hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('homework.editor.addOption', 'Agregar Opción')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </GlassCard>
    </motion.div>
  );
}
