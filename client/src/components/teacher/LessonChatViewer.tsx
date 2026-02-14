import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/glass';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { teacherApi } from '@/services/teacherApi';
import { LessonChatSession, LessonChatMessage } from '@/types';

interface LessonChatViewerProps {
  sessionId: string;
  onClose: () => void;
}

export function LessonChatViewer({ sessionId, onClose }: LessonChatViewerProps) {
  const { t } = useTranslation();
  const [session, setSession] = useState<LessonChatSession | null>(null);
  const [messages, setMessages] = useState<LessonChatMessage[]>([]);
  const [lesson, setLesson] = useState<{ id: string; title: string; topic: string; subject?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChat();
  }, [sessionId]);

  const loadChat = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await teacherApi.viewLessonChat(sessionId);
      setSession(data.session);
      setMessages(data.messages);
      setLesson(data.lesson);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
        className="w-full max-w-3xl h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard variant="elevated" className="h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-white/15">
            <div className="flex items-start justify-between">
              <div>
                {lesson && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      {lesson.subject && (
                        <span className="px-2 py-0.5 text-xs backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg capitalize">
                          {lesson.subject}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-solid">{lesson.title}</h2>
                    <p className="text-sm text-prominent">{lesson.topic}</p>
                  </>
                )}
                {session && (
                  <p className="text-xs text-subtle mt-2">
                    {t('teacher.lessonChats.startedAt', {
                      date: new Date(session.createdAt).toLocaleString(),
                    })}
                  </p>
                )}
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

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <GlassCard variant="surface" className="p-4 backdrop-blur-md bg-red-500/20 border-red-400/30">
                  <p className="text-red-100">{error}</p>
                </GlassCard>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-prominent">{t('teacher.lessonChats.noMessages')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={{
                      id: message.id,
                      sessionId: message.sessionId,
                      role: message.role,
                      content: message.content,
                      timestamp: message.timestamp,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 p-4 border-t border-white/15 bg-white/5">
            <p className="text-xs text-center text-subtle">
              {t('teacher.lessonChats.readOnlyNotice')}
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
