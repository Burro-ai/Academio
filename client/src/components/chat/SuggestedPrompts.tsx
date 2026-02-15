import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { Topic } from '@/types';

interface SuggestedPromptsProps {
  topic: Topic;
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

/**
 * Maps a gradeLevel key to the educational tier for prompt selection
 */
function getEducationalTier(gradeLevel?: string): string {
  if (!gradeLevel) return 'default';

  const level = gradeLevel.toLowerCase();

  // Universidad
  if (level.includes('universidad') || level.includes('uni')) {
    return 'universidad';
  }

  // Preparatoria
  if (level.includes('preparatoria') || level.includes('prepa') || level.includes('bachillerato')) {
    return 'preparatoria';
  }

  // Secundaria
  if (level.includes('secundaria')) {
    return 'secundaria';
  }

  // Primaria (check for specific grades or default)
  if (level.includes('primaria')) {
    return 'primaria';
  }

  return 'default';
}

export function SuggestedPrompts({ topic, onSelectPrompt, disabled }: SuggestedPromptsProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();

  // Get educational tier based on student's grade level
  const educationalTier = getEducationalTier(profile?.gradeLevel);

  // Try to get grade-specific prompts, fall back to default
  let prompts = t(`suggestedPrompts.${educationalTier}.${topic}`, { returnObjects: true, defaultValue: null }) as string[] | null;

  // Fallback to default if specific tier not found
  if (!prompts || !Array.isArray(prompts)) {
    prompts = t(`suggestedPrompts.default.${topic}`, { returnObjects: true }) as string[];
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {prompts.map((prompt, index) => (
        <motion.button
          key={prompt}
          onClick={() => onSelectPrompt(prompt)}
          disabled={disabled}
          className="p-4 glass-card text-left transition-all hover:bg-white/30
                     disabled:opacity-50 disabled:cursor-not-allowed group"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-start gap-3">
            <span className="text-lg opacity-60 group-hover:opacity-100 transition-opacity">
              {getPromptIcon(prompt)}
            </span>
            <span className="text-sm font-medium text-prominent group-hover:text-solid transition-colors">
              {prompt}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

function getPromptIcon(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('help') || lower.includes('explain')) return '💬';
  if (lower.includes('how')) return '🤔';
  if (lower.includes('what')) return '❓';
  if (lower.includes('tell me') || lower.includes('about')) return '📖';
  if (lower.includes('study') || lower.includes('learn')) return '📚';
  return '✨';
}
