import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ChatMessage } from './ChatMessage';
import { StreamingIndicator } from './StreamingIndicator';
import { ChatInput } from './ChatInput';
import { SuggestedPrompts } from './SuggestedPrompts';
import { useChat } from '@/hooks/useChat';
import { useChatContext } from '@/context/ChatContext';
import { Topic } from '@/types';
import { TOPIC_INFO } from '@/data/suggestedPrompts';

const TOPICS: Topic[] = ['math', 'science', 'history', 'writing'];

export function ChatCanvas() {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentSession, addMessage, createSession, isLoading: sessionLoading } = useChatContext();

  const { isStreaming, currentResponse, error, sendMessage } = useChat({
    sessionId: currentSession?.id || '',
    onMessageComplete: (message) => {
      addMessage(message);
    },
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, currentResponse]);

  const handleSendMessage = async (message: string, attachmentContext?: string) => {
    if (!currentSession) return;

    // Add user message immediately
    addMessage({
      id: `temp-${Date.now()}`,
      sessionId: currentSession.id,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Send to API
    await sendMessage(message, attachmentContext);
  };

  const handleTopicSelect = async (topic: Topic) => {
    try {
      await createSession(topic);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handlePromptSelect = async (prompt: string) => {
    if (!currentSession) return;
    await handleSendMessage(prompt);
  };

  // Welcome screen - no session selected
  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div
          className="text-center max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="w-16 h-16 mx-auto mb-4 rounded-full backdrop-blur-md bg-white/30 border border-white/30 flex items-center justify-center shadow-glass"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <span className="text-3xl">🎓</span>
          </motion.div>
          <h2 className="text-2xl font-semibold text-solid mb-2">
            {t('chat.welcome')}
          </h2>
          <p className="text-prominent mb-6">
            {t('chat.welcomeSubtitle')}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {TOPICS.map((topic, index) => {
              const info = TOPIC_INFO[topic];
              return (
                <motion.button
                  key={topic}
                  onClick={() => handleTopicSelect(topic)}
                  disabled={sessionLoading}
                  className={`p-4 glass-card hover:bg-white/30 transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed group`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.05 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="text-2xl mb-2 block group-hover:scale-110 transition-transform">
                    {info.icon}
                  </span>
                  <span className="font-medium text-solid">{t(`topicLabels.${topic}`)}</span>
                </motion.button>
              );
            })}
          </div>

          <motion.button
            onClick={() => handleTopicSelect('general')}
            disabled={sessionLoading}
            className="mt-4 px-6 py-2 glass-card hover:bg-white/30 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed text-sm text-prominent hover:text-solid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            💡 {t('chat.orAskAnything')}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Empty chat state - session exists but no messages
  const hasMessages = currentSession.messages.length > 0 || isStreaming;

  return (
    <div className="flex-1 flex flex-col backdrop-blur-sm bg-white/5">
      {/* Chat header */}
      <div className="border-b border-white/15 px-6 py-4 backdrop-blur-md bg-white/10">
        <div className="flex items-center gap-3">
          <span className="text-xl">{TOPIC_INFO[currentSession.topic]?.icon}</span>
          <div>
            <h1 className="font-semibold text-solid">{currentSession.title}</h1>
            <p className="text-sm text-prominent capitalize">{currentSession.topic}</p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <AnimatePresence mode="wait">
          {!hasMessages ? (
            <motion.div
              key="empty-state"
              className="flex flex-col items-center justify-center py-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className={`w-14 h-14 rounded-full backdrop-blur-md border flex items-center justify-center shadow-glass mb-4 ${TOPIC_INFO[currentSession.topic]?.color}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <span className="text-2xl">{TOPIC_INFO[currentSession.topic]?.icon}</span>
              </motion.div>
              <h3 className="text-lg font-medium text-solid mb-2">
                {t(`topicGreetings.${currentSession.topic}`)}
              </h3>
              <p className="text-sm text-prominent mb-6 text-center max-w-md">
                {t('chat.emptyStateMessage')}
              </p>
              <SuggestedPrompts
                topic={currentSession.topic}
                onSelectPrompt={handlePromptSelect}
                disabled={isStreaming}
              />
            </motion.div>
          ) : (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {currentSession.messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {isStreaming && <StreamingIndicator content={currentResponse} />}

              {error && (
                <div className="p-4 backdrop-blur-md bg-red-500/20 border border-red-400/30 text-red-100 rounded-lg text-sm">
                  Error: {error}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isStreaming}
        placeholder={t('chat.askAbout', { topic: t(`topicLabels.${currentSession.topic}`) })}
      />
    </div>
  );
}
