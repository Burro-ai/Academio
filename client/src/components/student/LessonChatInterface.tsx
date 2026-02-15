/**
 * LessonChatInterface - Focus Mode Lesson Viewer
 *
 * A full-screen immersive learning experience with:
 * - 60/40 horizontal split (Reader | Chat)
 * - Educational Reader with specular highlights
 * - Socratic Sidekick chat interface
 * - Responsive stacking for tablets
 * - Liquid Glass design system
 */

import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton } from '@/components/glass';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { SmartMarkdown } from '@/components/shared/SmartMarkdown';
import { useLessonChat } from '@/hooks/useLessonChat';
import { useSpecularHighlight } from '@/hooks/useSpecularHighlight';

export function LessonChatInterface() {
  const { id: lessonId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  // Specular highlight for the reader surface
  const { elementRef: specularRef, specularGradient } = useSpecularHighlight<HTMLDivElement>();

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
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 backdrop-blur-xl bg-white/20 border border-white/30 rounded-2xl flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400" />
          </div>
          <p className="text-prominent text-lg">{t('common.loading')}</p>
        </motion.div>
      </div>
    );
  }

  if (error && !lesson) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <GlassCard variant="elevated" className="p-8 text-center max-w-md">
          <svg
            className="w-16 h-16 mx-auto text-red-400 mb-6"
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
          <p className="text-red-200 text-lg mb-6">{error}</p>
          <GlassButton variant="secondary" size="lg" onClick={handleBack}>
            {t('common.goBack')}
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-screen flex flex-col overflow-hidden"
    >
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 backdrop-blur-2xl bg-white/10 border-b border-white/15 z-10">
        <div className="max-w-[95vw] mx-auto flex items-center gap-4">
          <motion.button
            onClick={handleBack}
            className="p-2.5 hover:bg-white/15 rounded-xl transition-all duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
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
          </motion.button>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-solid truncate">{lesson?.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              {lesson?.subject && (
                <span className="px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm bg-emerald-500/25 border border-emerald-400/40 text-emerald-100 rounded-lg capitalize">
                  {lesson.subject}
                </span>
              )}
              <span className="text-sm text-prominent truncate">{lesson?.topic}</span>
            </div>
          </div>

          {/* Chat Toggle for Mobile */}
          <button
            onClick={() => setIsChatExpanded(!isChatExpanded)}
            className="lg:hidden p-2.5 hover:bg-white/15 rounded-xl transition-all duration-200"
          >
            <svg
              className={`w-5 h-5 text-prominent transition-transform ${isChatExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content - 60/40 Split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Pane - Educational Reader (60%) */}
        <motion.div
          ref={readerRef}
          className={`flex-1 lg:flex-[0.6] overflow-hidden flex flex-col ${
            !isChatExpanded ? 'flex' : 'hidden lg:flex'
          }`}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6 lg:p-8">
              {/* Reader Surface with Specular Highlight */}
              <div
                ref={specularRef}
                className="relative"
              >
                <GlassCard
                  variant="elevated"
                  blur="xl"
                  className="p-8 lg:p-10 relative overflow-hidden"
                >
                  {/* Specular highlight overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                    style={{ background: specularGradient }}
                  />

                  {/* Lesson Type Badge */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 backdrop-blur-md bg-gradient-to-br from-emerald-500/30 to-blue-500/30 border border-emerald-400/40 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">📚</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-emerald-300 uppercase tracking-wider">
                        {t('student.lessonChat.lessonContent')}
                      </span>
                      <h2 className="text-lg font-semibold text-solid">{lesson?.title}</h2>
                    </div>
                  </div>

                  {/* Lesson Content with Focus Mode Rendering */}
                  <div className="relative z-10">
                    {lesson?.content ? (
                      <SmartMarkdown
                        content={lesson.content}
                        variant="focus"
                        className="text-solid"
                      />
                    ) : (
                      <p className="text-prominent text-center py-12">
                        {t('student.lessonChat.noContent')}
                      </p>
                    )}
                  </div>
                </GlassCard>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 flex flex-wrap gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsChatExpanded(true)}
                  className="lg:hidden px-4 py-2.5 backdrop-blur-md bg-emerald-500/25 border border-emerald-400/40 rounded-xl text-sm font-medium text-emerald-100 hover:bg-emerald-500/35 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {t('student.lessonChat.askQuestion')}
                  </span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Pane - Socratic Sidekick Chat (40%) */}
        <AnimatePresence>
          {isChatExpanded && (
            <motion.div
              className="flex-1 lg:flex-[0.4] flex flex-col border-t lg:border-t-0 lg:border-l border-white/15 backdrop-blur-xl bg-white/5"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              transition={{ delay: 0.15 }}
            >
              {/* Chat Header */}
              <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 backdrop-blur-md bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 backdrop-blur-md bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-blue-400/40 rounded-xl flex items-center justify-center">
                    <span className="text-xl">🎓</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-solid">{t('student.lessonChat.socraticSidekick')}</h3>
                    <p className="text-xs text-prominent">{t('student.lessonChat.askAnything')}</p>
                  </div>
                  <button
                    onClick={() => setIsChatExpanded(false)}
                    className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4">
                  {messages.length === 0 && !isStreaming && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-8"
                    >
                      <div className="w-16 h-16 mx-auto mb-4 backdrop-blur-md bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 rounded-2xl flex items-center justify-center">
                        <span className="text-3xl">💭</span>
                      </div>
                      <h2 className="text-lg font-semibold text-solid mb-2">
                        {t('student.lessonChat.welcome')}
                      </h2>
                      <p className="text-prominent text-sm max-w-xs mx-auto leading-relaxed">
                        {t('student.lessonChat.welcomeMessage')}
                      </p>

                      {/* Suggested Questions */}
                      <div className="mt-6 space-y-2">
                        {[
                          t('student.lessonChat.suggestion1'),
                          t('student.lessonChat.suggestion2'),
                          t('student.lessonChat.suggestion3'),
                        ].map((suggestion, idx) => (
                          <motion.button
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + idx * 0.1 }}
                            onClick={() => {
                              setInputValue(suggestion);
                              textareaRef.current?.focus();
                            }}
                            className="block w-full text-left px-4 py-2.5 backdrop-blur-md bg-white/10 border border-white/15 rounded-xl text-sm text-prominent hover:bg-white/20 transition-all"
                          >
                            <span className="mr-2">💡</span>
                            {suggestion}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
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
              <div className="flex-shrink-0 border-t border-white/15 backdrop-blur-xl bg-white/10 p-4">
                <form onSubmit={handleSubmit}>
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
                                   focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50
                                   placeholder:text-surface-500/70 text-solid
                                   disabled:bg-white/10 disabled:cursor-not-allowed
                                   transition-all duration-200"
                      />
                    </div>

                    {isStreaming ? (
                      <motion.button
                        type="button"
                        onClick={cancelStream}
                        className="flex-shrink-0 p-3 backdrop-blur-md bg-red-500/30 border border-red-400/40 rounded-xl
                                   hover:bg-red-500/40 transition-all duration-200"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <svg className="w-5 h-5 text-red-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </motion.button>
                    ) : (
                      <motion.button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="flex-shrink-0 p-3 backdrop-blur-md bg-emerald-500/30 border border-emerald-400/40 rounded-xl
                                   hover:bg-emerald-500/40
                                   disabled:bg-white/10 disabled:border-white/15 disabled:text-surface-400 disabled:cursor-not-allowed
                                   transition-all duration-200"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <svg className="w-5 h-5 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                      </motion.button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-subtle text-center">
                    {t('chat.pressEnterToSend')}
                  </p>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
