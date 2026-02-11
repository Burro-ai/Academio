import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudents } from '@/hooks/useStudents';
import { teacherApi } from '@/services/teacherApi';
import { Student, StudentProfileWithUser, ActivitySummary } from '@/types';

interface StudentListProps {
  classroomId?: string;
  onSelectStudent: (studentId: string) => void;
}

// Type guard to check if student is StudentProfileWithUser
function isStudentProfileWithUser(student: Student | StudentProfileWithUser): student is StudentProfileWithUser {
  return 'user' in student && student.user !== undefined;
}

// Helper to normalize student data (handles both Student and StudentProfileWithUser)
function normalizeStudent(student: Student | StudentProfileWithUser): { id: string; name: string; email?: string; avatarUrl?: string; gradeLevel?: string } {
  // Check if it's a StudentProfileWithUser (has 'user' property)
  if (isStudentProfileWithUser(student)) {
    return {
      id: student.userId || student.id,
      name: student.user.name,
      email: student.user.email,
      avatarUrl: student.user.avatarUrl,
      gradeLevel: student.gradeLevel,
    };
  }
  // It's a regular Student
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    avatarUrl: student.avatarUrl,
    gradeLevel: student.gradeLevel,
  };
}

// Determine activity level based on last activity date
function getActivityLevel(lastActivity: string | null): 'active' | 'recent' | 'inactive' {
  if (!lastActivity) return 'inactive';

  const now = new Date();
  const activityDate = new Date(lastActivity);
  const diffMs = now.getTime() - activityDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return 'active'; // Active in last 24 hours
  if (diffDays < 7) return 'recent'; // Active in last 7 days
  return 'inactive';
}

export function StudentList({ classroomId, onSelectStudent }: StudentListProps) {
  const { t } = useTranslation();
  const { students, isLoading, error, loadStudents } = useStudents();
  const [activitySummary, setActivitySummary] = useState<ActivitySummary[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    loadStudents(classroomId);
  }, [classroomId, loadStudents]);

  // Load activity summary when students are loaded
  useEffect(() => {
    if (students.length > 0) {
      loadActivitySummary();
    }
  }, [students]);

  const loadActivitySummary = async () => {
    setActivityLoading(true);
    try {
      const data = await teacherApi.getStudentsActivitySummary();
      setActivitySummary(data);
    } catch (err) {
      console.error('Failed to load activity summary:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  // Create a map for quick activity lookup
  const activityMap = useMemo(() => {
    const map = new Map<string, ActivitySummary>();
    activitySummary.forEach(summary => {
      map.set(summary.studentId, summary);
    });
    return map;
  }, [activitySummary]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-200">{error}</p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 backdrop-blur-md bg-white/20 border border-white/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-glass">
          <svg className="w-8 h-8 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </div>
        <p className="text-prominent">{t('teacher.students.noStudentsFound')}</p>
        <p className="text-sm text-subtle mt-1">{t('teacher.students.addStudentsToStart')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {students.map((student) => {
        const normalized = normalizeStudent(student);
        const activity = activityMap.get(normalized.id);
        return (
          <StudentCard
            key={normalized.id}
            student={normalized}
            activity={activity}
            activityLoading={activityLoading}
            onClick={() => onSelectStudent(normalized.id)}
            t={t}
          />
        );
      })}
    </div>
  );
}

interface StudentCardProps {
  student: { id: string; name: string; email?: string; avatarUrl?: string; gradeLevel?: string };
  activity?: ActivitySummary;
  activityLoading: boolean;
  onClick: () => void;
  t: (key: string, options?: any) => string;
}

function StudentCard({ student, activity, activityLoading, onClick, t }: StudentCardProps) {
  const initials = student.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const activityLevel = activity ? getActivityLevel(activity.lastActivity) : 'inactive';
  const pendingHomework = activity?.pendingHomework || 0;

  const pulseColors = {
    active: 'bg-emerald-400',
    recent: 'bg-amber-400',
    inactive: 'bg-gray-400',
  };

  return (
    <button
      onClick={onClick}
      className="glass-card p-4 text-left hover:bg-white/30 hover:shadow-glass-lg transition-all relative"
    >
      {/* Activity Pulse Indicator */}
      {!activityLoading && (
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {pendingHomework > 0 && (
            <span
              className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/50 border border-amber-400/40 rounded-full text-amber-100"
              title={t('teacher.studentProfile.activityPulse.pendingHomework', { count: pendingHomework })}
            >
              {pendingHomework}
            </span>
          )}
          <span
            className={`w-3 h-3 rounded-full ${pulseColors[activityLevel]} ${
              activityLevel === 'active' ? 'animate-pulse' : ''
            }`}
            title={t(`teacher.studentProfile.activityPulse.${activityLevel}`)}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 rounded-full flex items-center justify-center flex-shrink-0 shadow-glass">
          {student.avatarUrl ? (
            <img
              src={student.avatarUrl}
              alt={student.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <span className="text-emerald-100 font-semibold">{initials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-solid truncate">{student.name}</p>
          <p className="text-sm text-prominent truncate">
            {student.gradeLevel || t('teacher.students.gradeNotSet')}
          </p>
        </div>
      </div>
    </button>
  );
}
