import { useTranslation } from 'react-i18next';
import { useTeacherContext } from '@/context/TeacherContext';

interface TeacherSidebarProps {
  activeTab: 'dashboard' | 'students' | 'assistant' | 'insights';
  onTabChange: (tab: 'dashboard' | 'students' | 'assistant' | 'insights') => void;
}

export function TeacherSidebar({ activeTab, onTabChange }: TeacherSidebarProps) {
  const { t } = useTranslation();
  const { teacher, logout, interventionAlerts } = useTeacherContext();

  const navItems = [
    {
      id: 'dashboard' as const,
      label: t('nav.dashboard'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      ),
    },
    {
      id: 'students' as const,
      label: t('nav.students'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      badge: interventionAlerts.length > 0 ? interventionAlerts.length : undefined,
    },
    {
      id: 'assistant' as const,
      label: t('nav.aiAssistant'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
    },
    {
      id: 'insights' as const,
      label: t('teacher.insights.title'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
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
            <span className="text-emerald-700 font-semibold">
              {teacher?.name?.charAt(0) || 'T'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-solid truncate">
              {teacher?.name || t('auth.teacher')}
            </p>
            <p className="text-xs text-prominent truncate">
              {teacher?.email || 'teacher@academio.com'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
              activeTab === item.id
                ? 'backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 text-emerald-700 shadow-glass'
                : 'text-prominent hover:backdrop-blur-md hover:bg-white/20 hover:border hover:border-white/20'
            }`}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
            {item.badge && (
              <span className="ml-auto backdrop-blur-sm bg-red-500/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/15">
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
