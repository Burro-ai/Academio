/**
 * HomeworkFormContainer - Focus Mode Homework Viewer
 *
 * A full-screen immersive homework experience with:
 * - Centered single-column Question Stack (max-width 800px)
 * - Visual progress bar as questions are answered
 * - Enhanced GlassCard surfaces for questions
 * - Liquid Glass design system
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton } from '@/components/glass';
import { HomeworkQuestionCard } from './HomeworkQuestionCard';
import { SmartMarkdown } from '@/components/shared/SmartMarkdown';
import { useHomeworkForm } from '@/hooks/useHomeworkForm';
import { studentApi } from '@/services/studentApi';
import { PersonalizedHomeworkWithDetails } from '@/types';

export function HomeworkFormContainer() {
  const { id: homeworkId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [homework, setHomework] = useState<PersonalizedHomeworkWithDetails | null>(null);
  const [isLoadingHomework, setIsLoadingHomework] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  // Load homework data
  useEffect(() => {
    const loadHomework = async () => {
      if (!homeworkId) return;

      setIsLoadingHomework(true);
      setLoadError(null);

      try {
        const allHomework = await studentApi.getMyHomework();
        const found = allHomework.find((h) => h.id === homeworkId);
        if (!found) {
          throw new Error(t('errors.homeworkNotFound'));
        }
        setHomework(found);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : t('errors.failedToLoad'));
      } finally {
        setIsLoadingHomework(false);
      }
    };

    loadHomework();
  }, [homeworkId, t]);

  const {
    questions,
    answers,
    answeredCount,
    totalCount,
    isSubmitting,
    isSubmitted,
    existingSubmission,
    error: submitError,
    updateAnswer,
    submitHomework,
  } = useHomeworkForm({
    personalizedHomeworkId: homeworkId || '',
    content: homework?.personalizedContent || '',
    // Use structured JSON questions if available (prioritized over regex parsing)
    questionsJson: homework?.questionsJson || homework?.homework?.questionsJson,
  });

  const handleBack = () => {
    navigate('/dashboard/student');
  };

  const handleSubmit = async () => {
    await submitHomework();
  };

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.round((answeredCount / totalCount) * 100);
  }, [answeredCount, totalCount]);

  const getDueStatus = (dueDate?: string) => {
    if (!dueDate) return null;

    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: t('student.myHomework.status.overdue'), color: 'red', urgent: true };
    } else if (diffDays === 0) {
      return { label: t('student.myHomework.status.dueToday'), color: 'yellow', urgent: true };
    } else if (diffDays === 1) {
      return { label: t('student.myHomework.status.dueTomorrow'), color: 'yellow', urgent: false };
    }
    return { label: due.toLocaleDateString(), color: 'emerald', urgent: false };
  };

  const dueStatus = homework ? getDueStatus(homework.homework.dueDate) : null;

  if (isLoadingHomework) {
    return (
      <div className="h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 backdrop-blur-xl bg-white/20 border border-white/30 rounded-2xl flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
          </div>
          <p className="text-prominent text-lg">{t('common.loading')}</p>
        </motion.div>
      </div>
    );
  }

  if (loadError || !homework) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <GlassCard variant="elevated" className="p-8 text-center max-w-md">
          <svg
            className="w-16 h-16 mx-auto text-red-400 mb-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-red-600 text-lg mb-6">{loadError || t('errors.homeworkNotFound')}</p>
          <GlassButton variant="secondary" size="lg" onClick={handleBack}>
            {t('common.goBack')}
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col"
    >
      {/* Header with Progress Bar */}
      <header className="flex-shrink-0 backdrop-blur-2xl bg-white/10 border-b border-white/15 z-10">
        {/* Progress Bar */}
        <div className="h-1 bg-white/10">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        <div className="px-4 py-3">
          <div className="max-w-[800px] mx-auto flex items-center gap-4">
            <motion.button
              onClick={handleBack}
              className="p-2.5 hover:bg-white/15 rounded-xl transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                className="w-5 h-5 text-prominent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </motion.button>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-solid truncate">{homework.homework.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {homework.homework.subject && (
                  <span className="px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm bg-blue-500/25 border border-blue-400/40 text-blue-700 rounded-lg capitalize">
                    {homework.homework.subject}
                  </span>
                )}
                {dueStatus && (
                  <span
                    className={`px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm rounded-lg ${
                      dueStatus.color === 'red'
                        ? 'bg-red-500/25 border border-red-400/40 text-red-700'
                        : dueStatus.color === 'yellow'
                          ? 'bg-yellow-500/25 border border-yellow-400/40 text-yellow-700'
                          : 'bg-emerald-500/25 border border-emerald-400/40 text-emerald-700'
                    } ${dueStatus.urgent ? 'animate-pulse' : ''}`}
                  >
                    {dueStatus.label}
                  </span>
                )}
                {isSubmitted && (
                  <span className="px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm bg-emerald-500/25 border border-emerald-400/40 text-emerald-700 rounded-lg flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('student.homeworkForm.submitted')}
                  </span>
                )}
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-prominent">{t('student.homeworkForm.progress', { answered: answeredCount, total: totalCount })}</p>
                <p className="text-lg font-semibold text-solid">{progressPercentage}%</p>
              </div>
              <div className="w-12 h-12 relative">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="4"
                  />
                  <motion.circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - progressPercentage / 100) }}
                    transition={{ duration: 0.3 }}
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Centered Single Column */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-[800px] mx-auto space-y-8">
          {/* Instructions Card (Collapsible) */}
          <AnimatePresence>
            {showInstructions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <GlassCard variant="elevated" blur="xl" className="p-6 lg:p-8 relative overflow-hidden">
                  {/* Decorative gradient */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-2xl" />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 backdrop-blur-md bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-blue-400/40 rounded-xl flex items-center justify-center">
                          <span className="text-xl">📋</span>
                        </div>
                        <h2 className="text-lg font-semibold text-solid">
                          {t('student.homeworkForm.instructions')}
                        </h2>
                      </div>
                      <button
                        onClick={() => setShowInstructions(false)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <SmartMarkdown
                      content={homework.personalizedContent}
                      variant="homework"
                      className="text-prominent"
                    />
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Show Instructions Button (when collapsed) */}
          {!showInstructions && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowInstructions(true)}
              className="w-full px-4 py-3 backdrop-blur-md bg-white/10 border border-white/15 rounded-xl text-sm text-prominent hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {t('student.homeworkForm.showInstructions')}
            </motion.button>
          )}

          {/* Grading Results (if submitted and graded) */}
          <AnimatePresence>
            {isSubmitted && existingSubmission?.grade !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <GlassCard variant="elevated" blur="xl" className="p-6 lg:p-8">
                  <div className="flex items-center gap-6">
                    <div
                      className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                        existingSubmission.grade >= 70
                          ? 'backdrop-blur-md bg-gradient-to-br from-emerald-500/30 to-green-500/30 border border-emerald-400/40 text-emerald-700'
                          : existingSubmission.grade >= 50
                            ? 'backdrop-blur-md bg-gradient-to-br from-yellow-500/30 to-amber-500/30 border border-yellow-400/40 text-yellow-700'
                            : 'backdrop-blur-md bg-gradient-to-br from-red-500/30 to-rose-500/30 border border-red-400/40 text-red-700'
                      }`}
                    >
                      {existingSubmission.grade}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-solid">
                        {t('student.homeworkForm.gradeReceived')}
                      </h3>
                      <p className="text-sm text-prominent mt-1">
                        {t('student.homeworkForm.gradedAt', {
                          date: new Date(existingSubmission.gradedAt || '').toLocaleDateString(),
                        })}
                      </p>
                    </div>
                  </div>

                  {existingSubmission.feedback && (
                    <div className="mt-6 p-4 backdrop-blur-md bg-white/10 rounded-xl border border-white/10">
                      <h4 className="text-sm font-medium text-prominent mb-2 flex items-center gap-2">
                        <span>💬</span>
                        {t('student.homeworkForm.feedback')}
                      </h4>
                      <SmartMarkdown
                        content={existingSubmission.feedback}
                        variant="feedback"
                        className="text-solid"
                      />
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Awaiting Grade Notice */}
          {isSubmitted && !existingSubmission?.grade && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <GlassCard variant="surface" className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 text-prominent">
                  <div className="w-10 h-10 backdrop-blur-md bg-blue-500/20 border border-blue-400/30 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-5 h-5 animate-spin text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-solid">{t('student.homeworkForm.awaitingGrade')}</p>
                    <p className="text-sm text-prominent">{t('student.homeworkForm.awaitingGradeDescription')}</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Questions Stack */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-solid flex items-center gap-2">
                <span>📝</span>
                {t('student.homeworkForm.questions')}
              </h2>
              <span className="text-sm text-prominent px-3 py-1 backdrop-blur-sm bg-white/10 rounded-lg">
                {answeredCount} / {totalCount}
              </span>
            </div>

            {questions.map((question, index) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.4 }}
              >
                <HomeworkQuestionCard
                  question={question}
                  questionNumber={index + 1}
                  totalQuestions={totalCount}
                  value={answers[question.id] || ''}
                  onChange={(value) => updateAnswer(question.id, value)}
                  disabled={isSubmitted}
                  isAnswered={!!answers[question.id]?.trim()}
                />
              </motion.div>
            ))}
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-4 backdrop-blur-md bg-red-500/20 border border-red-400/40 text-red-700 rounded-xl flex items-center gap-3"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {submitError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          {!isSubmitted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row justify-end gap-4 pt-4"
            >
              <div className="flex-1 sm:flex-initial">
                <GlassButton
                  variant="primary"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={isSubmitting || answeredCount === 0}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 animate-spin"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      {t('student.homeworkForm.submitting')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('student.homeworkForm.submitHomework')}
                    </span>
                  )}
                </GlassButton>
              </div>
            </motion.div>
          )}

          {/* Bottom Spacing */}
          <div className="h-8" />
        </div>
      </div>
    </motion.div>
  );
}
