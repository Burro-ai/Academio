/**
 * HomeworkSidekick - Socratic AI Chat for Homework Help
 *
 * A chat interface that:
 * - Follows Socratic methodology (guides, never gives answers)
 * - Has quick-ask buttons for each question
 * - Streams responses via SSE
 * - Is collapsible on mobile
 * - Uses Liquid Glass design system
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
// GlassCard not used directly but included for consistency with design system
import { ChatMessage } from '@/components/chat/ChatMessage';
import { useHomeworkChat } from '@/hooks/useHomeworkChat';
import { HomeworkQuestionJson } from '@/types';

interface HomeworkSidekickProps {
  personalizedHomeworkId: string;
  questions: HomeworkQuestionJson[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAskAboutQuestion?: (questionId: number) => void;
}

export function HomeworkSidekick({
  personalizedHomeworkId,
  questions,
  isExpanded,
  onToggleExpand,
}: HomeworkSidekickProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [activeQuestionContext, setActiveQuestionContext] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    session,
    messages,
    isLoading,
    isStreaming,
    currentResponse,
    error,
    sendMessage,
    cancelStream,
  } = useHomeworkChat({
    personalizedHomeworkId,
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    sendMessage(inputValue.trim(), activeQuestionContext);
    setInputValue('');
    setActiveQuestionContext(undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickAsk = (question: HomeworkQuestionJson) => {
    const context = `Pregunta ${question.id}: ${question.text}`;
    setActiveQuestionContext(context);
    setInputValue(t('homework.sidekick.quickAskPrefix', 'Necesito ayuda con esta pregunta'));
    textareaRef.current?.focus();
  };

  if (!isExpanded) {
    return null;
  }

  return (
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
          <div className="w-10 h-10 backdrop-blur-md bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-400/40 rounded-xl flex items-center justify-center">
            <span className="text-xl">🤖</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-solid">{t('homework.sidekick.title')}</h3>
            <p className="text-xs text-prominent">{t('homework.sidekick.subtitle')}</p>
          </div>
          <button
            onClick={onToggleExpand}
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick Ask Buttons */}
      {questions.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-white/10 backdrop-blur-md bg-white/5">
          <p className="text-xs text-prominent mb-2">{t('homework.sidekick.quickAsk')}</p>
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q) => (
              <motion.button
                key={q.id}
                onClick={() => handleQuickAsk(q)}
                disabled={isStreaming}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all
                  ${activeQuestionContext?.includes(`Pregunta ${q.id}`)
                    ? 'backdrop-blur-md bg-purple-500/30 border border-purple-400/50 text-purple-700'
                    : 'backdrop-blur-md bg-white/10 border border-white/15 text-prominent hover:bg-white/20'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                P{q.id}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 backdrop-blur-md bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-400/30 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">💡</span>
              </div>
              <h2 className="text-lg font-semibold text-solid mb-2">
                {t('homework.sidekick.welcome')}
              </h2>
              <p className="text-prominent text-sm max-w-xs mx-auto leading-relaxed">
                {t('homework.sidekick.welcomeMessage')}
              </p>

              {/* Suggested Actions */}
              <div className="mt-6 space-y-2">
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={() => {
                    setInputValue(t('homework.sidekick.suggestion1'));
                    textareaRef.current?.focus();
                  }}
                  className="block w-full text-left px-4 py-2.5 backdrop-blur-md bg-white/10 border border-white/15 rounded-xl text-sm text-prominent hover:bg-white/20 transition-all"
                >
                  <span className="mr-2">🔍</span>
                  {t('homework.sidekick.suggestion1')}
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  onClick={() => {
                    setInputValue(t('homework.sidekick.suggestion2'));
                    textareaRef.current?.focus();
                  }}
                  className="block w-full text-left px-4 py-2.5 backdrop-blur-md bg-white/10 border border-white/15 rounded-xl text-sm text-prominent hover:bg-white/20 transition-all"
                >
                  <span className="mr-2">📖</span>
                  {t('homework.sidekick.suggestion2')}
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <>
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
            </>
          )}

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 backdrop-blur-md bg-red-500/20 border border-red-400/40 text-red-700 rounded-xl text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Active Question Context Indicator */}
      <AnimatePresence>
        {activeQuestionContext && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 border-t border-white/10 backdrop-blur-md bg-purple-500/10"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-purple-700 truncate flex-1">
                <span className="font-medium">{t('homework.sidekick.askingAbout')}:</span>{' '}
                {activeQuestionContext.substring(0, 50)}...
              </p>
              <button
                onClick={() => setActiveQuestionContext(undefined)}
                className="p-1 hover:bg-white/10 rounded transition-colors ml-2"
              >
                <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                placeholder={t('homework.sidekick.placeholder')}
                disabled={isStreaming || isLoading}
                rows={1}
                className="w-full resize-none rounded-xl px-4 py-3
                           backdrop-blur-md bg-white/20 border border-white/20
                           focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50
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
                <svg className="w-5 h-5 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            ) : (
              <motion.button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="flex-shrink-0 p-3 backdrop-blur-md bg-purple-500/30 border border-purple-400/40 rounded-xl
                           hover:bg-purple-500/40
                           disabled:bg-white/10 disabled:border-white/15 disabled:text-surface-400 disabled:cursor-not-allowed
                           transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
}
