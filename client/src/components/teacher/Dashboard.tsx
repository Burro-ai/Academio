import { useTranslation } from 'react-i18next';
import { useTeacherContext } from '@/context/TeacherContext';
import { InterventionAlert, Classroom, ClassroomStats } from '@/types';

type ClassroomWithStats = Classroom & { stats?: ClassroomStats };

interface DashboardProps {
  onViewStudent: (studentId: string) => void;
}

export function Dashboard({ onViewStudent }: DashboardProps) {
  const { t } = useTranslation();
  const { classrooms, totalStats, interventionAlerts } = useTeacherContext();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-solid">{t('teacher.dashboard.title')}</h1>
        <p className="text-prominent">{t('teacher.dashboard.subtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('teacher.dashboard.stats.totalStudents')}
          value={totalStats.totalStudents}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          }
          color="blue"
        />
        <StatCard
          title={t('teacher.dashboard.stats.studentsExcelling')}
          value={totalStats.studentsExcelling}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          }
          color="green"
        />
        <StatCard
          title={t('teacher.dashboard.stats.needAttention')}
          value={totalStats.studentsStruggling}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          }
          color="red"
        />
        <StatCard
          title={t('teacher.dashboard.stats.activeSessions')}
          value={totalStats.recentActivity}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          }
          color="purple"
          subtitle={t('teacher.dashboard.stats.last7Days')}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classrooms */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">{t('teacher.dashboard.yourClassrooms')}</h2>
          {classrooms.length === 0 ? (
            <p className="text-prominent text-center py-8">{t('teacher.dashboard.noClassroomsYet')}</p>
          ) : (
            <div className="space-y-3">
              {(classrooms as ClassroomWithStats[]).map((classroom) => (
                <div
                  key={classroom.id}
                  className="flex items-center justify-between p-3 glass-surface"
                >
                  <div>
                    <p className="font-medium text-solid">{classroom.name}</p>
                    <p className="text-sm text-prominent">
                      {classroom.subject || 'General'} • {classroom.studentCount || 0} students
                    </p>
                  </div>
                  {classroom.stats && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-solid">
                        {classroom.stats.averageGrade.toFixed(1)}%
                      </p>
                      <p className="text-xs text-subtle">{t('teacher.dashboard.avgGrade')}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Intervention Alerts */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">
            {t('teacher.dashboard.studentsNeedingAttention')}
          </h2>
          {interventionAlerts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 backdrop-blur-md bg-green-500/30 border border-green-400/30 rounded-full flex items-center justify-center mx-auto mb-3 shadow-glass">
                <svg
                  className="w-6 h-6 text-green-100"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-prominent">{t('teacher.dashboard.allStudentsDoingWell')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {interventionAlerts.slice(0, 5).map((alert: InterventionAlert) => (
                <div
                  key={`${alert.studentId}-${alert.createdAt}`}
                  className="p-3 backdrop-blur-md bg-red-500/20 border border-red-400/30 rounded-xl"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-solid">{alert.studentName}</p>
                      <p className="text-sm text-red-200">{alert.reason}</p>
                      {alert.topic && (
                        <p className="text-xs text-subtle mt-1">Topic: {alert.topic}</p>
                      )}
                    </div>
                    <button
                      onClick={() => onViewStudent(alert.studentId)}
                      className="glass-btn px-3 py-1 text-sm font-medium text-emerald-100 bg-emerald-500/30 border-emerald-400/30"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'purple';
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/30 border-blue-400/30 text-blue-100',
    green: 'bg-green-500/30 border-green-400/30 text-green-100',
    red: 'bg-red-500/30 border-red-400/30 text-red-100',
    purple: 'bg-purple-500/30 border-purple-400/30 text-purple-100',
  };

  return (
    <div className="glass-stat-card p-5">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center backdrop-blur-md border shadow-glass ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-solid">{value}</p>
          <p className="text-sm text-prominent">{title}</p>
          {subtitle && <p className="text-xs text-subtle">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
