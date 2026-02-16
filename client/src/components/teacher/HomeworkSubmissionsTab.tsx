import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton } from '@/components/glass';
import { HomeworkGradingModal } from './HomeworkGradingModal';
import { teacherApi } from '@/services/teacherApi';
import { HomeworkSubmissionWithDetails } from '@/types';

export function HomeworkSubmissionsTab() {
  const { t } = useTranslation();
  const [submissions, setSubmissions] = useState<HomeworkSubmissionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<HomeworkSubmissionWithDetails | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await teacherApi.getPendingSubmissions();
      setSubmissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGraded = (submissionId: string) => {
    // Remove the graded submission from the list
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    setSelectedSubmission(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard variant="card" className="p-4 backdrop-blur-md bg-red-500/20 border-red-400/30">
        <p className="text-red-700">{error}</p>
        <GlassButton variant="secondary" onClick={loadSubmissions} className="mt-2">
          {t('common.tryAgain')}
        </GlassButton>
      </GlassCard>
    );
  }

  if (submissions.length === 0) {
    return (
      <GlassCard variant="card" className="p-8 text-center">
        <svg
          className="w-12 h-12 mx-auto text-prominent mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-solid mb-2">
          {t('teacher.submissions.noSubmissions')}
        </h3>
        <p className="text-prominent">
          {t('teacher.submissions.allGraded')}
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-solid">
          {t('teacher.submissions.title')} ({submissions.length})
        </h2>
        <GlassButton variant="secondary" size="sm" onClick={loadSubmissions}>
          {t('common.refresh')}
        </GlassButton>
      </div>

      {submissions.map((submission, index) => (
        <motion.div
          key={submission.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <GlassCard variant="card" className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 text-xs backdrop-blur-sm bg-blue-500/20 border border-blue-400/30 text-blue-700 rounded-lg">
                    {submission.homeworkSubject || 'General'}
                  </span>
                  <span className="text-sm text-prominent">
                    {new Date(submission.submittedAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-semibold text-solid mb-1">{submission.homeworkTitle}</h3>
                <p className="text-sm text-prominent mb-2">{submission.homeworkTopic}</p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-emerald-700">
                      {submission.studentName.charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm text-solid">{submission.studentName}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 ml-4">
                {submission.aiSuggestedGrade !== undefined && (
                  <div className="text-right">
                    <span className="text-xs text-prominent">{t('teacher.submissions.aiSuggested')}</span>
                    <div className="font-semibold text-blue-700">
                      {submission.aiSuggestedGrade}/100
                    </div>
                  </div>
                )}
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={() => setSelectedSubmission(submission)}
                >
                  {t('teacher.submissions.viewAndGrade')}
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      ))}

      {/* Grading Modal */}
      {selectedSubmission && (
        <HomeworkGradingModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onGraded={handleGraded}
        />
      )}
    </div>
  );
}
