import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton, GlassInput } from '@/components/glass';
import { teacherApi } from '@/services/teacherApi';
import { Classroom, StudentProfileWithUser } from '@/types';

export function ClassroomManager() {
  const { t } = useTranslation();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<StudentProfileWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [classroomData, studentData] = await Promise.all([
        teacherApi.getClassrooms(),
        teacherApi.getStudents(),
      ]);
      setClassrooms(classroomData);
      setStudents(studentData as StudentProfileWithUser[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const getStudentsInClassroom = (classroomId: string) => {
    return students.filter(s => s.classroomId === classroomId);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-solid">{t('teacher.classrooms.title')}</h1>
            <p className="text-prominent">{t('teacher.classrooms.subtitle')}</p>
          </div>
          <GlassButton variant="primary" onClick={() => setShowCreateModal(true)}>
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('teacher.classrooms.createClassroom')}
            </span>
          </GlassButton>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 backdrop-blur-md bg-red-500/20 border border-red-400/30 rounded-xl">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Classrooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classrooms.map((classroom) => {
            const classStudents = getStudentsInClassroom(classroom.id);
            return (
              <motion.div
                key={classroom.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <GlassCard
                  variant="card"
                  className="p-5 cursor-pointer transition-all hover:bg-white/25"
                  onClick={() => {
                    setSelectedClassroom(classroom);
                    setShowAssignModal(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-solid">{classroom.name}</h3>
                      <p className="text-sm text-prominent">
                        {classroom.subject || 'General'} - {classroom.gradeLevel || 'All grades'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 rounded-full text-xs text-emerald-700">
                        {t('teacher.classrooms.studentsCount', { count: classStudents.length })}
                      </span>
                    </div>
                  </div>

                  {/* Student avatars preview */}
                  {classStudents.length > 0 && (
                    <div className="flex -space-x-2">
                      {classStudents.slice(0, 5).map((student) => (
                        <div
                          key={student.userId}
                          className="w-8 h-8 rounded-full backdrop-blur-md bg-white/20 border border-white/30 flex items-center justify-center text-xs font-medium text-solid"
                          title={student.user?.name}
                        >
                          {student.user?.name?.charAt(0) || 'S'}
                        </div>
                      ))}
                      {classStudents.length > 5 && (
                        <div className="w-8 h-8 rounded-full backdrop-blur-md bg-white/20 border border-white/30 flex items-center justify-center text-xs text-prominent">
                          +{classStudents.length - 5}
                        </div>
                      )}
                    </div>
                  )}

                  {classStudents.length === 0 && (
                    <p className="text-sm text-subtle">{t('teacher.classrooms.clickToAssign')}</p>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}

          {classrooms.length === 0 && (
            <div className="col-span-2 text-center py-12">
              <p className="text-prominent mb-4">{t('teacher.classrooms.noClassroomsYet')}</p>
            </div>
          )}
        </div>

        {/* Create Modal */}
        <CreateClassroomModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={(classroom) => {
            setClassrooms([...classrooms, classroom]);
            setShowCreateModal(false);
          }}
        />

        {/* Assign Students Modal */}
        <AssignStudentsModal
          isOpen={showAssignModal}
          classroom={selectedClassroom}
          students={students}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedClassroom(null);
          }}
          onUpdated={loadData}
        />
      </div>
    </div>
  );
}

// Create Classroom Modal
function CreateClassroomModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (classroom: Classroom) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name) {
      setError(t('teacher.classrooms.modal.nameRequired'));
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const classroom = await teacherApi.createClassroom({
        name,
        subject: subject || undefined,
        gradeLevel: gradeLevel || undefined,
      });
      onCreated(classroom);
      setName('');
      setSubject('');
      setGradeLevel('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create classroom');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md"
      >
        <GlassCard variant="card" className="p-6">
          <h2 className="text-xl font-bold text-solid mb-4">{t('teacher.classrooms.modal.createTitle')}</h2>

          {error && (
            <div className="p-3 mb-4 backdrop-blur-md bg-red-500/20 border border-red-400/30 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">{t('teacher.classrooms.modal.nameLabel')}</label>
              <GlassInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('teacher.classrooms.modal.namePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">{t('teacher.classrooms.modal.subjectLabel')}</label>
              <GlassInput
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('teacher.classrooms.modal.subjectPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">{t('teacher.classrooms.modal.gradeLevelLabel')}</label>
              <GlassInput
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder={t('teacher.classrooms.modal.gradeLevelPlaceholder')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <GlassButton variant="default" onClick={onClose}>
              {t('common.cancel')}
            </GlassButton>
            <GlassButton variant="primary" onClick={handleCreate} disabled={isCreating || !name}>
              {isCreating ? t('teacher.classrooms.modal.creating') : t('common.create')}
            </GlassButton>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

// Assign Students Modal
function AssignStudentsModal({
  isOpen,
  classroom,
  students,
  onClose,
  onUpdated,
}: {
  isOpen: boolean;
  classroom: Classroom | null;
  students: StudentProfileWithUser[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { t } = useTranslation();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  if (!isOpen || !classroom) return null;

  const assignedStudents = students.filter(s => s.classroomId === classroom.id);
  const unassignedStudents = students.filter(s => !s.classroomId || s.classroomId !== classroom.id);

  const handleAssign = async (studentId: string, assign: boolean) => {
    setIsUpdating(studentId);
    try {
      await teacherApi.updateStudent(studentId, {
        classroomId: assign ? classroom.id : undefined,
      });
      onUpdated();
    } catch (err) {
      console.error('Failed to update student:', err);
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden"
      >
        <GlassCard variant="card" className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-solid">{classroom.name}</h2>
              <p className="text-sm text-prominent">
                {t('teacher.classrooms.assignModal.studentsAssigned', { count: assignedStudents.length })}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <svg className="w-5 h-5 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Assigned Students */}
            <div>
              <h3 className="text-sm font-semibold text-prominent mb-2">{t('teacher.classrooms.assignModal.assignedStudents')}</h3>
              {assignedStudents.length === 0 ? (
                <p className="text-sm text-subtle">{t('teacher.classrooms.assignModal.noStudentsAssigned')}</p>
              ) : (
                <div className="space-y-2">
                  {assignedStudents.map((student) => (
                    <div
                      key={student.userId}
                      className="flex items-center justify-between p-3 backdrop-blur-md bg-emerald-500/10 border border-emerald-400/20 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 flex items-center justify-center text-sm font-medium text-emerald-700">
                          {student.user?.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <p className="font-medium text-solid">{student.user?.name}</p>
                          <p className="text-xs text-prominent">{student.user?.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssign(student.userId, false)}
                        disabled={isUpdating === student.userId}
                        className="px-3 py-1 text-sm backdrop-blur-md bg-red-500/20 border border-red-400/30 rounded-lg text-red-700 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {isUpdating === student.userId ? '...' : t('teacher.classrooms.assignModal.remove')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unassigned Students */}
            <div>
              <h3 className="text-sm font-semibold text-prominent mb-2">{t('teacher.classrooms.assignModal.availableStudents')}</h3>
              {unassignedStudents.length === 0 ? (
                <p className="text-sm text-subtle">{t('teacher.classrooms.assignModal.allStudentsAssigned')}</p>
              ) : (
                <div className="space-y-2">
                  {unassignedStudents.map((student) => (
                    <div
                      key={student.userId}
                      className="flex items-center justify-between p-3 backdrop-blur-md bg-white/10 border border-white/20 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full backdrop-blur-md bg-white/20 border border-white/30 flex items-center justify-center text-sm font-medium text-solid">
                          {student.user?.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <p className="font-medium text-solid">{student.user?.name}</p>
                          <p className="text-xs text-prominent">{student.user?.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssign(student.userId, true)}
                        disabled={isUpdating === student.userId}
                        className="px-3 py-1 text-sm backdrop-blur-md bg-emerald-500/20 border border-emerald-400/30 rounded-lg text-emerald-700 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {isUpdating === student.userId ? '...' : t('teacher.classrooms.assignModal.add')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
