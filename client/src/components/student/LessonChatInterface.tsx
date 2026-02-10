import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton } from '@/components/glass';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { useLessonChat } from '@/hooks/useLessonChat';

export function LessonChatInterface() {
  const { id: lessonId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isLessonExpanded, setIsLessonExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    session,
    messages,
    lesson,
    isLoading,
    isStreaming,
    currentResponse,
    error,
    sendMessage,
    cancelStream,
  } = useLessonChat({
    personalizedLessonId: lessonId || '',
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentResponse]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [inputValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    sendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleBack = () => {
    navigate('/dashboard/student');
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400" />
      </div>
    );
  }

  if (error && !lesson) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
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
          <p className="text-red-200 mb-4">{error}</p>
          <GlassButton variant="secondary" onClick={handleBack}>
            {t('common.goBack')}
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 backdrop-blur-xl bg-white/10 border-b border-white/15">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={handleBack}
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-solid">{lesson?.title}</h1>
            <div className="flex items-center gap-2">
              {lesson?.subject && (
                <span className="px-2 py-0.5 text-xs backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg capitalize">
                  {lesson.subject}
                </span>
              )}
              <span className="text-sm text-prominent">{lesson?.topic}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Collapsible Lesson Content */}
        <AnimatePresence>
          {isLessonExpanded && lesson?.content && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex-shrink-0 border-b border-white/15 overflow-hidden"
            >
              <div className="max-w-4xl mx-auto p-4">
                <GlassCard variant="surface" className="p-4 max-h-48 overflow-y-auto">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div
                      className="text-prominent whitespace-pre-wrap text-sm"
                      dangerouslySetInnerHTML={{
                        __html: lesson.content.replace(/\n/g, '<br>'),
                      }}
                    />
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle Lesson Content Button */}
        <div className="flex-shrink-0 flex justify-center -mt-3 mb-2">
          <button
            onClick={() => setIsLessonExpanded(!isLessonExpanded)}
            className="px-3 py-1 backdrop-blur-md bg-white/20 border border-white/20 rounded-full text-xs text-prominent hover:bg-white/30 transition-colors flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isLessonExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {isLessonExpanded
              ? t('student.lessonChat.collapseLesson')
              : t('student.lessonChat.expandLesson')}
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 backdrop-blur-md bg-white/20 border border-white/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">🎓</span>
                </div>
                <h2 className="text-lg font-semibold text-solid mb-2">
                  {t('student.lessonChat.welcome')}
                </h2>
                <p className="text-prominent max-w-md mx-auto">
                  {t('student.lessonChat.welcomeMessage')}
                </p>
              </div>
            )}

            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {/* Streaming response */}
            {isStreaming && currentResponse && (
              <ChatMessage
                message={{
                  id: 'streaming',
                  sessionId: session?.id || '',
                  role: 'assistant',
                  content: currentResponse,
                  timestamp: new Date().toISOString(),
                }}
                isStreaming={true}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-white/15 backdrop-blur-xl bg-white/15 p-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('student.lessonChat.askQuestion')}
                  disabled={isStreaming}
                  rows={1}
                  className="w-full resize-none rounded-xl px-4 py-3
                             backdrop-blur-md bg-white/20 border border-white/20
                             focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40
                             placeholder:text-surface-500/70 text-solid
                             disabled:bg-white/10 disabled:cursor-not-allowed
                             transition-all duration-200"
                />
              </div>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={cancelStream}
                  className="flex-shrink-0 p-3 backdrop-blur-md bg-red-500/30 border border-red-400/30 rounded-xl
                             hover:bg-red-500/40 transition-all duration-200"
                >
                  <svg className="w-5 h-5 text-red-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="flex-shrink-0 p-3 glass-btn-primary rounded-xl
                             disabled:bg-white/20 disabled:border-white/15 disabled:text-surface-400 disabled:cursor-not-allowed
                             transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-subtle text-center">
              {t('chat.pressEnterToSend')}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
