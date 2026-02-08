import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '@/components/glass';
import { studentApi } from '@/services/studentApi';
import { PersonalizedHomeworkWithDetails } from '@/types';

export function MyHomework() {
  const [homework, setHomework] = useState<PersonalizedHomeworkWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHomework, setSelectedHomework] = useState<PersonalizedHomeworkWithDetails | null>(null);

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
      return { label: 'Overdue', color: 'red' };
    } else if (diffDays === 0) {
      return { label: 'Due today', color: 'yellow' };
    } else if (diffDays === 1) {
      return { label: 'Due tomorrow', color: 'yellow' };
    } else if (diffDays <= 3) {
      return { label: `Due in ${diffDays} days`, color: 'blue' };
    }
    return { label: `Due ${due.toLocaleDateString()}`, color: 'emerald' };
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
            Try Again
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
          <h1 className="text-2xl font-bold text-solid">My Homework</h1>
          <p className="text-prominent mt-1">
            Assignments personalized for your learning style
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
            <h2 className="text-lg font-semibold text-solid mb-2">No homework yet</h2>
            <p className="text-prominent">
              Your teacher hasn't assigned any homework yet. Check back later!
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-8">
            {/* Pending Homework */}
            {pendingHomework.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-solid mb-4">
                  To Do ({pendingHomework.length})
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
                          onClick={() => setSelectedHomework(hw)}
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
                  Completed ({submittedHomework.length})
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
                        onClick={() => setSelectedHomework(hw)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {hw.homework.subject && (
                              <span className="px-2 py-1 text-xs backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg capitalize">
                                {hw.homework.subject}
                              </span>
                            )}
                            <span className="px-2 py-1 text-xs backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg">
                              Submitted
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
                {/* Modal Header */}
                <div className="p-6 border-b border-white/15">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {selectedHomework.homework.subject && (
                          <span className="px-2 py-1 text-xs backdrop-blur-sm bg-blue-500/20 border border-blue-400/30 text-blue-100 rounded-lg capitalize">
                            {selectedHomework.homework.subject}
                          </span>
                        )}
                        {selectedHomework.homework.dueDate && (
                          <span className="px-2 py-1 text-xs backdrop-blur-sm bg-white/10 border border-white/20 rounded-lg">
                            Due: {new Date(selectedHomework.homework.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-solid">
                        {selectedHomework.homework.title}
                      </h2>
                      <p className="text-prominent mt-1">{selectedHomework.homework.topic}</p>
                    </div>
                    <button
                      onClick={() => setSelectedHomework(null)}
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
                        __html: selectedHomework.personalizedContent.replace(/\n/g, '<br>'),
                      }}
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-white/15 flex justify-between items-center">
                  <span className="text-xs text-subtle">
                    By {selectedHomework.homework.teacherName} •{' '}
                    {new Date(selectedHomework.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => setSelectedHomework(null)}
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
