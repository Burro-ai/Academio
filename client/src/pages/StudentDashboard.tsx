import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChatProvider, useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { ChatCanvas } from '@/components/chat/ChatCanvas';
import { StudentSettings } from '@/components/student/StudentSettings';
import { MyLessons } from '@/components/student/MyLessons';
import { MyHomework } from '@/components/student/MyHomework';
import { FindTeacher } from '@/components/student/FindTeacher';
import { TopicSelector } from '@/components/sidebar/TopicSelector';
import { ChatHistory } from '@/components/sidebar/ChatHistory';

type Tab = 'chat' | 'lessons' | 'homework' | 'teacher' | 'settings';

export function StudentDashboard() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400" />
      </div>
    );
  }

  if (!user || user.role !== 'STUDENT') {
    return <Navigate to="/login" replace />;
  }

  return (
    <ChatProvider>
      <div className="flex h-screen">
        {/* Enhanced Sidebar with additional navigation */}
        <StudentSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {activeTab === 'chat' && <ChatCanvas />}
          {activeTab === 'lessons' && <MyLessons />}
          {activeTab === 'homework' && <MyHomework />}
          {activeTab === 'teacher' && <FindTeacher />}
          {activeTab === 'settings' && <StudentSettings />}
        </main>
      </div>
    </ChatProvider>
  );
}

interface StudentSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

function StudentSidebar({ activeTab, onTabChange }: StudentSidebarProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const navItems = [
    {
      id: 'chat' as const,
      label: t('nav.aiTutor'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
    {
      id: 'lessons' as const,
      label: t('nav.myLessons'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
    },
    {
      id: 'homework' as const,
      label: t('nav.myHomework'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
    },
    {
      id: 'teacher' as const,
      label: t('nav.myTeacher'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
      ),
    },
    {
      id: 'settings' as const,
      label: t('nav.settings'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      ),
    },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-white/20 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/15">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 rounded-full flex items-center justify-center shadow-glass">
            <span className="text-emerald-100 font-semibold">
              {user?.name?.charAt(0) || 'S'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-solid truncate">
              {user?.name || t('student.greeting')}
            </p>
            <p className="text-xs text-prominent truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
              activeTab === item.id
                ? 'backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 text-emerald-100 shadow-glass'
                : 'text-prominent hover:backdrop-blur-md hover:bg-white/20 hover:border hover:border-white/20'
            }`}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Chat-specific sidebar content */}
      {activeTab === 'chat' && <ChatSidebarContent />}

      {/* Footer */}
      <div className="mt-auto p-4 border-t border-white/15">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-prominent hover:text-solid hover:backdrop-blur-md hover:bg-white/20 rounded-xl transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span className="font-medium">{t('common.signOut')}</span>
        </button>
      </div>
    </aside>
  );
}

function ChatSidebarContent() {
  const { loadSessions } = useChatContext();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 border-t border-white/15">
      {/* Topic Selector for new sessions */}
      <TopicSelector />

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Chat History */}
      <ChatHistory />
    </div>
  );
}
