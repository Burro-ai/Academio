import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { GlassCard, GlassButton, GlassInput } from '@/components/glass';
import { studentApi } from '@/services/studentApi';
import { UpdateStudentProfileRequest } from '@/types';

// Sport keys map to translation keys in student.settings.sports
const SPORTS_KEYS = [
  'soccer', 'basketball', 'baseball', 'football', 'tennis', 'swimming',
  'volleyball', 'hockey', 'track', 'gymnastics', 'dance', 'cheerleading',
  'lacrosse', 'golf', 'skateboarding', 'cycling', 'martialArts', 'other'
];

// Skill keys map to translation keys in student.settings.skills
const SKILLS_KEYS = [
  'math', 'reading', 'writing', 'science', 'history', 'geography',
  'vocabulary', 'criticalThinking', 'problemSolving', 'creativity',
  'logic', 'comprehension', 'english', 'studySkills'
];

// Grade level keys map to translation keys in student.settings.gradeLevels
const GRADE_LEVEL_KEYS = [
  'primaria1', 'primaria2', 'primaria3', 'primaria4', 'primaria5', 'primaria6',
  'secundaria1', 'secundaria2', 'secundaria3',
  'preparatoria1', 'preparatoria2', 'preparatoria3',
  'universidad1', 'universidad2', 'universidad3', 'universidad4'
];

export function StudentSettings() {
  const { t } = useTranslation();
  const { profile, refreshUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [age, setAge] = useState<number | undefined>(profile?.age);
  const [favoriteSports, setFavoriteSports] = useState<string[]>(profile?.favoriteSports || []);
  const [skillsToImprove, setSkillsToImprove] = useState<string[]>(profile?.skillsToImprove || []);
  const [learningSystemPrompt, setLearningSystemPrompt] = useState(profile?.learningSystemPrompt || '');
  const [gradeLevel, setGradeLevel] = useState(profile?.gradeLevel || '');

  // Sync form state when profile changes
  useEffect(() => {
    if (profile) {
      setAge(profile.age);
      setFavoriteSports(profile.favoriteSports || []);
      setSkillsToImprove(profile.skillsToImprove || []);
      setLearningSystemPrompt(profile.learningSystemPrompt || '');
      setGradeLevel(profile.gradeLevel || '');
    }
  }, [profile]);

  const toggleSport = (sport: string) => {
    setFavoriteSports(prev =>
      prev.includes(sport)
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };

  const toggleSkill = (skill: string) => {
    setSkillsToImprove(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const data: UpdateStudentProfileRequest = {
        age,
        favoriteSports,
        skillsToImprove,
        learningSystemPrompt: learningSystemPrompt || undefined,
        gradeLevel: gradeLevel || undefined,
      };

      await studentApi.updateProfile(data);
      await refreshUser();
      setMessage({ type: 'success', text: t('student.settings.savedSuccess') });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t('errors.generic'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-solid">{t('student.settings.title')}</h1>
          <p className="text-prominent mt-1">
            {t('student.settings.subtitle')}
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

        {/* My Classroom */}
        {profile?.classroomId && (
          <GlassCard variant="card" className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl backdrop-blur-md bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-prominent uppercase tracking-wide font-medium">{t('student.settings.mySalon', 'Mi Salón')}</p>
                <p className="text-base font-semibold text-solid">
                  {(profile as { classroom?: { name?: string } }).classroom?.name || t('student.settings.classroomUnknown', 'Salón asignado')}
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Basic Info */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">{t('student.settings.basicInfo')}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                {t('student.settings.age')}
              </label>
              <GlassInput
                type="number"
                min={5}
                max={18}
                value={age || ''}
                onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder={t('student.settings.yourAge')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                {t('student.settings.gradeLevel')}
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-4 py-2.5 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid focus:outline-none focus:ring-2 focus:ring-white/30 appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '16px',
                }}
              >
                <option value="" className="bg-slate-800 text-white">
                  {t('student.settings.gradePlaceholder')}
                </option>
                {GRADE_LEVEL_KEYS.map((gradeKey) => (
                  <option key={gradeKey} value={gradeKey} className="bg-slate-800 text-white">
                    {t(`student.settings.gradeLevels.${gradeKey}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </GlassCard>

        {/* Interests */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-2">
            {t('student.settings.favoriteSports.title')}
          </h2>
          <p className="text-sm text-prominent mb-4">
            {t('student.settings.favoriteSports.description')}
          </p>

          <div className="flex flex-wrap gap-2">
            {SPORTS_KEYS.map((sportKey) => (
              <button
                key={sportKey}
                onClick={() => toggleSport(sportKey)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  favoriteSports.includes(sportKey)
                    ? 'backdrop-blur-md bg-emerald-500/30 border border-emerald-400/40 text-emerald-700'
                    : 'backdrop-blur-md bg-white/10 border border-white/20 text-prominent hover:bg-white/20'
                }`}
              >
                {t(`student.settings.sports.${sportKey}`)}
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Skills to Improve */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-2">
            {t('student.settings.skillsToImprove.title')}
          </h2>
          <p className="text-sm text-prominent mb-4">
            {t('student.settings.skillsToImprove.description')}
          </p>

          <div className="flex flex-wrap gap-2">
            {SKILLS_KEYS.map((skillKey) => (
              <button
                key={skillKey}
                onClick={() => toggleSkill(skillKey)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  skillsToImprove.includes(skillKey)
                    ? 'backdrop-blur-md bg-blue-500/30 border border-blue-400/40 text-blue-700'
                    : 'backdrop-blur-md bg-white/10 border border-white/20 text-prominent hover:bg-white/20'
                }`}
              >
                {t(`student.settings.skills.${skillKey}`)}
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Learning Style */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-2">
            {t('student.settings.learningPreferences.title')}
          </h2>
          <p className="text-sm text-prominent mb-4">
            {t('student.settings.learningPreferences.description')}
          </p>

          <textarea
            value={learningSystemPrompt}
            onChange={(e) => setLearningSystemPrompt(e.target.value)}
            placeholder={t('student.settings.learningPreferences.placeholder')}
            className="w-full h-32 px-4 py-3 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
          />

          <p className="text-xs text-subtle mt-2">
            {t('student.settings.learningPreferences.charCount', { count: learningSystemPrompt.length })}
          </p>
        </GlassCard>

        {/* Save Button */}
        <div className="flex justify-end">
          <GlassButton
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {t('student.settings.saving')}
              </span>
            ) : (
              t('student.settings.saveChanges')
            )}
          </GlassButton>
        </div>
      </motion.div>
    </div>
  );
}
