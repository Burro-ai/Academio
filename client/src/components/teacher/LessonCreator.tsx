import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton, GlassInput } from '@/components/glass';
import { lessonApi } from '@/services/lessonApi';
import { teacherApi } from '@/services/teacherApi';
import { LessonWithTeacher, Classroom } from '@/types';

// Subject keys map to translation keys in topics.*
const SUBJECT_KEYS = ['math', 'science', 'history', 'english', 'geography', 'general'];

interface LessonCreatorProps {
  onBack: () => void;
  onCreated: (lesson: LessonWithTeacher) => void;
}

export function LessonCreator({ onBack, onCreated }: LessonCreatorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [masterContent, setMasterContent] = useState('');
  const [classroomId, setClassroomId] = useState<string>('');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [generateForStudents, setGenerateForStudents] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load classrooms
    teacherApi.getClassrooms().then(setClassrooms).catch(console.error);
  }, []);

  const handleGenerateContent = async () => {
    if (!topic) {
      setError(t('teacher.lessons.form.topicRequired', 'El tema es requerido'));
      return;
    }

    setIsGenerating(true);
    setError(null);
    setMasterContent(''); // Clear existing content

    try {
      // Use streaming for real-time content display
      for await (const chunk of lessonApi.streamLessonContent(topic, subject || undefined)) {
        if (chunk.text) {
          setMasterContent((prev) => prev + chunk.text);
        }
        if (chunk.done) {
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!title || !topic) {
      setError(t('teacher.lessons.form.titleTopicRequired', 'El título y tema son requeridos'));
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const lesson = await lessonApi.createLesson({
        title,
        topic,
        subject: subject || undefined,
        masterContent: masterContent || undefined,
        classroomId: classroomId || undefined,
        generateForStudents,
      });

      onCreated(lesson as LessonWithTeacher);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-prominent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-solid">{t('teacher.lessons.createNew')}</h1>
            <p className="text-prominent">{t('teacher.lessons.subtitle')}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 backdrop-blur-md bg-red-500/20 border border-red-400/30 rounded-xl"
          >
            <p className="text-red-700">{error}</p>
          </motion.div>
        )}

        {/* Basic Info */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">{t('teacher.lessons.details')}</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                {t('teacher.lessons.form.titleLabel')}
              </label>
              <GlassInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('teacher.lessons.form.titlePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                {t('teacher.lessons.form.topicLabel')}
              </label>
              <GlassInput
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t('teacher.lessons.form.topicPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                {t('teacher.lessons.form.subjectLabel')}
              </label>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_KEYS.map((subjectKey) => (
                  <button
                    key={subjectKey}
                    type="button"
                    onClick={() => setSubject(subject === subjectKey ? '' : subjectKey)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                      subject === subjectKey
                        ? 'backdrop-blur-md bg-blue-500/30 border border-blue-400/40 text-blue-700'
                        : 'backdrop-blur-md bg-white/10 border border-white/20 text-prominent hover:bg-white/20'
                    }`}
                  >
                    {t(`topics.${subjectKey}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                {t('teacher.lessons.form.sendToClassroom')}
              </label>
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="w-full px-4 py-2.5 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="">{t('teacher.lessons.form.allStudents')}</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.subject ? `(${c.subject})` : ''} - {c.studentCount || 0} {t('nav.students').toLowerCase()}
                  </option>
                ))}
              </select>
              <p className="text-xs text-subtle mt-1">
                {t('teacher.lessons.form.classroomHint')}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Content */}
        <GlassCard variant="card" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-solid">{t('teacher.lessons.content')}</h2>
            <GlassButton
              variant="default"
              onClick={handleGenerateContent}
              disabled={isGenerating || !topic}
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('teacher.lessons.form.generating')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {t('teacher.lessons.form.generateWithAI')}
                </span>
              )}
            </GlassButton>
          </div>

          <textarea
            value={masterContent}
            onChange={(e) => setMasterContent(e.target.value)}
            placeholder={t('teacher.lessons.form.contentPlaceholder')}
            className="w-full h-64 px-4 py-3 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
          />

          <p className="text-xs text-subtle mt-2">
            {t('teacher.lessons.form.masterContentHint')}
          </p>
        </GlassCard>

        {/* Options */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">{t('teacher.lessons.options')}</h2>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={generateForStudents}
              onChange={(e) => setGenerateForStudents(e.target.checked)}
              className="w-5 h-5 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-500/50"
            />
            <div>
              <span className="text-solid font-medium">
                {t('teacher.lessons.form.autoPersonalize')}
              </span>
              <p className="text-sm text-prominent">
                {t('teacher.lessons.form.autoPersonalizeHint')}
              </p>
            </div>
          </label>
        </GlassCard>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <GlassButton variant="default" onClick={onBack}>
            {t('common.cancel')}
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={handleCreate}
            disabled={isCreating || !title || !topic}
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('teacher.lessons.creating')}
              </span>
            ) : (
              t('teacher.lessons.createLesson')
            )}
          </GlassButton>
        </div>
      </motion.div>
    </div>
  );
}
