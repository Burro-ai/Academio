/**
 * HomeworkCreator - Create and Edit Homework with Editable Questions
 *
 * Features:
 * - State machine: idle → generating → editing → assigned
 * - AI generates JSON content with questions
 * - Editable question cards before assignment
 * - Questions lock once assigned to students
 * - Liquid Glass design system
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GlassCard, GlassButton, GlassInput } from '@/components/glass';
import { HomeworkQuestionsPanel } from './HomeworkQuestionsPanel';
import { lessonApi } from '@/services/lessonApi';
import { teacherApi } from '@/services/teacherApi';
import { HomeworkWithTeacher, LessonWithTeacher, Classroom, HomeworkQuestionJson, HomeworkContentJson } from '@/types';

// Subject keys map to translation keys in topics.*
const SUBJECT_KEYS = ['math', 'science', 'history', 'english', 'geography', 'general'];

type CreatorState = 'idle' | 'generating' | 'editing' | 'assigned';

interface HomeworkCreatorProps {
  onBack: () => void;
  onCreated: (homework: HomeworkWithTeacher) => void;
  existingHomework?: HomeworkWithTeacher;  // For editing existing homework
}

export function HomeworkCreator({ onBack, onCreated, existingHomework }: HomeworkCreatorProps) {
  const { t } = useTranslation();

  // Form state
  const [title, setTitle] = useState(existingHomework?.title || '');
  const [topic, setTopic] = useState(existingHomework?.topic || '');
  const [subject, setSubject] = useState(existingHomework?.subject || '');
  const [dueDate, setDueDate] = useState(existingHomework?.dueDate || '');
  const [classroomId, setClassroomId] = useState<string>(existingHomework?.classroomId || '');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [lessons, setLessons] = useState<LessonWithTeacher[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(existingHomework?.sourceLessonId || '');
  const [selectedLesson, setSelectedLesson] = useState<LessonWithTeacher | null>(null);

  // Questions state
  const [questions, setQuestions] = useState<HomeworkQuestionJson[]>(
    existingHomework?.questionsJson || []
  );
  const [masterContent, setMasterContent] = useState(existingHomework?.masterContent || '');

  // State machine
  const [state, setState] = useState<CreatorState>(() => {
    if (existingHomework?.assignedAt) return 'assigned';
    if (existingHomework?.questionsJson && existingHomework.questionsJson.length > 0) return 'editing';
    return 'idle';
  });

  // Loading states
  const [_isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Created homework ID (for saving/assigning)
  const [homeworkId, setHomeworkId] = useState<string | null>(existingHomework?.id || null);
  const [personalizedCount, setPersonalizedCount] = useState(existingHomework?.personalizedCount || 0);

  useEffect(() => {
    teacherApi.getClassrooms().then(setClassrooms).catch(console.error);
    lessonApi.getLessons().then(setLessons).catch(console.error);
  }, []);

  const handleLessonSelect = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setSelectedLesson(lessons.find(l => l.id === lessonId) || null);
  };

  /**
   * Parse JSON from AI response
   */
  const parseHomeworkJson = useCallback((rawContent: string): HomeworkContentJson | null => {
    try {
      let jsonStr = rawContent.trim();

      // Remove markdown code blocks
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      // Find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as HomeworkContentJson;

      if (!parsed.title || !parsed.questions || !Array.isArray(parsed.questions)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }, []);

  /**
   * Generate homework content using AI
   */
  const handleGenerateContent = async () => {
    if (!topic) {
      setError(t('teacher.homework.form.topicRequired', 'El tema es requerido'));
      return;
    }

    setIsGenerating(true);
    setState('generating');
    setError(null);

    let rawContent = '';

    try {
      // Use streaming for real-time content display
      for await (const chunk of lessonApi.streamHomeworkContent(topic, subject || undefined, selectedLessonId || undefined)) {
        if (chunk.text) {
          rawContent += chunk.text;
        }
        if (chunk.done) {
          break;
        }
      }

      // Try to parse JSON
      const parsed = parseHomeworkJson(rawContent);

      if (parsed) {
        // Set title if not already set
        if (!title && parsed.title) {
          setTitle(parsed.title);
        }

        // Set questions
        const questionsWithIds = parsed.questions.map((q, i) => ({
          ...q,
          id: q.id || i + 1,
        }));
        setQuestions(questionsWithIds);

        // Build display content
        const displayContent = parsed.instructions
          ? `# ${parsed.title}\n\n${parsed.instructions}\n\n${questionsWithIds.map((q, i) => `${i + 1}. ${q.text}`).join('\n\n')}`
          : `# ${parsed.title}\n\n${questionsWithIds.map((q, i) => `${i + 1}. ${q.text}`).join('\n\n')}`;

        setMasterContent(displayContent);
        setState('editing');
      } else {
        // Fallback: use raw content and create a single question
        setMasterContent(rawContent);
        setQuestions([{
          id: 1,
          text: 'Responde a la tarea',
          type: 'open',
        }]);
        setState('editing');
        console.warn('[HomeworkCreator] Failed to parse JSON, using fallback');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
      setState('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Save homework as draft (creates/updates without assigning)
   */
  const handleSaveDraft = async () => {
    if (!title || !topic) {
      setError(t('teacher.homework.form.titleTopicRequired', 'El título y tema son requeridos'));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (homeworkId) {
        // Update existing homework questions
        await lessonApi.updateHomeworkQuestions(homeworkId, questions);
      } else {
        // Create new homework
        const homework = await lessonApi.createHomework({
          title,
          topic,
          subject: subject || undefined,
          masterContent: masterContent || undefined,
          questionsJson: questions,
          dueDate: dueDate || undefined,
          classroomId: classroomId || undefined,
          generateForStudents: false,  // Don't auto-personalize yet
          sourceLessonId: selectedLessonId || undefined,
        });

        setHomeworkId(homework.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Assign homework to students (locks questions)
   */
  const handleAssign = async () => {
    setIsAssigning(true);
    setError(null);

    try {
      let hwId = homeworkId;

      // If not saved yet, create first
      if (!hwId) {
        if (!title || !topic) {
          setError(t('teacher.homework.form.titleTopicRequired', 'El título y tema son requeridos'));
          setIsAssigning(false);
          return;
        }

        const homework = await lessonApi.createHomework({
          title,
          topic,
          subject: subject || undefined,
          masterContent: masterContent || undefined,
          questionsJson: questions,
          dueDate: dueDate || undefined,
          classroomId: classroomId || undefined,
          generateForStudents: false,
          sourceLessonId: selectedLessonId || undefined,
        });

        hwId = homework.id;
        setHomeworkId(hwId);
      } else {
        // Save questions first
        await lessonApi.updateHomeworkQuestions(hwId, questions);
      }

      // Assign to students
      const result = await lessonApi.assignHomework(hwId);

      setState('assigned');
      setPersonalizedCount(result.assignedCount || 0);

      // Fetch updated homework and notify parent
      const updatedHomework = await lessonApi.getHomeworkById(hwId);
      onCreated(updatedHomework);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setIsAssigning(false);
    }
  };

  // Get tomorrow's date as min date for due date picker
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const isEditing = state === 'editing' || state === 'assigned';

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
            <h1 className="text-2xl font-bold text-solid">
              {existingHomework ? t('teacher.homework.editHomework', 'Editar Tarea') : t('teacher.homework.createNew')}
            </h1>
            <p className="text-prominent">{t('teacher.homework.subtitle')}</p>
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
          <h2 className="text-lg font-semibold text-solid mb-4">{t('teacher.homework.details')}</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                {t('teacher.homework.form.titleLabel')}
              </label>
              <GlassInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('teacher.homework.form.titlePlaceholder')}
                disabled={state === 'assigned'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                {t('teacher.homework.form.topicLabel')}
              </label>
              <GlassInput
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t('teacher.homework.form.topicPlaceholder')}
                disabled={state === 'assigned'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-prominent mb-1.5">
                  {t('teacher.homework.form.subjectLabel')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_KEYS.map((subjectKey) => (
                    <button
                      key={subjectKey}
                      type="button"
                      onClick={() => setSubject(subject === subjectKey ? '' : subjectKey)}
                      disabled={state === 'assigned'}
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
                  {t('teacher.homework.form.dueDateLabel')}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={minDate}
                  disabled={state === 'assigned'}
                  className="w-full px-4 py-2.5 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                {t('teacher.homework.form.sendToClassroom')}
              </label>
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                disabled={state === 'assigned'}
                className="w-full px-4 py-2.5 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{t('teacher.homework.form.allStudents')}</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.subject ? `(${c.subject})` : ''} - {c.studentCount || 0} {t('nav.students').toLowerCase()}
                  </option>
                ))}
              </select>
              <p className="text-xs text-subtle mt-1">
                {t('teacher.homework.form.classroomHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                {t('teacher.homework.form.linkLesson')}
              </label>
              <select
                value={selectedLessonId}
                onChange={(e) => handleLessonSelect(e.target.value)}
                disabled={state === 'assigned'}
                className="w-full px-4 py-2.5 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{t('teacher.homework.form.noLesson')}</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-subtle mt-1">
                {t('teacher.homework.form.linkLessonHint')}
              </p>

              {selectedLesson && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 p-4 backdrop-blur-xl bg-blue-500/10 border border-blue-400/20 rounded-xl"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span className="text-sm font-medium text-blue-700">{t('teacher.homework.form.lessonPreviewTitle')}</span>
                  </div>
                  <p className="text-sm font-semibold text-solid">{selectedLesson.title}</p>
                  <p className="text-xs text-prominent mt-1 line-clamp-3">
                    {selectedLesson.masterContent?.slice(0, 250)}...
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Content Generation / Questions */}
        {state === 'idle' ? (
          <GlassCard variant="card" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-solid">{t('teacher.homework.content')}</h2>
            </div>

            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 backdrop-blur-md bg-blue-500/20 border border-blue-400/30 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-prominent mb-6">
                {t('homework.editor.generatePrompt', 'Genera preguntas de tarea con IA basadas en el tema')}
              </p>
              <GlassButton
                variant="primary"
                size="lg"
                onClick={handleGenerateContent}
                disabled={!topic}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('teacher.homework.form.generateWithAI')}
              </GlassButton>
            </div>
          </GlassCard>
        ) : state === 'generating' ? (
          <GlassCard variant="card" className="p-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 backdrop-blur-md bg-blue-500/20 border border-blue-400/30 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-solid mb-2">
                {t('homework.editor.generating', 'Generando preguntas...')}
              </p>
              <p className="text-prominent">
                {t('homework.editor.generatingSubtitle', 'La IA está creando preguntas para tu tarea')}
              </p>
            </div>
          </GlassCard>
        ) : (
          <HomeworkQuestionsPanel
            questions={questions}
            onQuestionsChange={setQuestions}
            onSaveDraft={handleSaveDraft}
            onAssign={handleAssign}
            isAssigned={state === 'assigned'}
            isSaving={isSaving}
            isAssigning={isAssigning}
            personalizedCount={personalizedCount}
          />
        )}

        {/* Back/Cancel button for editing state */}
        {isEditing && (
          <div className="flex justify-start">
            <GlassButton variant="default" onClick={onBack}>
              {state === 'assigned' ? t('common.back', 'Regresar') : t('common.cancel', 'Cancelar')}
            </GlassButton>
          </div>
        )}
      </motion.div>
    </div>
  );
}
