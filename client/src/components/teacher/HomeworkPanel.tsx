import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton } from '@/components/glass';
import { HomeworkCreator } from './HomeworkCreator';
import { HomeworkSubmissionsTab } from './HomeworkSubmissionsTab';
import { lessonApi } from '@/services/lessonApi';
import { HomeworkWithTeacher } from '@/types';

type Tab = 'assignments' | 'submissions';

export function HomeworkPanel() {
  const { t } = useTranslation();
  const [homework, setHomework] = useState<HomeworkWithTeacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<HomeworkWithTeacher | null>(null);
  const [isPersonalizing, setIsPersonalizing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('assignments');

  useEffect(() => {
    loadHomework();
  }, []);

  const loadHomework = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await lessonApi.getHomework();
      setHomework(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('panels.homework.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonalize = async (homeworkId: string) => {
    setIsPersonalizing(homeworkId);

    try {
      const result = await lessonApi.personalizeHomework(homeworkId);
      await loadHomework();
      alert(t('panels.homework.personalizedSuccess', { count: result.count }));
    } catch (err) {
      alert(err instanceof Error ? err.message : t('panels.homework.failedToPersonalize'));
    } finally {
      setIsPersonalizing(null);
    }
  };

  const handleDelete = async (homeworkId: string) => {
    if (!confirm(t('panels.homework.confirmDelete'))) return;

    try {
      await lessonApi.deleteHomework(homeworkId);
      setHomework((prev) => prev.filter((h) => h.id !== homeworkId));
    } catch (err) {
      alert(err instanceof Error ? err.message : t('panels.homework.failedToDelete'));
    }
  };

  const handleHomeworkCreated = (hw: HomeworkWithTeacher) => {
    setHomework((prev) => [hw, ...prev]);
    setShowCreator(false);
  };

  const getDueStatus = (dueDate?: string) => {
    if (!dueDate) return null;

    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: t('panels.homework.dueStatus.pastDue'), color: 'red' };
    if (diffDays <= 3) return { label: t('panels.homework.dueStatus.daysLeft', { count: diffDays }), color: 'yellow' };
    return { label: due.toLocaleDateString(), color: 'emerald' };
  };

  if (showCreator) {
    return (
      <HomeworkCreator
        onBack={() => setShowCreator(false)}
        onCreated={handleHomeworkCreated}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-solid">{t('panels.homework.title')}</h1>
            <p className="text-prominent mt-1">
              {t('panels.homework.subtitle')}
            </p>
          </div>
          <GlassButton variant="primary" onClick={() => setShowCreator(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('panels.homework.createButton')}
          </GlassButton>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'assignments'
                ? 'backdrop-blur-md bg-blue-500/30 border border-blue-400/30 text-blue-700'
                : 'text-prominent hover:backdrop-blur-md hover:bg-white/20'
            }`}
          >
            {t('teacher.homework.assignmentsTab')}
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'submissions'
                ? 'backdrop-blur-md bg-blue-500/30 border border-blue-400/30 text-blue-700'
                : 'text-prominent hover:backdrop-blur-md hover:bg-white/20'
            }`}
          >
            {t('teacher.homework.submissionsTab')}
          </button>
        </div>

        {/* Submissions Tab Content */}
        {activeTab === 'submissions' && <HomeworkSubmissionsTab />}

        {/* Assignments Tab Content */}
        {activeTab === 'assignments' && (
          <>
            {/* Error */}
            {error && (
              <GlassCard variant="card" className="p-4 mb-6 backdrop-blur-md bg-red-500/20 border-red-400/30">
                <p className="text-red-700">{error}</p>
              </GlassCard>
            )}

            {/* Loading */}
            {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400" />
          </div>
        ) : homework.length === 0 ? (
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
            <h2 className="text-lg font-semibold text-solid mb-2">{t('panels.homework.empty.title')}</h2>
            <p className="text-prominent mb-4">
              {t('panels.homework.empty.message')}
            </p>
            <GlassButton variant="primary" onClick={() => setShowCreator(true)}>
              {t('panels.homework.empty.createFirst')}
            </GlassButton>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {homework.map((hw, index) => {
              const dueStatus = getDueStatus(hw.dueDate);
              return (
                <motion.div
                  key={hw.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <GlassCard variant="card" className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {hw.subject && (
                            <span className="px-2 py-1 text-xs backdrop-blur-sm bg-blue-500/20 border border-blue-400/30 text-blue-700 rounded-lg capitalize">
                              {hw.subject}
                            </span>
                          )}
                          <span className="px-2 py-1 text-xs backdrop-blur-sm bg-white/10 border border-white/20 rounded-lg">
                            {hw.personalizedCount || 0} {t('panels.homework.students')}
                          </span>
                          {dueStatus && (
                            <span
                              className={`px-2 py-1 text-xs backdrop-blur-sm rounded-lg ${
                                dueStatus.color === 'red'
                                  ? 'bg-red-500/20 border border-red-400/30 text-red-700'
                                  : dueStatus.color === 'yellow'
                                    ? 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-700'
                                    : 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-700'
                              }`}
                            >
                              {dueStatus.label}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-solid mb-1">{hw.title}</h3>
                        <p className="text-sm text-prominent">{hw.topic}</p>
                        <p className="text-xs text-subtle mt-2">
                          {t('panels.homework.created')} {new Date(hw.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => setSelectedHomework(hw)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title={t('panels.homework.viewContent')}
                        >
                          <svg className="w-5 h-5 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handlePersonalize(hw.id)}
                          disabled={isPersonalizing === hw.id}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                          title={t('panels.homework.personalizeForStudents')}
                        >
                          {isPersonalizing === hw.id ? (
                            <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(hw.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title={t('panels.homework.delete')}
                        >
                          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        )}
          </>
        )}
      </motion.div>

      {/* Homework Detail Modal */}
      <AnimatePresence>
        {selectedHomework && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setSelectedHomework(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard variant="elevated" className="overflow-hidden">
                <div className="p-6 border-b border-white/15">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-solid">{selectedHomework.title}</h2>
                      <p className="text-prominent mt-1">{selectedHomework.topic}</p>
                      {selectedHomework.dueDate && (
                        <p className="text-sm text-subtle mt-2">
                          {t('panels.homework.due')} {new Date(selectedHomework.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedHomework(null)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  <h3 className="font-semibold text-solid mb-3">{t('panels.homework.masterContent')}</h3>
                  <div className="whitespace-pre-wrap text-prominent bg-white/5 p-4 rounded-xl border border-white/10">
                    {selectedHomework.masterContent}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
