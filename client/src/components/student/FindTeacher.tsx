import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { GlassCard } from '@/components/glass';
import { studentApi } from '@/services/studentApi';
import { User } from '@/types';

export function FindTeacher() {
  const { t } = useTranslation();
  const { profile, refreshUser } = useAuth();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const data = await studentApi.getTeachers();
      setTeachers(data);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get selected teacher IDs (supports both old single teacherId and new teacherIds array)
  const selectedTeacherIds: string[] = profile?.teacherIds || (profile?.teacherId ? [profile.teacherId] : []);

  const isTeacherSelected = (teacherId: string) => selectedTeacherIds.includes(teacherId);

  const handleToggleTeacher = async (teacherId: string) => {
    setIsSaving(true);
    setMessage(null);

    try {
      const isCurrentlySelected = isTeacherSelected(teacherId);
      let newTeacherIds: string[];

      if (isCurrentlySelected) {
        // Remove teacher
        newTeacherIds = selectedTeacherIds.filter(id => id !== teacherId);
      } else {
        // Add teacher
        newTeacherIds = [...selectedTeacherIds, teacherId];
      }

      await studentApi.setTeachers(newTeacherIds);
      await refreshUser();
      setMessage({
        type: 'success',
        text: isCurrentlySelected
          ? t('student.findTeacher.successRemove')
          : t('student.findTeacher.successSelect'),
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t('errors.generic'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Get currently selected teachers
  const currentTeachers = teachers.filter(t => isTeacherSelected(t.id));

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-solid">{t('student.findTeacher.title')}</h1>
          <p className="text-prominent mt-1">
            {t('student.findTeacher.subtitle')}
          </p>
        </div>

        {/* Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`p-4 rounded-xl border ${
              message.type === 'success'
                ? 'backdrop-blur-md bg-emerald-500/20 border-emerald-400/30 text-emerald-700'
                : 'backdrop-blur-md bg-red-500/20 border-red-400/30 text-red-700'
            }`}
          >
            {message.text}
          </motion.div>
        )}

        {/* Current Teachers */}
        {currentTeachers.length > 0 && (
          <GlassCard variant="card" className="p-6">
            <h2 className="text-lg font-semibold text-solid mb-4">
              {t('student.findTeacher.currentTeachers', { count: currentTeachers.length })}
            </h2>
            <div className="space-y-3">
              {currentTeachers.map((teacher) => (
                <div key={teacher.id} className="flex items-center justify-between p-3 rounded-xl backdrop-blur-md bg-blue-500/20 border border-blue-400/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 backdrop-blur-md bg-blue-500/40 border border-blue-400/50 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 font-semibold">
                        {teacher.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-solid">{teacher.name}</p>
                      <p className="text-sm text-prominent">{teacher.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleTeacher(teacher.id)}
                    disabled={isSaving}
                    className="p-2 rounded-lg backdrop-blur-md bg-red-500/20 border border-red-400/30 text-red-600 hover:bg-red-500/30 transition-all disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Available Teachers */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">
            {t('student.findTeacher.availableTeachers')}
          </h2>
          <p className="text-sm text-prominent mb-4">
            {t('student.findTeacher.selectMultiple')}
          </p>

          {teachers.length === 0 ? (
            <p className="text-prominent text-center py-8">
              {t('student.findTeacher.noTeachersAvailable')}
            </p>
          ) : (
            <div className="space-y-3">
              {teachers.map((teacher) => {
                const isSelected = isTeacherSelected(teacher.id);
                return (
                  <motion.div
                    key={teacher.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'backdrop-blur-md bg-blue-500/20 border-blue-400/40'
                        : 'backdrop-blur-md bg-white/10 border-white/20 hover:bg-white/20'
                    }`}
                    onClick={() => !isSaving && handleToggleTeacher(teacher.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Checkbox indicator */}
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-all ${
                            isSelected
                              ? 'backdrop-blur-md bg-blue-500/50 border-blue-400'
                              : 'backdrop-blur-md bg-white/10 border-white/30'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSelected
                              ? 'backdrop-blur-md bg-blue-500/40 border border-blue-400/50'
                              : 'backdrop-blur-md bg-white/20 border border-white/30'
                          }`}
                        >
                          <span
                            className={`font-semibold ${
                              isSelected ? 'text-blue-700' : 'text-prominent'
                            }`}
                          >
                            {teacher.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-solid">{teacher.name}</p>
                          <p className="text-sm text-prominent">{teacher.email}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="px-3 py-1 text-sm font-medium backdrop-blur-sm bg-blue-500/30 border border-blue-400/40 rounded-full text-blue-700">
                          {t('student.findTeacher.selected')}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Info */}
        <GlassCard variant="surface" className="p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-sm text-prominent">
              <p className="font-medium text-solid mb-1">{t('student.findTeacher.whatHappens.title')}</p>
              <ul className="list-disc list-inside space-y-1 text-subtle">
                <li>{t('student.findTeacher.whatHappens.item1')}</li>
                <li>{t('student.findTeacher.whatHappens.item2')}</li>
                <li>{t('student.findTeacher.whatHappens.item3')}</li>
                <li>{t('student.findTeacher.whatHappens.item4')}</li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
