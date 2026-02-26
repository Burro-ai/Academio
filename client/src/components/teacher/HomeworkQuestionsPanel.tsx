/**
 * HomeworkQuestionsPanel - Container for Editable Homework Questions
 *
 * Features:
 * - Container for all question editors
 * - Add Question button
 * - Save Draft and Assign to Students buttons
 * - State management for editing vs assigned
 * - Liquid Glass design system
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton } from '@/components/glass';
import { HomeworkQuestionEditor } from './HomeworkQuestionEditor';
import { HomeworkQuestionJson } from '@/types';

interface HomeworkQuestionsPanelProps {
  questions: HomeworkQuestionJson[];
  onQuestionsChange: (questions: HomeworkQuestionJson[]) => void;
  onSaveDraft: () => Promise<void>;
  onAssign: () => Promise<void>;
  isAssigned?: boolean;
  isSaving?: boolean;
  isAssigning?: boolean;
  personalizedCount?: number;
}

export function HomeworkQuestionsPanel({
  questions,
  onQuestionsChange,
  onSaveDraft,
  onAssign,
  isAssigned = false,
  isSaving = false,
  isAssigning = false,
  personalizedCount = 0,
}: HomeworkQuestionsPanelProps) {
  const { t } = useTranslation();
  const [showConfirmAssign, setShowConfirmAssign] = useState(false);

  const handleUpdateQuestion = useCallback(
    (index: number, question: HomeworkQuestionJson) => {
      const newQuestions = [...questions];
      newQuestions[index] = question;
      onQuestionsChange(newQuestions);
    },
    [questions, onQuestionsChange]
  );

  const handleDeleteQuestion = useCallback(
    (index: number) => {
      const newQuestions = questions.filter((_, i) => i !== index);
      // Re-assign IDs to maintain order
      const reIndexed = newQuestions.map((q, i) => ({ ...q, id: i + 1 }));
      onQuestionsChange(reIndexed);
    },
    [questions, onQuestionsChange]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newQuestions = [...questions];
      [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
      // Re-assign IDs
      const reIndexed = newQuestions.map((q, i) => ({ ...q, id: i + 1 }));
      onQuestionsChange(reIndexed);
    },
    [questions, onQuestionsChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === questions.length - 1) return;
      const newQuestions = [...questions];
      [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
      // Re-assign IDs
      const reIndexed = newQuestions.map((q, i) => ({ ...q, id: i + 1 }));
      onQuestionsChange(reIndexed);
    },
    [questions, onQuestionsChange]
  );

  const handleAddQuestion = useCallback(() => {
    const newQuestion: HomeworkQuestionJson = {
      id: questions.length + 1,
      text: '',
      type: 'open',
    };
    onQuestionsChange([...questions, newQuestion]);
  }, [questions, onQuestionsChange]);

  const handleAssignClick = () => {
    if (questions.length === 0) {
      return;
    }
    setShowConfirmAssign(true);
  };

  const handleConfirmAssign = async () => {
    setShowConfirmAssign(false);
    await onAssign();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-solid">
            {t('homework.editor.questionsTitle', 'Preguntas')} ({questions.length})
          </h2>
          {isAssigned && (
            <span className="px-2 py-1 text-xs font-medium backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-700 rounded-lg flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {t('homework.editor.questionsLocked', 'Bloqueadas')}
            </span>
          )}
        </div>
        {!isAssigned && (
          <GlassButton variant="default" size="sm" onClick={handleAddQuestion}>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('homework.editor.addQuestion', 'Agregar Pregunta')}
          </GlassButton>
        )}
      </div>

      {/* Assigned notice */}
      {isAssigned && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 backdrop-blur-md bg-emerald-500/10 border border-emerald-400/30 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg backdrop-blur-md bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-emerald-700">
                {t('homework.editor.assigned', 'Tarea asignada')}
              </p>
              <p className="text-sm text-emerald-600">
                {t('homework.editor.assignedDescription', 'Asignada a {{count}} estudiantes. Las preguntas ya no pueden ser modificadas.', { count: personalizedCount })}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Questions list */}
      <AnimatePresence>
        {questions.length > 0 ? (
          <div className="space-y-3">
            {questions.map((question, index) => (
              <HomeworkQuestionEditor
                key={question.id}
                question={question}
                index={index}
                totalQuestions={questions.length}
                onUpdate={(q) => handleUpdateQuestion(index, q)}
                onDelete={() => handleDeleteQuestion(index)}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                disabled={isAssigned}
              />
            ))}
          </div>
        ) : (
          <GlassCard variant="surface" className="p-8 text-center">
            <svg
              className="w-12 h-12 mx-auto text-surface-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-prominent mb-4">
              {t('homework.editor.noQuestions', 'Aún no hay preguntas')}
            </p>
            <GlassButton variant="primary" onClick={handleAddQuestion}>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('homework.editor.addFirstQuestion', 'Agregar primera pregunta')}
            </GlassButton>
          </GlassCard>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {!isAssigned && questions.length > 0 && (
        <div className="flex justify-end gap-3 pt-4">
          <GlassButton
            variant="default"
            onClick={onSaveDraft}
            disabled={isSaving || isAssigning}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('common.saving', 'Guardando...')}
              </span>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {t('homework.editor.saveDraft', 'Guardar Borrador')}
              </>
            )}
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={handleAssignClick}
            disabled={isSaving || isAssigning || questions.length === 0}
          >
            {isAssigning ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('homework.editor.assigning', 'Asignando...')}
              </span>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {t('homework.editor.assignToStudents', 'Asignar a Estudiantes')}
              </>
            )}
          </GlassButton>
        </div>
      )}

      {/* Confirm assign modal */}
      <AnimatePresence>
        {showConfirmAssign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowConfirmAssign(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard variant="elevated" className="p-6 max-w-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl backdrop-blur-md bg-yellow-500/20 border border-yellow-400/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-solid">
                      {t('homework.editor.confirmAssignTitle', '¿Asignar tarea?')}
                    </h3>
                  </div>
                </div>
                <p className="text-prominent mb-6">
                  {t('homework.editor.confirmAssignMessage', 'Una vez asignada, las preguntas quedarán bloqueadas y no podrán ser modificadas. Los estudiantes podrán comenzar a trabajar en esta tarea.')}
                </p>
                <div className="flex justify-end gap-3">
                  <GlassButton variant="default" onClick={() => setShowConfirmAssign(false)}>
                    {t('common.cancel', 'Cancelar')}
                  </GlassButton>
                  <GlassButton variant="primary" onClick={handleConfirmAssign}>
                    {t('homework.editor.confirmAssign', 'Sí, asignar')}
                  </GlassButton>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
