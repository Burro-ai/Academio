import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { TeacherProvider, useTeacherContext } from '@/context/TeacherContext';
import { Dashboard } from '@/components/teacher/Dashboard';
import { StudentsView } from '@/components/teacher/StudentsView';
import { TeacherChat } from '@/components/teacher/TeacherChat';
import { LessonsPanel } from '@/components/teacher/LessonsPanel';
import { HomeworkPanel } from '@/components/teacher/HomeworkPanel';
import { ClassroomManager } from '@/components/teacher/ClassroomManager';

type Tab = 'dashboard' | 'students' | 'classrooms' | 'lessons' | 'homework' | 'assistant';

function TeacherDashboardContent() {
  const { t } = useTranslation();
  const { user, isLoading: authLoading, isInitializing, refreshUser } = useAuth();
  const { loadInterventionAlerts } = useTeacherContext();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [roleValidated, setRoleValidated] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Pre-flight role validation on mount
  useEffect(() => {
    const validateRole = async () => {
      // Wait for initialization to complete
      if (isInitializing) return;

      // If no user, will redirect anyway
      if (!user) {
        setRoleValidated(true);
        return;
      }

      // Check role (case-insensitive)
      const normalizedRole = user.role?.toUpperCase();
      if (normalizedRole !== 'TEACHER') {
        console.error('[TeacherDashboard] Role mismatch:', user.role);
        setRoleError(user.role || '');
        setRoleValidated(true);
        return;
      }

      // Refresh user data to ensure sync with server
      try {
        await refreshUser();
        console.log('[TeacherDashboard] Role validated successfully');
      } catch (err) {
        console.error('[TeacherDashboard] Failed to refresh user:', err);
      }

      setRoleValidated(true);
    };

    validateRole();
  }, [isInitializing, user, refreshUser]);

  useEffect(() => {
    if (roleValidated && user?.role?.toUpperCase() === 'TEACHER') {
      loadInterventionAlerts();
    }
  }, [roleValidated, user, loadInterventionAlerts]);

  const handleViewStudent = (_studentId: string) => {
    setActiveTab('students');
  };

  // Show loading while initializing or validating role
  if (authLoading || isInitializing || !roleValidated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400" />
      </div>
    );
  }

  // Show role error
  if (roleError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 backdrop-blur-md bg-red-500/30 border border-red-400/30 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-solid mb-2">{t('accessDenied.title')}</h2>
          <p className="text-prominent mb-4">{t('accessDenied.message', { role: roleError })}</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 backdrop-blur-md bg-blue-500/30 border border-blue-400/30 rounded-xl text-blue-700 hover:bg-blue-500/40"
          >
            {t('accessDenied.returnToLogin')}
          </button>
        </div>
      </div>
    );
  }

  // Check role (case-insensitive)
  if (!user || user.role?.toUpperCase() !== 'TEACHER') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex">
      <TeacherSidebarEnhanced activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && <Dashboard onViewStudent={handleViewStudent} />}
        {activeTab === 'students' && <StudentsView />}
        {activeTab === 'classrooms' && <ClassroomManager />}
        {activeTab === 'lessons' && <LessonsPanel />}
        {activeTab === 'homework' && <HomeworkPanel />}
        {activeTab === 'assistant' && (
          <div className="h-screen">
            <TeacherChat />
          </div>
        )}
      </main>
    </div>
  );
}

interface TeacherSidebarEnhancedProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

function TeacherSidebarEnhanced({ activeTab, onTabChange }: TeacherSidebarEnhancedProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { interventionAlerts } = useTeacherContext();

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
      id: 'classrooms' as const,
      label: t('nav.classrooms'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
    },
    {
      id: 'lessons' as const,
      label: t('nav.lessons'),
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
      label: t('nav.homework'),
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
  ];

  return (
    <aside className="w-64 glass-panel border-r border-white/20 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/15">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 backdrop-blur-md bg-blue-500/30 border border-blue-400/30 rounded-full flex items-center justify-center shadow-glass">
            <span className="text-blue-700 font-semibold">
              {user?.name?.charAt(0) || 'T'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-solid truncate">
              {user?.name || t('auth.teacher')}
            </p>
            <p className="text-xs text-prominent truncate">{user?.email}</p>
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
                ? 'backdrop-blur-md bg-blue-500/30 border border-blue-400/30 text-blue-700 shadow-glass'
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

export function TeacherDashboard() {
  return (
    <TeacherProvider>
      <TeacherDashboardContent />
    </TeacherProvider>
  );
}
