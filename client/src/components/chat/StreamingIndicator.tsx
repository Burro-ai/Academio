interface StreamingIndicatorProps {
  content: string;
}

export function StreamingIndicator({ content }: StreamingIndicatorProps) {
  return (
    <div className="flex gap-3 justify-start message-enter">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
        <span className="text-lg">🎓</span>
      </div>

      <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 bg-surface-100 text-surface-800">
        {content ? (
          <div className="whitespace-pre-wrap break-words">
            {content}
            <span className="inline-block w-2 h-4 ml-1 bg-primary-600 animate-pulse" />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-surface-400 rounded-full typing-dot" />
            <div className="w-2 h-2 bg-surface-400 rounded-full typing-dot" />
            <div className="w-2 h-2 bg-surface-400 rounded-full typing-dot" />
          </div>
        )}
      </div>
    </div>
  );
}
