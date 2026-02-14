import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton } from '@/components/glass';
import { HomeworkQuestionCard } from './HomeworkQuestionCard';
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
  }, [homeworkId]);

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
  });

  const handleBack = () => {
    navigate('/dashboard/student');
  };

  const handleSubmit = async () => {
    await submitHomework();
  };

  if (isLoadingHomework) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400" />
      </div>
    );
  }

  if (loadError || !homework) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <GlassCard variant="card" className="p-6 text-center max-w-md">
          <svg
            className="w-12 h-12 mx-auto text-red-400 mb-4"
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
          <p className="text-red-200 mb-4">{loadError || t('errors.homeworkNotFound')}</p>
          <GlassButton variant="secondary" onClick={handleBack}>
            {t('common.goBack')}
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  const getDueStatus = (dueDate?: string) => {
    if (!dueDate) return null;

    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: t('student.myHomework.status.overdue'), color: 'red' };
    } else if (diffDays === 0) {
      return { label: t('student.myHomework.status.dueToday'), color: 'yellow' };
    } else if (diffDays === 1) {
      return { label: t('student.myHomework.status.dueTomorrow'), color: 'yellow' };
    }
    return { label: due.toLocaleDateString(), color: 'emerald' };
  };

  const dueStatus = getDueStatus(homework.homework.dueDate);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 backdrop-blur-xl bg-white/10 border-b border-white/15">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
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
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-solid">{homework.homework.title}</h1>
            <div className="flex items-center gap-2">
              {homework.homework.subject && (
                <span className="px-2 py-0.5 text-xs backdrop-blur-sm bg-blue-500/20 border border-blue-400/30 text-blue-100 rounded-lg capitalize">
                  {homework.homework.subject}
                </span>
              )}
              {dueStatus && (
                <span
                  className={`px-2 py-0.5 text-xs backdrop-blur-sm rounded-lg ${
                    dueStatus.color === 'red'
                      ? 'bg-red-500/20 border border-red-400/30 text-red-100'
                      : dueStatus.color === 'yellow'
                        ? 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-100'
                        : 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-100'
                  }`}
                >
                  {dueStatus.label}
                </span>
              )}
              {isSubmitted && (
                <span className="px-2 py-0.5 text-xs backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg">
                  {t('student.homeworkForm.submitted')}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Homework Content Card */}
          <GlassCard variant="surface" className="p-4">
            <h2 className="text-sm font-medium text-prominent mb-2">
              {t('student.homeworkForm.instructions')}
            </h2>
            <div className="prose prose-invert prose-sm max-w-none">
              <div
                className="text-solid text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: homework.personalizedContent.replace(/\n/g, '<br>'),
                }}
              />
            </div>
          </GlassCard>

          {/* Grading Results (if submitted and graded) */}
          {isSubmitted && existingSubmission?.grade !== undefined && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <GlassCard variant="card" className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${
                      existingSubmission.grade >= 70
                        ? 'backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 text-emerald-100'
                        : existingSubmission.grade >= 50
                          ? 'backdrop-blur-md bg-yellow-500/30 border border-yellow-400/30 text-yellow-100'
                          : 'backdrop-blur-md bg-red-500/30 border border-red-400/30 text-red-100'
                    }`}
                  >
                    {existingSubmission.grade}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-solid">
                      {t('student.homeworkForm.gradeReceived')}
                    </h3>
                    <p className="text-sm text-prominent">
                      {t('student.homeworkForm.gradedAt', {
                        date: new Date(existingSubmission.gradedAt || '').toLocaleDateString(),
                      })}
                    </p>
                  </div>
                </div>
                {existingSubmission.feedback && (
                  <div className="mt-4 p-4 backdrop-blur-md bg-white/10 rounded-lg">
                    <h4 className="text-sm font-medium text-prominent mb-2">
                      {t('student.homeworkForm.feedback')}
                    </h4>
                    <p className="text-solid">{existingSubmission.feedback}</p>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* Awaiting Grade Notice */}
          {isSubmitted && !existingSubmission?.grade && (
            <GlassCard variant="surface" className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-prominent">
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
                <span>{t('student.homeworkForm.awaitingGrade')}</span>
              </div>
            </GlassCard>
          )}

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-solid">
                {t('student.homeworkForm.questions')}
              </h2>
              <span className="text-sm text-prominent">
                {t('student.homeworkForm.progress', {
                  answered: answeredCount,
                  total: totalCount,
                })}
              </span>
            </div>

            {questions.map((question, index) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <HomeworkQuestionCard
                  question={question}
                  questionNumber={index + 1}
                  value={answers[question.id] || ''}
                  onChange={(value) => updateAnswer(question.id, value)}
                  disabled={isSubmitted}
                />
              </motion.div>
            ))}
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="p-4 backdrop-blur-md bg-red-500/20 border border-red-400/30 text-red-100 rounded-lg">
              {submitError}
            </div>
          )}

          {/* Submit Button */}
          {!isSubmitted && (
            <div className="flex justify-end pt-4">
              <GlassButton
                variant="primary"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || answeredCount === 0}
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
                  t('student.homeworkForm.submitHomework')
                )}
              </GlassButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
