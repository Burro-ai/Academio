import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton } from '@/components/glass';
import { teacherApi } from '@/services/teacherApi';
import { HomeworkSubmissionWithDetails } from '@/types';

interface HomeworkGradingModalProps {
  submission: HomeworkSubmissionWithDetails;
  onClose: () => void;
  onGraded: (submissionId: string) => void;
}

export function HomeworkGradingModal({
  submission,
  onClose,
  onGraded,
}: HomeworkGradingModalProps) {
  const { t } = useTranslation();
  const [grade, setGrade] = useState<number>(submission.aiSuggestedGrade ?? 0);
  const [feedback, setFeedback] = useState(submission.aiSuggestedFeedback || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUseAISuggestion = () => {
    if (submission.aiSuggestedGrade !== undefined) {
      setGrade(submission.aiSuggestedGrade);
    }
    if (submission.aiSuggestedFeedback) {
      setFeedback(submission.aiSuggestedFeedback);
    }
  };

  const handleRegenerateAI = async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      const result = await teacherApi.regenerateAISuggestion(submission.id);
      setGrade(result.aiSuggestedGrade);
      setFeedback(result.aiSuggestedFeedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (grade < 0 || grade > 100) {
      setError(t('grading.gradeError'));
      return;
    }

    if (!feedback.trim()) {
      setError(t('grading.feedbackRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await teacherApi.gradeSubmission(submission.id, grade, feedback);
      onGraded(submission.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <GlassCard variant="elevated" className="overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex-shrink-0 p-6 border-b border-white/15">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs backdrop-blur-sm bg-blue-500/20 border border-blue-400/30 text-blue-100 rounded-lg">
                      {submission.homeworkSubject || 'General'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-solid">{submission.homeworkTitle}</h2>
                  <p className="text-prominent mt-1">{submission.homeworkTopic}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="w-6 h-6 backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-emerald-100">
                        {submission.studentName.charAt(0)}
                      </span>
                    </div>
                    <span className="text-sm text-solid">{submission.studentName}</span>
                    <span className="text-xs text-subtle">
                      {t('grading.submittedAt', { date: new Date(submission.submittedAt).toLocaleString() })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Student Answers */}
              <div>
                <h3 className="font-semibold text-solid mb-4">{t('teacher.submissions.studentAnswers')}</h3>
                <div className="space-y-4">
                  {submission.answers.map((answer, index) => (
                    <GlassCard key={answer.questionId} variant="surface" className="p-4">
                      <p className="text-xs text-prominent mb-2">
                        {t('student.homeworkForm.question', { number: index + 1 })}
                      </p>
                      <p className="text-solid whitespace-pre-wrap">{answer.value || t('grading.noAnswerProvided')}</p>
                    </GlassCard>
                  ))}
                </div>
              </div>

              {/* Right: Grading */}
              <div>
                <h3 className="font-semibold text-solid mb-4">{t('teacher.submissions.grading')}</h3>

                {/* AI Suggestion */}
                {(submission.aiSuggestedGrade !== undefined || submission.aiSuggestedFeedback) && (
                  <GlassCard variant="surface" className="p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-prominent">{t('teacher.submissions.aiSuggested')}</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRegenerateAI}
                          disabled={isRegenerating}
                          className="text-xs px-2 py-1 backdrop-blur-md bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
                        >
                          {isRegenerating ? t('grading.regenerating') : t('grading.regenerate')}
                        </button>
                        <button
                          onClick={handleUseAISuggestion}
                          className="text-xs px-2 py-1 backdrop-blur-md bg-blue-500/30 border border-blue-400/30 text-blue-100 rounded-lg hover:bg-blue-500/40 transition-colors"
                        >
                          {t('teacher.submissions.useAISuggestion')}
                        </button>
                      </div>
                    </div>
                    {submission.aiSuggestedGrade !== undefined && (
                      <p className="text-sm mb-2">
                        <span className="text-prominent">{t('grading.gradeLabel')} </span>
                        <span className="font-semibold text-solid">{submission.aiSuggestedGrade}/100</span>
                      </p>
                    )}
                    {submission.aiSuggestedFeedback && (
                      <p className="text-sm text-prominent">{submission.aiSuggestedFeedback}</p>
                    )}
                  </GlassCard>
                )}

                {/* Grade Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-prominent mb-2">
                    {t('teacher.submissions.yourGrade')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={grade}
                      onChange={(e) => setGrade(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      className="w-24 rounded-xl px-4 py-3
                                 backdrop-blur-md bg-white/15 border border-white/20
                                 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40
                                 text-solid text-center text-lg font-semibold"
                    />
                    <span className="text-prominent">/ 100</span>
                  </div>
                </div>

                {/* Feedback Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-prominent mb-2">
                    {t('teacher.submissions.yourFeedback')}
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={5}
                    placeholder={t('teacher.submissions.feedbackPlaceholder')}
                    className="w-full resize-none rounded-xl px-4 py-3
                               backdrop-blur-md bg-white/15 border border-white/20
                               focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40
                               placeholder:text-surface-500/70 text-solid"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 mb-4 backdrop-blur-md bg-red-500/20 border border-red-400/30 text-red-100 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <GlassButton
                  variant="primary"
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t('grading.submitting')}
                    </span>
                  ) : (
                    t('teacher.submissions.submitGrade')
                  )}
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
