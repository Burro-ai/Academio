import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { useStudents } from '@/hooks/useStudents';
import { GlassCard } from '@/components/glass';
import { StudentLessonChats } from './StudentLessonChats';
import { teacherApi } from '@/services/teacherApi';
import { GradesBySubject, StudentStats } from '@/types';
import { StudentLessonAnalytic } from '../../../../shared/types/student.types';

interface StudentProfileProps {
  studentId: string;
  onBack: () => void;
  initialTab?: TabType;
}

type TabType = 'learningContext' | 'chatTranscripts' | 'academicPerformance' | 'analytics';

export function StudentProfile({ studentId, onBack, initialTab }: StudentProfileProps) {
  const { t } = useTranslation();
  const { selectedStudent, studentGrades, studentActivity, isLoading, selectStudent } = useStudents();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab ?? 'learningContext');
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<StudentLessonAnalytic[] | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    selectStudent(studentId);
    loadStats();
  }, [studentId, selectStudent]);

  // Load analytics when tab is activated
  useEffect(() => {
    if (activeTab === 'analytics' && analytics === null && !analyticsLoading) {
      loadAnalytics();
    }
  }, [activeTab]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await teacherApi.getStudentStats(studentId);
      setStats(data);
    } catch (err) {
      console.error('Failed to load student stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await teacherApi.getStudentLessonAnalytics(studentId);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load lesson analytics:', err);
      setAnalytics([]);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  if (isLoading || !selectedStudent) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
      </div>
    );
  }

  const initials = selectedStudent.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'learningContext', label: t('teacher.studentProfile.tabs.learningContext') },
    { id: 'chatTranscripts', label: t('teacher.studentProfile.tabs.chatTranscripts') },
    { id: 'academicPerformance', label: t('teacher.studentProfile.tabs.academicPerformance') },
    { id: 'analytics', label: t('teacher.studentProfile.tabs.analytics') },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-prominent hover:text-solid transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('teacher.studentProfile.backToStudents')}
      </button>

      {/* Student Header */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 rounded-full flex items-center justify-center flex-shrink-0 shadow-glass">
            {selectedStudent.avatarUrl ? (
              <img
                src={selectedStudent.avatarUrl}
                alt={selectedStudent.name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <span className="text-emerald-700 text-2xl font-semibold">{initials}</span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-solid">{selectedStudent.name}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-prominent">
              {selectedStudent.email && <span>{selectedStudent.email}</span>}
              {selectedStudent.gradeLevel && <span>Grade: {selectedStudent.gradeLevel}</span>}
              {selectedStudent.classroom && (
                <span>Classroom: {selectedStudent.classroom.name}</span>
              )}
            </div>
            {studentActivity?.needsIntervention && (
              <div className="mt-4 p-3 backdrop-blur-md bg-red-500/20 border border-red-400/30 rounded-xl">
                <div className="flex items-center gap-2 text-red-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="font-medium">{t('teacher.studentProfile.learningContext.interventionNeeded')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-emerald-500/30 border border-emerald-400/40 text-solid'
                : 'glass-surface text-prominent hover:text-solid hover:bg-white/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'learningContext' && (
            <LearningContextTab
              student={selectedStudent}
              activity={studentActivity}
              t={t}
            />
          )}
          {activeTab === 'chatTranscripts' && (
            <ChatTranscriptsTab
              studentId={studentId}
              studentName={selectedStudent.name}
              stats={stats}
              statsLoading={statsLoading}
              t={t}
            />
          )}
          {activeTab === 'academicPerformance' && (
            <AcademicPerformanceTab
              grades={studentGrades}
              stats={stats}
              statsLoading={statsLoading}
              t={t}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsTab
              analytics={analytics}
              isLoading={analyticsLoading}
              t={t}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Tab 1: Learning Context
function LearningContextTab({
  student,
  activity,
  t,
}: {
  student: any;
  activity: any;
  t: (key: string) => string;
}) {
  const struggleScore = activity?.averageStruggleScore || student.currentStruggleScore || 0;
  const struggleLevel = struggleScore > 0.7 ? 'high' : struggleScore > 0.4 ? 'medium' : 'low';
  const struggleColors = {
    high: 'text-red-600 bg-red-500/20 border-red-400/30',
    medium: 'text-yellow-600 bg-yellow-500/20 border-yellow-400/30',
    low: 'text-green-600 bg-green-500/20 border-green-400/30',
  };
  const struggleLabels = {
    high: t('teacher.studentProfile.learningContext.highStruggle'),
    medium: t('teacher.studentProfile.learningContext.mediumStruggle'),
    low: t('teacher.studentProfile.learningContext.lowStruggle'),
  };

  const hasProfileData = student.age || student.favoriteSports?.length || student.skillsToImprove?.length || student.learningSystemPrompt;

  if (!hasProfileData) {
    return (
      <GlassCard variant="card" className="p-6 text-center">
        <svg
          className="w-12 h-12 mx-auto text-prominent mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <p className="text-prominent">{t('teacher.studentProfile.noData')}</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">{t('teacher.studentProfile.stats.totalSessions')}</p>
          <p className="text-2xl font-bold text-solid">{student.totalSessions || 0}</p>
        </div>
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">{t('teacher.studentProfile.stats.questionsThisWeek')}</p>
          <p className="text-2xl font-bold text-solid">
            {activity?.totalQuestionsThisWeek || 0}
          </p>
        </div>
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">{t('teacher.studentProfile.stats.struggleScore')}</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-bold ${struggleColors[struggleLevel].split(' ')[0]}`}>
              {(struggleScore * 100).toFixed(0)}%
            </p>
            <span className={`text-xs px-2 py-1 rounded-lg backdrop-blur-sm border ${struggleColors[struggleLevel]}`}>
              {struggleLabels[struggleLevel]}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <GlassCard variant="card" className="p-6">
        <h2 className="text-lg font-semibold text-solid mb-4">
          {t('teacher.studentProfile.learningContext.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {student.age && (
            <div className="p-3 glass-surface">
              <p className="text-sm text-prominent">{t('teacher.studentProfile.learningContext.age')}</p>
              <p className="text-lg font-medium text-solid">
                {student.age} {t('teacher.studentProfile.learningContext.yearsOld')}
              </p>
            </div>
          )}
          {student.favoriteSports && student.favoriteSports.length > 0 && (
            <div className="p-3 glass-surface">
              <p className="text-sm text-prominent">{t('teacher.studentProfile.learningContext.interests')}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {student.favoriteSports.map((sport: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-sm backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 rounded-lg text-emerald-700"
                  >
                    {sport}
                  </span>
                ))}
              </div>
            </div>
          )}
          {student.skillsToImprove && student.skillsToImprove.length > 0 && (
            <div className="p-3 glass-surface">
              <p className="text-sm text-prominent">{t('teacher.studentProfile.learningContext.skillsToImprove')}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {student.skillsToImprove.map((skill: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-sm backdrop-blur-sm bg-blue-500/20 border border-blue-400/30 rounded-lg text-blue-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        {student.learningSystemPrompt && (
          <div className="mt-4 p-3 glass-surface">
            <p className="text-sm text-prominent mb-1">{t('teacher.studentProfile.learningContext.learningPreferences')}</p>
            <p className="text-solid text-sm">{student.learningSystemPrompt}</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// Tab 2: Chat Transcripts
function ChatTranscriptsTab({
  studentId,
  studentName,
  stats,
  statsLoading,
  t,
}: {
  studentId: string;
  studentName: string;
  stats: StudentStats | null;
  statsLoading: boolean;
  t: (key: string, options?: any) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Chat Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">{t('teacher.studentProfile.chatTranscripts.totalMessages')}</p>
          <p className="text-2xl font-bold text-solid">
            {statsLoading ? '...' : stats?.chatHistoryCount || 0}
          </p>
        </div>
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">{t('teacher.studentProfile.chatTranscripts.sessionsCompleted')}</p>
          <p className="text-2xl font-bold text-solid">
            {statsLoading ? '...' : stats?.lessonChatsCompleted || 0}
          </p>
        </div>
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">{t('teacher.studentProfile.chatTranscripts.lastActivity')}</p>
          <p className="text-lg font-bold text-solid">
            {statsLoading
              ? '...'
              : stats?.lastChatDate
                ? new Date(stats.lastChatDate).toLocaleDateString()
                : t('teacher.studentProfile.noData')}
          </p>
        </div>
      </div>

      {/* Lesson Chats List */}
      <GlassCard variant="card" className="p-6">
        <StudentLessonChats studentId={studentId} studentName={studentName} />
      </GlassCard>
    </div>
  );
}

// Tab 3: Academic Performance
function AcademicPerformanceTab({
  grades,
  stats,
  statsLoading,
  t,
}: {
  grades: GradesBySubject[];
  stats: StudentStats | null;
  statsLoading: boolean;
  t: (key: string, options?: any) => string;
}) {
  const completionRate = stats
    ? stats.homeworkAssigned > 0
      ? Math.round((stats.homeworkSubmitted / stats.homeworkAssigned) * 100)
      : 0
    : 0;

  return (
    <div className="space-y-4">
      {/* Homework Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">{t('teacher.studentProfile.academicPerformance.homeworkCompletion')}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-solid">
              {statsLoading ? '...' : `${stats?.homeworkSubmitted || 0}`}
            </p>
            <p className="text-sm text-prominent">
              {t('teacher.studentProfile.academicPerformance.ofAssigned', { total: stats?.homeworkAssigned || 0 })}
            </p>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">{t('teacher.studentProfile.academicPerformance.averageGrade')}</p>
          <p className={`text-2xl font-bold ${
            (stats?.averageGrade || 0) >= 90
              ? 'text-green-600'
              : (stats?.averageGrade || 0) >= 70
                ? 'text-yellow-600'
                : 'text-red-600'
          }`}>
            {statsLoading
              ? '...'
              : stats?.averageGrade !== null && stats?.averageGrade !== undefined
                ? `${stats.averageGrade.toFixed(1)}%`
                : '-'}
          </p>
        </div>
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">{t('teacher.studentProfile.activityPulse.pendingHomework', { count: stats?.homeworkPending || 0 })}</p>
          <p className="text-2xl font-bold text-amber-600">
            {statsLoading ? '...' : stats?.homeworkPending || 0}
          </p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Homework */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">
            {t('teacher.studentProfile.academicPerformance.recentHomework')}
          </h2>
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-400" />
            </div>
          ) : !stats?.recentHomework || stats.recentHomework.length === 0 ? (
            <p className="text-prominent text-center py-8">{t('teacher.studentProfile.noData')}</p>
          ) : (
            <div className="space-y-3">
              {stats.recentHomework.map((hw) => (
                <div key={hw.id} className="p-3 glass-surface">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-solid truncate">{hw.title}</p>
                      <p className="text-sm text-prominent truncate">{hw.topic}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hw.grade !== null && (
                        <span className={`text-sm font-semibold ${
                          hw.grade >= 90 ? 'text-green-600' : hw.grade >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {hw.grade}%
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-lg backdrop-blur-sm border ${
                        hw.status === 'graded'
                          ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-700'
                          : hw.status === 'submitted'
                            ? 'bg-blue-500/20 border-blue-400/30 text-blue-700'
                            : 'bg-amber-500/20 border-amber-400/30 text-amber-700'
                      }`}>
                        {t(`teacher.studentProfile.academicPerformance.${hw.status}`)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Grades by Subject */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">
            {t('teacher.studentProfile.academicPerformance.gradesBySubject')}
          </h2>
          {grades.length === 0 ? (
            <p className="text-prominent text-center py-8">
              {t('teacher.studentProfile.academicPerformance.noGrades')}
            </p>
          ) : (
            <div className="space-y-4">
              {grades.map((subject: GradesBySubject) => (
                <GradeSubjectRow key={subject.subject} data={subject} t={t} />
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// Tab 4: Analytics
function AnalyticsTab({
  analytics,
  isLoading,
  t,
}: {
  analytics: StudentLessonAnalytic[] | null;
  isLoading: boolean;
  t: (key: string) => string;
}) {
  if (isLoading || analytics === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
      </div>
    );
  }

  if (analytics.length === 0) {
    return (
      <GlassCard variant="card" className="p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-prominent mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-prominent">{t('teacher.studentProfile.analytics.noData')}</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {analytics.map((item) => (
        <LessonAnalyticCard key={item.lessonId} item={item} t={t} />
      ))}
    </div>
  );
}

function LessonAnalyticCard({ item, t }: { item: StudentLessonAnalytic; t: (key: string) => string }) {
  const struggle = item.struggleScore ?? 0;
  const struggleColor =
    struggle < 0.4 ? 'bg-emerald-400' :
    struggle < 0.7 ? 'bg-yellow-400' :
    'bg-red-400';
  const struggleBorder =
    struggle < 0.4 ? 'border-emerald-400/30' :
    struggle < 0.7 ? 'border-yellow-400/30' :
    'border-red-400/30';

  return (
    <GlassCard variant="card" className={`p-5 border ${item.struggleScore !== null ? struggleBorder : 'border-white/10'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-solid truncate">{item.lessonTitle}</p>
          <p className="text-sm text-prominent truncate">{item.lessonTopic}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.subject && (
            <span className="text-xs px-2 py-0.5 rounded-full backdrop-blur-sm bg-blue-500/20 border border-blue-400/30 text-blue-700">
              {item.subject}
            </span>
          )}
          {item.submissionGrade !== null && (
            <span className={`text-sm font-bold ${
              item.submissionGrade >= 70 ? 'text-green-600' :
              item.submissionGrade >= 50 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {item.submissionGrade.toFixed(0)}/100
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Struggle score bar */}
        {item.struggleScore !== null && (
          <div>
            <div className="flex justify-between text-xs text-prominent mb-1">
              <span>{t('teacher.studentProfile.analytics.struggleGlobal')}</span>
              <span>{Math.round(item.struggleScore * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${struggleColor}`}
                style={{ width: `${item.struggleScore * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Struggle dimensions */}
        {item.struggleDimensions && (
          <div>
            <p className="text-xs font-semibold text-prominent mb-1.5 uppercase tracking-wide">
              {t('teacher.studentProfile.analytics.dimensions')}
            </p>
            <div className="space-y-1.5">
              {[
                { key: 'socraticDepth', label: t('teacher.studentProfile.analytics.socraticDepth'), value: item.struggleDimensions.socraticDepth },
                { key: 'errorPersistence', label: t('teacher.studentProfile.analytics.errorPersistence'), value: item.struggleDimensions.errorPersistence },
                { key: 'frustrationSentiment', label: t('teacher.studentProfile.analytics.frustrationSentiment'), value: item.struggleDimensions.frustrationSentiment },
              ].map(({ key, label, value }) => (
                <div key={key}>
                  <div className="flex justify-between text-xs text-prominent mb-0.5">
                    <span>{label}</span>
                    <span>{Math.round(value * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-400/60 transition-all"
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exit ticket + rubric row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-prominent">{t('teacher.studentProfile.analytics.exitTicket')}:</span>
            {item.exitTicketPassed === null ? (
              <span className="text-xs px-2 py-0.5 rounded-full backdrop-blur-sm bg-white/10 text-prominent">
                {t('teacher.studentProfile.analytics.exitTicketPending')}
              </span>
            ) : item.exitTicketPassed ? (
              <span className="text-xs px-2 py-0.5 rounded-full backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-700">
                {t('teacher.studentProfile.analytics.exitTicketPassed')}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full backdrop-blur-sm bg-red-500/20 border border-red-400/30 text-red-700">
                {t('teacher.studentProfile.analytics.exitTicketFailed')}
              </span>
            )}
          </div>
          {item.lastActivity && (
            <span className="text-xs text-prominent ml-auto">
              {new Date(item.lastActivity).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Rubric scores */}
        {item.rubricScores && (
          <div>
            <p className="text-xs font-semibold text-prominent mb-1.5 uppercase tracking-wide">
              {t('teacher.studentProfile.analytics.rubric')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t('teacher.studentProfile.analytics.rubricAccuracy'), value: item.rubricScores.accuracy },
                { label: t('teacher.studentProfile.analytics.rubricReasoning'), value: item.rubricScores.reasoning },
                { label: t('teacher.studentProfile.analytics.rubricEffort'), value: item.rubricScores.effort },
              ].map(({ label, value }) => (
                <div key={label} className="p-2 glass-surface text-center">
                  <p className="text-xs text-prominent truncate">{label}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${
                    value >= 70 ? 'text-green-600' : value >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {value}/100
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function GradeSubjectRow({ data, t }: { data: GradesBySubject; t: (key: string, options?: any) => string }) {
  const trendIcon = {
    improving: (
      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    declining: (
      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    stable: (
      <svg className="w-4 h-4 text-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  };

  return (
    <div className="flex items-center justify-between p-3 glass-surface">
      <div>
        <p className="font-medium text-solid capitalize">{data.subject}</p>
        <p className="text-sm text-prominent">
          {t('teacher.studentProfile.academicPerformance.assignments', { count: data.grades.length })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-lg font-semibold ${
          data.average >= 90
            ? 'text-green-600'
            : data.average >= 70
              ? 'text-yellow-600'
              : 'text-red-600'
        }`}>
          {data.average.toFixed(1)}%
        </span>
        {trendIcon[data.trend]}
      </div>
    </div>
  );
}
