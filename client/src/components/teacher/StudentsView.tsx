import { useState } from 'react';
import { StudentList } from './StudentList';
import { StudentProfile } from './StudentProfile';
import { useTeacherContext } from '@/context/TeacherContext';

export function StudentsView() {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | undefined>();
  const { classrooms, interventionAlerts } = useTeacherContext();

  if (selectedStudentId) {
    return (
      <StudentProfile
        studentId={selectedStudentId}
        onBack={() => setSelectedStudentId(null)}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-600">View and manage your students</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={selectedClassroomId || ''}
          onChange={(e) => setSelectedClassroomId(e.target.value || undefined)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
        >
          <option value="">All Classrooms</option>
          {classrooms.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.name}
            </option>
          ))}
        </select>
      </div>

      {/* Intervention Alerts */}
      {interventionAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="font-medium text-red-700">
              {interventionAlerts.length} student{interventionAlerts.length > 1 ? 's' : ''} need{interventionAlerts.length === 1 ? 's' : ''} attention
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {interventionAlerts.slice(0, 5).map((alert) => (
              <button
                key={`${alert.studentId}-${alert.createdAt}`}
                onClick={() => setSelectedStudentId(alert.studentId)}
                className="px-3 py-1.5 bg-white border border-red-200 rounded-full text-sm text-red-700 hover:bg-red-100 transition-colors"
              >
                {alert.studentName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Student List */}
      <StudentList
        classroomId={selectedClassroomId}
        onSelectStudent={setSelectedStudentId}
      />
    </div>
  );
}
