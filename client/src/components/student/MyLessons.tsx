import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '@/components/glass';
import { studentApi } from '@/services/studentApi';
import { PersonalizedLessonWithDetails } from '@/types';

export function MyLessons() {
  const [lessons, setLessons] = useState<PersonalizedLessonWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<PersonalizedLessonWithDetails | null>(null);

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
    setSelectedLesson(lesson);
    if (!lesson.viewedAt) {
      markAsViewed(lesson.id);
    }
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
            Try Again
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
          <h1 className="text-2xl font-bold text-solid">My Lessons</h1>
          <p className="text-prominent mt-1">
            Personalized lessons created just for you
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
            <h2 className="text-lg font-semibold text-solid mb-2">No lessons yet</h2>
            <p className="text-prominent">
              Your teacher hasn't assigned any lessons yet. Check back later!
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
                          New
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
                {/* Modal Header */}
                <div className="p-6 border-b border-white/15">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {selectedLesson.lesson.subject && (
                          <span className="px-2 py-1 text-xs backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg capitalize">
                            {selectedLesson.lesson.subject}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-solid">
                        {selectedLesson.lesson.title}
                      </h2>
                      <p className="text-prominent mt-1">{selectedLesson.lesson.topic}</p>
                    </div>
                    <button
                      onClick={() => setSelectedLesson(null)}
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  <div className="prose prose-invert max-w-none">
                    <div
                      className="text-prominent whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: selectedLesson.personalizedContent.replace(/\n/g, '<br>'),
                      }}
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-white/15 flex justify-between items-center">
                  <span className="text-xs text-subtle">
                    By {selectedLesson.lesson.teacherName} •{' '}
                    {new Date(selectedLesson.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => setSelectedLesson(null)}
                    className="px-4 py-2 backdrop-blur-md bg-white/20 border border-white/30 rounded-lg text-solid hover:bg-white/30 transition-all"
                  >
                    Close
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
