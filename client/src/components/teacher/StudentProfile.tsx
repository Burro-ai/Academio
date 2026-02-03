import { useEffect } from 'react';
import { useStudents } from '@/hooks/useStudents';
import { GradesBySubject } from '@/types';

interface StudentProfileProps {
  studentId: string;
  onBack: () => void;
}

export function StudentProfile({ studentId, onBack }: StudentProfileProps) {
  const { selectedStudent, studentGrades, studentActivity, isLoading, selectStudent } = useStudents();

  useEffect(() => {
    selectStudent(studentId);
  }, [studentId, selectStudent]);

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
        Back to Students
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
              <span className="text-emerald-100 text-2xl font-semibold">{initials}</span>
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
                <div className="flex items-center gap-2 text-red-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="font-medium">This student needs attention</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">Total Sessions</p>
          <p className="text-2xl font-bold text-solid">{selectedStudent.totalSessions || 0}</p>
        </div>
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">Questions This Week</p>
          <p className="text-2xl font-bold text-solid">
            {studentActivity?.totalQuestionsThisWeek || 0}
          </p>
        </div>
        <div className="glass-stat-card p-5">
          <p className="text-sm text-prominent">Struggle Score</p>
          <p className={`text-2xl font-bold ${
            (studentActivity?.averageStruggleScore || 0) > 0.7
              ? 'text-red-300'
              : (studentActivity?.averageStruggleScore || 0) > 0.4
                ? 'text-yellow-300'
                : 'text-green-300'
          }`}>
            {((studentActivity?.averageStruggleScore || 0) * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grades by Subject */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">Grades by Subject</h2>
          {studentGrades.length === 0 ? (
            <p className="text-prominent text-center py-8">No grades recorded</p>
          ) : (
            <div className="space-y-4">
              {studentGrades.map((subject: GradesBySubject) => (
                <GradeSubjectRow key={subject.subject} data={subject} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">Recent Learning Activity</h2>
          {!studentActivity || studentActivity.recentSessions.length === 0 ? (
            <p className="text-prominent text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {studentActivity.recentSessions.map((session) => (
                <div key={session.id} className="p-3 glass-surface">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-solid capitalize">{session.topic}</span>
                    <span className={`text-sm px-2 py-1 rounded-lg backdrop-blur-sm border ${
                      session.struggleScore > 0.7
                        ? 'bg-red-500/20 border-red-400/30 text-red-100'
                        : session.struggleScore > 0.4
                          ? 'bg-yellow-500/20 border-yellow-400/30 text-yellow-100'
                          : 'bg-green-500/20 border-green-400/30 text-green-100'
                    }`}>
                      {session.struggleScore > 0.7 ? 'Struggling' : session.struggleScore > 0.4 ? 'Some difficulty' : 'Good'}
                    </span>
                  </div>
                  <p className="text-sm text-prominent mt-1">
                    {session.questionsAsked} questions asked
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GradeSubjectRow({ data }: { data: GradesBySubject }) {
  const trendIcon = {
    improving: (
      <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    declining: (
      <svg className="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <p className="text-sm text-prominent">{data.grades.length} assignments</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-lg font-semibold ${
          data.average >= 90
            ? 'text-green-300'
            : data.average >= 70
              ? 'text-yellow-300'
              : 'text-red-300'
        }`}>
          {data.average.toFixed(1)}%
        </span>
        {trendIcon[data.trend]}
      </div>
    </div>
  );
}
