/**
 * LessonCreator - Create and Assign Lessons with Editable Content
 *
 * Features:
 * - State machine: idle → generating → editing → assigned
 * - AI generates lesson content via SSE streaming
 * - SmartMarkdown reader with edit/preview toggle
 * - No mass teacher-side personalization (students personalize on demand)
 * - Liquid Glass design system
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton, GlassInput } from '@/components/glass';
import { SmartMarkdown } from '@/components/shared/SmartMarkdown';
import { lessonApi } from '@/services/lessonApi';
import { teacherApi } from '@/services/teacherApi';
import { LessonWithTeacher, Classroom } from '@/types';

// Subject keys map to translation keys in topics.*
const SUBJECT_KEYS = ['math', 'science', 'history', 'english', 'geography', 'general'];

type CreatorState = 'idle' | 'generating' | 'editing' | 'assigned';

interface LessonCreatorProps {
  onBack: () => void;
  onCreated: (lesson: LessonWithTeacher) => void;
}

export function LessonCreator({ onBack, onCreated }: LessonCreatorProps) {
  const { t } = useTranslation();

  // Form state
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [classroomId, setClassroomId] = useState<string>('');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [masterContent, setMasterContent] = useState('');

  // State machine
  const [state, setState] = useState<CreatorState>('idle');

  // Edit mode toggle within 'editing' state
  const [isEditingContent, setIsEditingContent] = useState(false);

  // Loading / error
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    teacherApi.getClassrooms().then(setClassrooms).catch(console.error);
  }, []);

  /**
   * Generate lesson content using AI (streaming)
   */
  const handleGenerateContent = async () => {
    if (!topic) {
      setError(t('teacher.lessons.form.topicRequired', 'El tema es requerido'));
      return;
    }

    setState('generating');
    setIsEditingContent(false);
    setError(null);
    setMasterContent('');

    try {
      for await (const chunk of lessonApi.streamLessonContent(topic, subject || undefined)) {
        if (chunk.text) {
          setMasterContent((prev) => prev + chunk.text);
        }
        if (chunk.done) break;
      }
      setState('editing');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
      setState('idle');
    }
  };

  /**
   * Assign lesson to students — creates the record and notifies parent
   */
  const handleAssign = async () => {
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
        generateForStudents: false,
      });

      setState('assigned');
      onCreated(lesson as LessonWithTeacher);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setIsCreating(false);
    }
  };

  const isLocked = state === 'assigned';

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

        {/* Basic Info — always visible */}
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
                disabled={isLocked}
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
                disabled={isLocked}
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
                    disabled={isLocked}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                      subject === subjectKey
                        ? 'backdrop-blur-md bg-blue-500/30 border border-blue-400/40 text-blue-700'
                        : 'backdrop-blur-md bg-white/10 border border-white/20 text-prominent hover:bg-white/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                disabled={isLocked}
                className="w-full px-4 py-2.5 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Content — state machine */}
        <AnimatePresence mode="wait">

          {/* IDLE: prompt card */}
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <GlassCard variant="card" className="p-6">
                <h2 className="text-lg font-semibold text-solid mb-4">{t('teacher.lessons.content')}</h2>

                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 backdrop-blur-md bg-emerald-500/20 border border-emerald-400/30 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-prominent mb-6">
                    {t('teacher.lessons.form.generatePrompt', 'Genera el contenido de la lección con IA basado en el tema')}
                  </p>
                  <GlassButton
                    variant="primary"
                    size="lg"
                    onClick={handleGenerateContent}
                    disabled={!topic}
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {t('teacher.lessons.form.generateWithAI')}
                    </span>
                  </GlassButton>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* GENERATING: spinner + live streaming preview */}
          {state === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <GlassCard variant="card" className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-5 h-5 text-emerald-600 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-solid">
                    {t('teacher.lessons.form.generating')}
                  </h2>
                </div>

                {masterContent && (
                  <div className="max-h-64 overflow-y-auto p-4 backdrop-blur-md bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-sm text-prominent whitespace-pre-wrap font-mono leading-relaxed">
                      {masterContent}
                    </p>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* EDITING / ASSIGNED: SmartMarkdown reader with edit toggle */}
          {(state === 'editing' || state === 'assigned') && (
            <motion.div
              key="editing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <GlassCard variant="card" className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-solid">{t('teacher.lessons.content')}</h2>

                  {/* Edit / Preview toggle — only in editing state */}
                  {state === 'editing' && (
                    <button
                      onClick={() => setIsEditingContent(!isEditingContent)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg backdrop-blur-md bg-white/10 border border-white/20 text-sm text-prominent hover:bg-white/20 transition-colors"
                    >
                      {isEditingContent ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {t('teacher.lessons.form.previewContent', 'Vista previa')}
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {t('teacher.lessons.form.editContent', 'Editar')}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Content area: textarea or rendered markdown */}
                <AnimatePresence mode="wait">
                  {isEditingContent && state === 'editing' ? (
                    <motion.div
                      key="textarea"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <textarea
                        value={masterContent}
                        onChange={(e) => setMasterContent(e.target.value)}
                        className="w-full h-96 px-4 py-3 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-white/30 resize-none font-mono text-sm"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="max-h-[520px] overflow-y-auto pr-2"
                    >
                      <SmartMarkdown content={masterContent} variant="lesson" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action buttons — editing state only */}
                {state === 'editing' && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                    <div className="flex gap-2">
                      <GlassButton variant="default" onClick={onBack}>
                        {t('common.cancel')}
                      </GlassButton>
                      <GlassButton
                        variant="default"
                        onClick={handleGenerateContent}
                        disabled={!topic}
                      >
                        <span className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {t('teacher.lessons.form.regenerate', 'Regenerar')}
                        </span>
                      </GlassButton>
                    </div>

                    <GlassButton
                      variant="primary"
                      onClick={handleAssign}
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
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {t('teacher.lessons.assignLesson', 'Asignar a estudiantes')}
                        </span>
                      )}
                    </GlassButton>
                  </div>
                )}

                {/* Assigned success banner */}
                {state === 'assigned' && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 backdrop-blur-md bg-emerald-500/10 border border-emerald-400/20 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full backdrop-blur-md bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="font-medium text-emerald-700">
                        {t('teacher.lessons.assignedSuccess', 'Lección asignada exitosamente')}
                      </p>
                    </div>
                  </motion.div>
                )}
              </GlassCard>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Back button for assigned state */}
        {state === 'assigned' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <GlassButton variant="default" onClick={onBack}>
              {t('common.back')}
            </GlassButton>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
