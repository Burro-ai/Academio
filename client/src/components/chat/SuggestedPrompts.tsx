import { motion } from 'motion/react';
import { Topic } from '@/types';
import { SUGGESTED_PROMPTS } from '@/data/suggestedPrompts';

interface SuggestedPromptsProps {
  topic: Topic;
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function SuggestedPrompts({ topic, onSelectPrompt, disabled }: SuggestedPromptsProps) {
  const prompts = SUGGESTED_PROMPTS[topic];

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
