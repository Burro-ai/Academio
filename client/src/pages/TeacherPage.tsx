import { useState, useEffect } from 'react';
import { useTeacherContext } from '@/context/TeacherContext';
import { TeacherLogin } from '@/components/teacher/TeacherLogin';
import { TeacherSidebar } from '@/components/teacher/TeacherSidebar';
import { Dashboard } from '@/components/teacher/Dashboard';
import { StudentsView } from '@/components/teacher/StudentsView';
import { TeacherChat } from '@/components/teacher/TeacherChat';

type Tab = 'dashboard' | 'students' | 'assistant';

export function TeacherPage() {
  const { isAuthenticated, isLoading, loadInterventionAlerts } = useTeacherContext();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    if (isAuthenticated) {
      loadInterventionAlerts();
    }
  }, [isAuthenticated, loadInterventionAlerts]);

  const handleViewStudent = (_studentId: string) => {
    setActiveTab('students');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <TeacherLogin />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && <Dashboard onViewStudent={handleViewStudent} />}
        {activeTab === 'students' && <StudentsView />}
        {activeTab === 'assistant' && (
          <div className="h-screen">
            <TeacherChat />
          </div>
        )}
      </main>
    </div>
  );
}
