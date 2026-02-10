import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/glass';
import { studentApi } from '@/services/studentApi';
import { PersonalizedHomeworkWithDetails } from '@/types';

export function MyHomework() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [homework, setHomework] = useState<PersonalizedHomeworkWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHomework();
  }, []);

  const loadHomework = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await studentApi.getMyHomework();
      setHomework(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load homework');
    } finally {
      setIsLoading(false);
    }
  };

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
    } else if (diffDays <= 3) {
      return { label: t('student.myHomework.status.dueInDays', { count: diffDays }), color: 'blue' };
    }
    return { label: t('student.myHomework.status.dueOn', { date: due.toLocaleDateString() }), color: 'emerald' };
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
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
          <p className="text-red-200">{error}</p>
          <button
            onClick={loadHomework}
            className="mt-4 px-4 py-2 backdrop-blur-md bg-white/20 border border-white/30 rounded-lg text-solid hover:bg-white/30 transition-all"
          >
            {t('common.tryAgain')}
          </button>
        </GlassCard>
      </div>
    );
  }

  // Separate pending and submitted homework
  const pendingHomework = homework.filter(h => !h.submittedAt);
  const submittedHomework = homework.filter(h => h.submittedAt);

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-solid">{t('student.myHomework.title')}</h1>
          <p className="text-prominent mt-1">
            {t('student.myHomework.subtitle')}
          </p>
        </div>

        {homework.length === 0 ? (
          <GlassCard variant="card" className="p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-prominent mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            <h2 className="text-lg font-semibold text-solid mb-2">{t('student.myHomework.empty.title')}</h2>
            <p className="text-prominent">
              {t('student.myHomework.empty.message')}
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-8">
            {/* Pending Homework */}
            {pendingHomework.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-solid mb-4">
                  {t('student.myHomework.todo', { count: pendingHomework.length })}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingHomework.map((hw, index) => {
                    const dueStatus = getDueStatus(hw.homework.dueDate);
                    return (
                      <motion.div
                        key={hw.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <GlassCard
                          variant="card"
                          hover
                          className="p-5 cursor-pointer"
                          onClick={() => navigate(`/dashboard/student/homework/${hw.id}`)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {hw.homework.subject && (
                                <span className="px-2 py-1 text-xs backdrop-blur-sm bg-blue-500/20 border border-blue-400/30 text-blue-100 rounded-lg capitalize">
                                  {hw.homework.subject}
                                </span>
                              )}
                              {dueStatus && (
                                <span
                                  className={`px-2 py-1 text-xs backdrop-blur-sm rounded-lg ${
                                    dueStatus.color === 'red'
                                      ? 'bg-red-500/20 border border-red-400/30 text-red-100'
                                      : dueStatus.color === 'yellow'
                                        ? 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-100'
                                        : dueStatus.color === 'blue'
                                          ? 'bg-blue-500/20 border border-blue-400/30 text-blue-100'
                                          : 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-100'
                                  }`}
                                >
                                  {dueStatus.label}
                                </span>
                              )}
                            </div>
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
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                          <h3 className="font-semibold text-solid mb-1">{hw.homework.title}</h3>
                          <p className="text-sm text-prominent mb-3">{hw.homework.topic}</p>
                          <div className="flex items-center justify-between text-xs text-subtle">
                            <span>By {hw.homework.teacherName}</span>
                            <span>
                              {new Date(hw.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </GlassCard>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed Homework */}
            {submittedHomework.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-solid mb-4">
                  {t('student.myHomework.completed', { count: submittedHomework.length })}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {submittedHomework.map((hw, index) => (
                    <motion.div
                      key={hw.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <GlassCard
                        variant="card"
                        hover
                        className="p-5 cursor-pointer opacity-75"
                        onClick={() => navigate(`/dashboard/student/homework/${hw.id}`)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {hw.homework.subject && (
                              <span className="px-2 py-1 text-xs backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg capitalize">
                                {hw.homework.subject}
                              </span>
                            )}
                            <span className="px-2 py-1 text-xs backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg">
                              {t('student.myHomework.status.submitted')}
                            </span>
                          </div>
                          <svg
                            className="w-5 h-5 text-emerald-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <h3 className="font-semibold text-solid mb-1">{hw.homework.title}</h3>
                        <p className="text-sm text-prominent">{hw.homework.topic}</p>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
