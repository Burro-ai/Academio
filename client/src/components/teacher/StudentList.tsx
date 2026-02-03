import { useEffect } from 'react';
import { useStudents } from '@/hooks/useStudents';
import { Student } from '@/types';

interface StudentListProps {
  classroomId?: string;
  onSelectStudent: (studentId: string) => void;
}

export function StudentList({ classroomId, onSelectStudent }: StudentListProps) {
  const { students, isLoading, error, loadStudents } = useStudents();

  useEffect(() => {
    loadStudents(classroomId);
  }, [classroomId, loadStudents]);

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
        <p className="text-prominent">No students found</p>
        <p className="text-sm text-subtle mt-1">Add students to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {students.map((student) => (
        <StudentCard key={student.id} student={student} onClick={() => onSelectStudent(student.id)} />
      ))}
    </div>
  );
}

interface StudentCardProps {
  student: Student;
  onClick: () => void;
}

function StudentCard({ student, onClick }: StudentCardProps) {
  const initials = student.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className="glass-card p-4 text-left hover:bg-white/30 hover:shadow-glass-lg transition-all"
    >
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
            {student.gradeLevel || 'Grade not set'}
          </p>
        </div>
      </div>
    </button>
  );
}
