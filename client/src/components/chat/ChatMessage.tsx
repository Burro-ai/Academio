import { Message } from '@/types';
import { SmartMarkdown } from '@/components/shared';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3 message-enter ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full backdrop-blur-md bg-white/30 border border-white/30 flex items-center justify-center shadow-glass">
          <span className="text-lg">🎓</span>
        </div>
      )}

      <div
        className={`max-w-[80%] px-4 py-3 shadow-glass ${
          isUser
            ? 'glass-message-user text-white'
            : 'glass-message-ai text-solid'
        }`}
      >
        <div className="break-words">
          {isUser ? (
            // User messages: plain text
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            // AI messages: SmartMarkdown with LaTeX support
            <SmartMarkdown content={message.content} variant="chat" compact />
          )}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse rounded-sm" />
          )}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/20">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 text-sm opacity-80"
              >
                <span>{attachment.type === 'pdf' ? '📄' : '🖼️'}</span>
                <span>{attachment.filename}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full backdrop-blur-md bg-primary-500/40 border border-primary-400/30 flex items-center justify-center shadow-glass">
          <span className="text-white text-sm font-medium">S</span>
        </div>
      )}
    </div>
  );
}
