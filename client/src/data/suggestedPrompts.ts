import { Topic } from '@/types';

// Note: Suggested prompts are now stored in locales/es-MX.json under "suggestedPrompts"
// Topic greetings are stored under "topicGreetings"
// Topic labels are stored under "topicLabels"

export const TOPIC_INFO: Record<Topic, { icon: string; color: string }> = {
  math: { icon: '📐', color: 'bg-blue-500/30 border-blue-400/30' },
  science: { icon: '🔬', color: 'bg-green-500/30 border-green-400/30' },
  history: { icon: '📜', color: 'bg-amber-500/30 border-amber-400/30' },
  writing: { icon: '✍️', color: 'bg-purple-500/30 border-purple-400/30' },
  general: { icon: '💡', color: 'bg-white/30 border-white/30' }
};
