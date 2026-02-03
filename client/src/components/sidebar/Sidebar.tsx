import { TopicSelector } from './TopicSelector';
import { ChatHistory } from './ChatHistory';
import { Link } from 'react-router-dom';

export function Sidebar() {
  return (
    <aside className="w-64 glass-panel border-r border-white/20 flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-white/15">
        <h1 className="text-xl font-bold text-solid flex items-center gap-2">
          <span>🎓</span>
          <span>Academio</span>
        </h1>
        <p className="text-xs text-prominent mt-1">AI Socratic Tutor</p>
      </div>

      {/* Topic Selector */}
      <div className="p-3 border-b border-white/15">
        <TopicSelector />
      </div>

      {/* Chat History */}
      <div className="flex-1 p-3 overflow-hidden">
        <ChatHistory />
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/15">
        <Link
          to="/admin"
          className="flex items-center gap-2 px-3 py-2 text-sm text-prominent
                     hover:text-solid glass-surface hover:bg-white/25 rounded-lg transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>Admin Portal</span>
        </Link>
      </div>
    </aside>
  );
}
