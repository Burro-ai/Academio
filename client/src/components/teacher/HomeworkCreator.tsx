import { useState } from 'react';
import { motion } from 'motion/react';
import { GlassCard, GlassButton, GlassInput } from '@/components/glass';
import { lessonApi } from '@/services/lessonApi';
import { HomeworkWithTeacher } from '@/types';

const SUBJECTS = [
  { id: 'math', label: 'Math' },
  { id: 'science', label: 'Science' },
  { id: 'history', label: 'History' },
  { id: 'english', label: 'English' },
  { id: 'geography', label: 'Geography' },
  { id: 'general', label: 'General' },
];

interface HomeworkCreatorProps {
  onBack: () => void;
  onCreated: (homework: HomeworkWithTeacher) => void;
}

export function HomeworkCreator({ onBack, onCreated }: HomeworkCreatorProps) {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [masterContent, setMasterContent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [generateForStudents, setGenerateForStudents] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateContent = async () => {
    if (!topic) {
      setError('Please enter a topic first');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setMasterContent(''); // Clear existing content

    try {
      // Use streaming for real-time content display
      for await (const chunk of lessonApi.streamHomeworkContent(topic, subject || undefined)) {
        if (chunk.text) {
          setMasterContent((prev) => prev + chunk.text);
        }
        if (chunk.done) {
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!title || !topic) {
      setError('Title and topic are required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const homework = await lessonApi.createHomework({
        title,
        topic,
        subject: subject || undefined,
        masterContent: masterContent || undefined,
        dueDate: dueDate || undefined,
        generateForStudents,
      });

      onCreated(homework as HomeworkWithTeacher);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create homework');
      setIsCreating(false);
    }
  };

  // Get tomorrow's date as min date for due date picker
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

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
            <h1 className="text-2xl font-bold text-solid">Create Homework</h1>
            <p className="text-prominent">Create a new homework assignment</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 backdrop-blur-md bg-red-500/20 border border-red-400/30 rounded-xl"
          >
            <p className="text-red-100">{error}</p>
          </motion.div>
        )}

        {/* Basic Info */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">Assignment Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                Title *
              </label>
              <GlassInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Fractions Practice Worksheet"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                Topic *
              </label>
              <GlassInput
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Adding and subtracting fractions"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-prominent mb-1.5">
                  Subject
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSubject(subject === s.id ? '' : s.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        subject === s.id
                          ? 'backdrop-blur-md bg-blue-500/30 border border-blue-400/40 text-blue-100'
                          : 'backdrop-blur-md bg-white/10 border border-white/20 text-prominent hover:bg-white/20'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-prominent mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={minDate}
                  className="w-full px-4 py-2.5 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Content */}
        <GlassCard variant="card" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-solid">Assignment Content</h2>
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
                  Generating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate with AI
                </span>
              )}
            </GlassButton>
          </div>

          <textarea
            value={masterContent}
            onChange={(e) => setMasterContent(e.target.value)}
            placeholder="Enter your homework content here, or click 'Generate with AI' to create content automatically..."
            className="w-full h-64 px-4 py-3 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl text-solid placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
          />

          <p className="text-xs text-subtle mt-2">
            This is the master content that will be personalized for each student based on their profile.
          </p>
        </GlassCard>

        {/* Options */}
        <GlassCard variant="card" className="p-6">
          <h2 className="text-lg font-semibold text-solid mb-4">Options</h2>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={generateForStudents}
              onChange={(e) => setGenerateForStudents(e.target.checked)}
              className="w-5 h-5 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-500/50"
            />
            <div>
              <span className="text-solid font-medium">
                Automatically personalize for all students
              </span>
              <p className="text-sm text-prominent">
                The AI will create a personalized version for each student based on their profile
              </p>
            </div>
          </label>
        </GlassCard>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <GlassButton variant="default" onClick={onBack}>
            Cancel
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
                Creating...
              </span>
            ) : (
              'Create Homework'
            )}
          </GlassButton>
        </div>
      </motion.div>
    </div>
  );
}
