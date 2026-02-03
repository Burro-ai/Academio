import { useChatContext } from '@/context/ChatContext';
import { formatDate, getTopicInfo } from '@/utils/formatters';

export function ChatHistory() {
  const { sessions, currentSession, selectSession, deleteSession, isLoading } =
    useChatContext();

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation?')) {
      try {
        await deleteSession(id);
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-subtle text-center">
        No conversations yet. Start a new session above!
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="px-3 text-xs font-semibold text-subtle uppercase tracking-wider mb-2">
        History
      </h3>
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {sessions.map((session) => {
          const topicInfo = getTopicInfo(session.topic);
          const isActive = currentSession?.id === session.id;

          return (
            <button
              key={session.id}
              onClick={() => selectSession(session.id)}
              disabled={isLoading}
              className={`w-full flex items-start gap-3 px-3 py-2 rounded-xl text-left
                         transition-all duration-200 group border border-transparent
                         ${
                           isActive
                             ? 'backdrop-blur-md bg-primary-500/30 border-primary-400/30 text-solid shadow-glass'
                             : 'text-prominent hover:backdrop-blur-md hover:bg-white/20 hover:border-white/20'
                         }
                         disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-lg flex-shrink-0">{topicInfo.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{session.title}</p>
                <p className="text-xs text-subtle">
                  {formatDate(session.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded-lg
                           transition-all text-subtle hover:text-red-300"
                title="Delete conversation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
}
