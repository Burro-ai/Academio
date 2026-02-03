import { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { StreamingIndicator } from './StreamingIndicator';
import { ChatInput } from './ChatInput';
import { useChat } from '@/hooks/useChat';
import { useChatContext } from '@/context/ChatContext';

export function ChatCanvas() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentSession, addMessage } = useChatContext();

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

  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full backdrop-blur-md bg-white/30 border border-white/30 flex items-center justify-center shadow-glass">
            <span className="text-3xl">🎓</span>
          </div>
          <h2 className="text-2xl font-semibold text-solid mb-2">
            Welcome to Academio
          </h2>
          <p className="text-prominent mb-6">
            Your AI-powered Socratic tutor. Select a topic from the sidebar to
            start a new learning session, or choose a previous conversation.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 glass-card hover:bg-white/30 transition-all cursor-pointer">
              <span className="text-lg mb-1 block">📐</span>
              <span className="font-medium text-solid">Math</span>
            </div>
            <div className="p-3 glass-card hover:bg-white/30 transition-all cursor-pointer">
              <span className="text-lg mb-1 block">🔬</span>
              <span className="font-medium text-solid">Science</span>
            </div>
            <div className="p-3 glass-card hover:bg-white/30 transition-all cursor-pointer">
              <span className="text-lg mb-1 block">📜</span>
              <span className="font-medium text-solid">History</span>
            </div>
            <div className="p-3 glass-card hover:bg-white/30 transition-all cursor-pointer">
              <span className="text-lg mb-1 block">✍️</span>
              <span className="font-medium text-solid">Writing</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col backdrop-blur-sm bg-white/5">
      {/* Chat header */}
      <div className="border-b border-white/15 px-6 py-4 backdrop-blur-md bg-white/10">
        <h1 className="font-semibold text-solid">{currentSession.title}</h1>
        <p className="text-sm text-prominent capitalize">{currentSession.topic}</p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {currentSession.messages.length === 0 && !isStreaming && (
          <div className="text-center py-12 text-prominent">
            <p className="mb-2">Start the conversation by asking a question!</p>
            <p className="text-sm text-subtle">
              I'll guide you to discover the answer through thoughtful questions.
            </p>
          </div>
        )}

        {currentSession.messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isStreaming && <StreamingIndicator content={currentResponse} />}

        {error && (
          <div className="p-4 backdrop-blur-md bg-red-500/20 border border-red-400/30 text-red-100 rounded-lg text-sm">
            Error: {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isStreaming}
        placeholder={`Ask about ${currentSession.topic}...`}
      />
    </div>
  );
}
