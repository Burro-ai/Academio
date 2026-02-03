import { useState, useEffect, useRef } from 'react';
import { useTeacherContext } from '@/context/TeacherContext';
import { useTeacherChat } from '@/hooks/useTeacherChat';
import { TeacherChatMessage, MaterialType } from '@/types';

const MATERIAL_TYPES: { id: MaterialType; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '💬' },
  { id: 'lesson', label: 'Lesson Plan', icon: '📚' },
  { id: 'presentation', label: 'Presentation', icon: '📊' },
  { id: 'test', label: 'Test/Quiz', icon: '📝' },
  { id: 'homework', label: 'Homework', icon: '📋' },
];

export function TeacherChat() {
  const {
    chatSessions,
    currentChatSession,
    loadChatSessions,
    createChatSession,
    selectChatSession,
    deleteChatSession,
    addChatMessage,
  } = useTeacherContext();

  const [input, setInput] = useState('');
  const [selectedMaterialType, setSelectedMaterialType] = useState<MaterialType>('general');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isStreaming, currentResponse, error, sendMessage } = useTeacherChat({
    onMessageComplete: (message) => {
      addChatMessage(message);
    },
  });

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChatSession?.messages, currentResponse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    // Create session if needed
    let sessionId = currentChatSession?.id;
    if (!sessionId) {
      const session = await createChatSession(
        input.slice(0, 50),
        selectedMaterialType
      );
      sessionId = session.id;
    }

    // Add user message to UI
    addChatMessage({
      id: `temp-${Date.now()}`,
      sessionId: sessionId,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    });

    const messageToSend = input;
    setInput('');

    // Send message with the session ID
    await sendMessage(sessionId, messageToSend, selectedMaterialType);
  };

  const handleNewSession = async () => {
    await createChatSession('New Session', selectedMaterialType);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={handleNewSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chatSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => selectChatSession(session.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group ${
                currentChatSession?.id === session.id
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{session.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChatSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <span className="text-xs text-gray-500 capitalize">{session.materialType}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Material Type Selector */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Creating:</span>
            {MATERIAL_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedMaterialType(type.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedMaterialType === type.id
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type.icon} {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!currentChatSession ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">AI Teaching Assistant</h2>
              <p className="text-gray-500 max-w-md">
                I can help you create lesson plans, presentations, tests, homework assignments, and more.
                Select a material type and start a conversation!
              </p>
            </div>
          ) : (
            <>
              {currentChatSession.messages.map((message: TeacherChatMessage) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))}
              {isStreaming && currentResponse && (
                <ChatMessageBubble
                  message={{
                    id: 'streaming',
                    sessionId: currentChatSession.id,
                    role: 'assistant',
                    content: currentResponse,
                    timestamp: new Date().toISOString(),
                  }}
                  isStreaming
                />
              )}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to create lesson plans, tests, homework..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStreaming ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface ChatMessageBubbleProps {
  message: TeacherChatMessage;
  isStreaming?: boolean;
}

function ChatMessageBubble({ message, isStreaming }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-emerald-600 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
