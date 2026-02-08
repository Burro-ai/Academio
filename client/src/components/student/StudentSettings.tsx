import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import { GlassCard, GlassButton, GlassInput } from '@/components/glass';
import { studentApi } from '@/services/studentApi';
import { UpdateStudentProfileRequest } from '@/types';

const SPORTS_OPTIONS = [
  'Soccer', 'Basketball', 'Baseball', 'Football', 'Tennis', 'Swimming',
  'Volleyball', 'Hockey', 'Track', 'Gymnastics', 'Dance', 'Cheerleading',
  'Lacrosse', 'Golf', 'Skateboarding', 'Cycling', 'Martial Arts', 'Other'
];

const SKILLS_OPTIONS = [
  'Math', 'Reading', 'Writing', 'Science', 'History', 'Geography',
  'Vocabulary', 'Critical Thinking', 'Problem Solving', 'Creativity',
  'Logic', 'Comprehension', 'English', 'Study Skills'
];

export function StudentSettings() {
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
      setMessage({ type: 'success', text: 'Profile saved successfully!' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save profile',
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
          <h1 className="text-2xl font-bold text-solid">Profile Settings</h1>
          <p className="text-prominent mt-1">
            Customize how the AI tutor adapts to your learning style
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

        {/* Basic Info */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">Basic Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                Age
              </label>
              <GlassInput
                type="number"
                min={5}
                max={18}
                value={age || ''}
                onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Your age"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                Grade Level
              </label>
              <GlassInput
                type="text"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="e.g., 6th Grade"
              />
            </div>
          </div>
        </GlassCard>

        {/* Interests */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-2">
            Favorite Sports & Activities
          </h2>
          <p className="text-sm text-prominent mb-4">
            The AI will use relatable examples from your interests
          </p>

          <div className="flex flex-wrap gap-2">
            {SPORTS_OPTIONS.map((sport) => (
              <button
                key={sport}
                onClick={() => toggleSport(sport.toLowerCase())}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  favoriteSports.includes(sport.toLowerCase())
                    ? 'backdrop-blur-md bg-emerald-500/30 border border-emerald-400/40 text-emerald-100'
                    : 'backdrop-blur-md bg-white/10 border border-white/20 text-prominent hover:bg-white/20'
                }`}
              >
                {sport}
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Skills to Improve */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-2">
            Skills to Improve
          </h2>
          <p className="text-sm text-prominent mb-4">
            The AI will focus extra attention on helping you with these areas
          </p>

          <div className="flex flex-wrap gap-2">
            {SKILLS_OPTIONS.map((skill) => (
              <button
                key={skill}
                onClick={() => toggleSkill(skill.toLowerCase())}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  skillsToImprove.includes(skill.toLowerCase())
                    ? 'backdrop-blur-md bg-blue-500/30 border border-blue-400/40 text-blue-100'
                    : 'backdrop-blur-md bg-white/10 border border-white/20 text-prominent hover:bg-white/20'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Learning Style */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-2">
            Personal Learning Preferences
          </h2>
          <p className="text-sm text-prominent mb-4">
            Tell the AI how you learn best. This will be included in every conversation.
          </p>

          <textarea
            value={learningSystemPrompt}
            onChange={(e) => setLearningSystemPrompt(e.target.value)}
            placeholder="Example: I learn best with visual explanations and step-by-step instructions. I like when concepts are connected to video games I play..."
            className="w-full h-32 px-4 py-3 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
          />

          <p className="text-xs text-subtle mt-2">
            {learningSystemPrompt.length}/500 characters
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
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </GlassButton>
        </div>
      </motion.div>
    </div>
  );
}
