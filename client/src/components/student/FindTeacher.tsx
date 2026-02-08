import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import { GlassCard, GlassButton } from '@/components/glass';
import { studentApi } from '@/services/studentApi';
import { User } from '@/types';

export function FindTeacher() {
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

  const handleSelectTeacher = async (teacherId: string) => {
    setIsSaving(true);
    setMessage(null);

    try {
      await studentApi.setTeacher(teacherId);
      await refreshUser();
      setMessage({ type: 'success', text: 'Teacher selected successfully! Your teacher can now see your profile.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to select teacher',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveTeacher = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      await studentApi.setTeacher(null);
      await refreshUser();
      setMessage({ type: 'success', text: 'Teacher removed from your profile.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to remove teacher',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentTeacher = profile?.teacherId
    ? teachers.find((t) => t.id === profile.teacherId)
    : null;

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
          <h1 className="text-2xl font-bold text-solid">Find Your Teacher</h1>
          <p className="text-prominent mt-1">
            Select your teacher so they can see your profile and personalize lessons for you
          </p>
        </div>

        {/* Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`p-4 rounded-xl border ${
              message.type === 'success'
                ? 'backdrop-blur-md bg-emerald-500/20 border-emerald-400/30 text-emerald-100'
                : 'backdrop-blur-md bg-red-500/20 border-red-400/30 text-red-100'
            }`}
          >
            {message.text}
          </motion.div>
        )}

        {/* Current Teacher */}
        {currentTeacher && (
          <GlassCard variant="card" className="p-6">
            <h2 className="text-lg font-semibold text-solid mb-4">Your Current Teacher</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 backdrop-blur-md bg-blue-500/30 border border-blue-400/30 rounded-full flex items-center justify-center shadow-glass">
                  <span className="text-blue-100 font-semibold text-lg">
                    {currentTeacher.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-solid">{currentTeacher.name}</p>
                  <p className="text-sm text-prominent">{currentTeacher.email}</p>
                </div>
              </div>
              <GlassButton
                variant="secondary"
                onClick={handleRemoveTeacher}
                disabled={isSaving}
              >
                {isSaving ? 'Removing...' : 'Remove Teacher'}
              </GlassButton>
            </div>
          </GlassCard>
        )}

        {/* Available Teachers */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">
            {currentTeacher ? 'Switch to a Different Teacher' : 'Available Teachers'}
          </h2>

          {teachers.length === 0 ? (
            <p className="text-prominent text-center py-8">
              No teachers available yet. Check back later.
            </p>
          ) : (
            <div className="space-y-3">
              {teachers.map((teacher) => {
                const isSelected = profile?.teacherId === teacher.id;
                return (
                  <motion.div
                    key={teacher.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'backdrop-blur-md bg-blue-500/20 border-blue-400/40'
                        : 'backdrop-blur-md bg-white/10 border-white/20 hover:bg-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSelected
                              ? 'backdrop-blur-md bg-blue-500/40 border border-blue-400/50'
                              : 'backdrop-blur-md bg-white/20 border border-white/30'
                          }`}
                        >
                          <span
                            className={`font-semibold ${
                              isSelected ? 'text-blue-100' : 'text-prominent'
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
                      {isSelected ? (
                        <span className="px-3 py-1 text-sm font-medium backdrop-blur-sm bg-blue-500/30 border border-blue-400/40 rounded-full text-blue-100">
                          Selected
                        </span>
                      ) : (
                        <GlassButton
                          variant="primary"
                          onClick={() => handleSelectTeacher(teacher.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Selecting...' : 'Select'}
                        </GlassButton>
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
              className="w-5 h-5 text-blue-300 mt-0.5 flex-shrink-0"
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
              <p className="font-medium text-solid mb-1">What happens when you select a teacher?</p>
              <ul className="list-disc list-inside space-y-1 text-subtle">
                <li>Your teacher will see your profile in their student list</li>
                <li>They can create personalized lessons and homework for you</li>
                <li>The AI tutor will use your preferences to customize learning</li>
                <li>You can change your teacher at any time</li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
