import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton } from '@/components/glass';
import { LessonCreator } from './LessonCreator';
import { lessonApi } from '@/services/lessonApi';
import { LessonWithTeacher } from '@/types';

export function LessonsPanel() {
  const { t } = useTranslation();
  const [lessons, setLessons] = useState<LessonWithTeacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonWithTeacher | null>(null);
  const [isPersonalizing, setIsPersonalizing] = useState<string | null>(null);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await lessonApi.getLessons();
      setLessons(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('panels.lessons.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonalize = async (lessonId: string) => {
    setIsPersonalizing(lessonId);

    try {
      const result = await lessonApi.personalizeLesson(lessonId);
      // Reload lessons to get updated counts
      await loadLessons();
      alert(t('panels.lessons.personalizedSuccess', { count: result.count }));
    } catch (err) {
      alert(err instanceof Error ? err.message : t('panels.lessons.failedToPersonalize'));
    } finally {
      setIsPersonalizing(null);
    }
  };

  const handleDelete = async (lessonId: string) => {
    if (!confirm(t('panels.lessons.confirmDelete'))) return;

    try {
      await lessonApi.deleteLesson(lessonId);
      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
    } catch (err) {
      alert(err instanceof Error ? err.message : t('panels.lessons.failedToDelete'));
    }
  };

  const handleLessonCreated = (lesson: LessonWithTeacher) => {
    setLessons((prev) => [lesson, ...prev]);
    setShowCreator(false);
  };

  if (showCreator) {
    return (
      <LessonCreator
        onBack={() => setShowCreator(false)}
        onCreated={handleLessonCreated}
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
            <h1 className="text-2xl font-bold text-solid">{t('panels.lessons.title')}</h1>
            <p className="text-prominent mt-1">
              {t('panels.lessons.subtitle')}
            </p>
          </div>
          <GlassButton variant="primary" onClick={() => setShowCreator(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t('panels.lessons.createButton')}
          </GlassButton>
        </div>

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
        ) : lessons.length === 0 ? (
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
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <h2 className="text-lg font-semibold text-solid mb-2">{t('panels.lessons.empty.title')}</h2>
            <p className="text-prominent mb-4">
              {t('panels.lessons.empty.message')}
            </p>
            <GlassButton variant="primary" onClick={() => setShowCreator(true)}>
              {t('panels.lessons.empty.createFirst')}
            </GlassButton>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {lessons.map((lesson, index) => (
              <motion.div
                key={lesson.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <GlassCard variant="card" className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {lesson.subject && (
                          <span className="px-2 py-1 text-xs backdrop-blur-sm bg-blue-500/20 border border-blue-400/30 text-blue-700 rounded-lg capitalize">
                            {lesson.subject}
                          </span>
                        )}
                        <span className="px-2 py-1 text-xs backdrop-blur-sm bg-white/10 border border-white/20 rounded-lg">
                          {lesson.personalizedCount || 0} {t('panels.lessons.students')}
                        </span>
                      </div>
                      <h3 className="font-semibold text-solid mb-1">{lesson.title}</h3>
                      <p className="text-sm text-prominent">{lesson.topic}</p>
                      <p className="text-xs text-subtle mt-2">
                        {t('panels.lessons.created')} {new Date(lesson.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => setSelectedLesson(lesson)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title={t('panels.lessons.viewContent')}
                      >
                        <svg className="w-5 h-5 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handlePersonalize(lesson.id)}
                        disabled={isPersonalizing === lesson.id}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                        title={t('panels.lessons.personalizeForStudents')}
                      >
                        {isPersonalizing === lesson.id ? (
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
                        onClick={() => handleDelete(lesson.id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                        title={t('panels.lessons.delete')}
                      >
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Lesson Detail Modal */}
      <AnimatePresence>
        {selectedLesson && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setSelectedLesson(null)}
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
                      <h2 className="text-xl font-bold text-solid">{selectedLesson.title}</h2>
                      <p className="text-prominent mt-1">{selectedLesson.topic}</p>
                    </div>
                    <button
                      onClick={() => setSelectedLesson(null)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  <h3 className="font-semibold text-solid mb-3">{t('panels.lessons.masterContent')}</h3>
                  <div className="whitespace-pre-wrap text-prominent bg-white/5 p-4 rounded-xl border border-white/10">
                    {selectedLesson.masterContent}
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
