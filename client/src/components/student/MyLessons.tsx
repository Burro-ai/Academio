import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/glass';
import { studentApi } from '@/services/studentApi';
import { PersonalizedLessonWithDetails } from '@/types';

export function MyLessons() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<PersonalizedLessonWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await studentApi.getMyLessons();
      setLessons(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lessons');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsViewed = async (lessonId: string) => {
    try {
      await studentApi.markLessonViewed(lessonId);
      setLessons(prev =>
        prev.map(l =>
          l.id === lessonId ? { ...l, viewedAt: new Date().toISOString() } : l
        )
      );
    } catch (err) {
      console.error('Failed to mark lesson as viewed:', err);
    }
  };

  const handleOpenLesson = (lesson: PersonalizedLessonWithDetails) => {
    if (!lesson.viewedAt) {
      markAsViewed(lesson.id);
    }
    // Navigate to the lesson chat interface
    navigate(`/dashboard/student/lessons/${lesson.id}`);
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
            onClick={loadLessons}
            className="mt-4 px-4 py-2 backdrop-blur-md bg-white/20 border border-white/30 rounded-lg text-solid hover:bg-white/30 transition-all"
          >
            {t('common.tryAgain')}
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-solid">{t('student.myLessons.title')}</h1>
          <p className="text-prominent mt-1">
            {t('student.myLessons.subtitle')}
          </p>
        </div>

        {/* Lessons Grid */}
        {lessons.length === 0 ? (
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
            <h2 className="text-lg font-semibold text-solid mb-2">{t('student.myLessons.empty.title')}</h2>
            <p className="text-prominent">
              {t('student.myLessons.empty.message')}
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lessons.map((lesson, index) => (
              <motion.div
                key={lesson.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard
                  variant="card"
                  hover
                  className="p-5 cursor-pointer"
                  onClick={() => handleOpenLesson(lesson)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {lesson.lesson.subject && (
                        <span className="px-2 py-1 text-xs backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg capitalize">
                          {lesson.lesson.subject}
                        </span>
                      )}
                      {!lesson.viewedAt && (
                        <span className="px-2 py-1 text-xs backdrop-blur-sm bg-blue-500/20 border border-blue-400/30 text-blue-100 rounded-lg">
                          {t('student.myLessons.newBadge')}
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
                  <h3 className="font-semibold text-solid mb-1">{lesson.lesson.title}</h3>
                  <p className="text-sm text-prominent mb-3">{lesson.lesson.topic}</p>
                  <div className="flex items-center justify-between text-xs text-subtle">
                    <span>By {lesson.lesson.teacherName}</span>
                    <span>
                      {new Date(lesson.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
