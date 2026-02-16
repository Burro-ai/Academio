import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton } from '@/components/glass';
import { LessonChatViewer } from './LessonChatViewer';
import { teacherApi } from '@/services/teacherApi';
import { LessonChatSessionWithDetails } from '@/types';

interface StudentLessonChatsProps {
  studentId: string;
  studentName: string;
}

export function StudentLessonChats({ studentId, studentName }: StudentLessonChatsProps) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<LessonChatSessionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [studentId]);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await teacherApi.getStudentLessonChats(studentId);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard variant="surface" className="p-4 backdrop-blur-md bg-red-500/20 border-red-400/30">
        <p className="text-red-700 text-sm">{error}</p>
      </GlassCard>
    );
  }

  if (sessions.length === 0) {
    return (
      <GlassCard variant="surface" className="p-6 text-center">
        <svg
          className="w-10 h-10 mx-auto text-prominent mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <p className="text-prominent text-sm">
          {t('teacher.lessonChats.noChats', { name: studentName })}
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-solid">
        {t('teacher.lessonChats.title')} ({sessions.length})
      </h3>

      {sessions.map((session, index) => (
        <motion.div
          key={session.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <GlassCard variant="surface" className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {session.lessonSubject && (
                    <span className="px-1.5 py-0.5 text-xs backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-700 rounded capitalize">
                      {session.lessonSubject}
                    </span>
                  )}
                </div>
                <h4 className="font-medium text-solid text-sm truncate">{session.lessonTitle}</h4>
                <p className="text-xs text-prominent truncate">{session.lessonTopic}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-subtle">
                  <span>{t('teacher.lessonChats.messages', { count: session.messageCount })}</span>
                  <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={() => setSelectedSession(session.id)}
              >
                {t('teacher.lessonChats.viewChat')}
              </GlassButton>
            </div>
          </GlassCard>
        </motion.div>
      ))}

      {/* Chat Viewer Modal */}
      <AnimatePresence>
        {selectedSession && (
          <LessonChatViewer
            sessionId={selectedSession}
            onClose={() => setSelectedSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
