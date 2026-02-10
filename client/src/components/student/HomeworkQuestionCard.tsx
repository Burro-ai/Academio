import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/glass';
import { HomeworkQuestion } from '@/types';

interface HomeworkQuestionCardProps {
  question: HomeworkQuestion;
  questionNumber: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function HomeworkQuestionCard({
  question,
  questionNumber,
  value,
  onChange,
  disabled = false,
}: HomeworkQuestionCardProps) {
  const { t } = useTranslation();

  return (
    <GlassCard variant="card" className="p-6 backdrop-blur-xl backdrop-saturate-180">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 rounded-full flex items-center justify-center">
          <span className="text-sm font-semibold text-emerald-100">{questionNumber}</span>
        </div>
        <div className="flex-1">
          <p className="text-solid font-medium mb-4">{question.text}</p>

          {question.type === 'textarea' ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t('student.homeworkForm.yourAnswer')}
              disabled={disabled}
              rows={4}
              className="w-full resize-none rounded-xl px-4 py-3
                         backdrop-blur-md bg-white/15 border border-white/20
                         focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40
                         placeholder:text-surface-500/70 text-solid
                         disabled:bg-white/10 disabled:cursor-not-allowed
                         transition-all duration-200"
            />
          ) : question.type === 'number' ? (
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t('student.homeworkForm.yourAnswer')}
              disabled={disabled}
              className="w-full rounded-xl px-4 py-3
                         backdrop-blur-md bg-white/15 border border-white/20
                         focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40
                         placeholder:text-surface-500/70 text-solid
                         disabled:bg-white/10 disabled:cursor-not-allowed
                         transition-all duration-200"
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t('student.homeworkForm.yourAnswer')}
              disabled={disabled}
              className="w-full rounded-xl px-4 py-3
                         backdrop-blur-md bg-white/15 border border-white/20
                         focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40
                         placeholder:text-surface-500/70 text-solid
                         disabled:bg-white/10 disabled:cursor-not-allowed
                         transition-all duration-200"
            />
          )}
        </div>
      </div>
    </GlassCard>
  );
}
