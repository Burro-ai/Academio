import { Topic } from '@/types';

export const SUGGESTED_PROMPTS: Record<Topic, string[]> = {
  math: [
    "Help me understand fractions",
    "What's the order of operations?",
    "How do I solve word problems?",
    "Can you explain percentages?"
  ],
  science: [
    "What is photosynthesis?",
    "How does gravity work?",
    "Why is the sky blue?",
    "Explain the solar system"
  ],
  history: [
    "Tell me about ancient Egypt",
    "What was the Renaissance?",
    "Who were the founding fathers?",
    "Explain the Industrial Revolution"
  ],
  writing: [
    "How do I write a good paragraph?",
    "Help me structure my essay",
    "What makes a story interesting?",
    "How do I use punctuation?"
  ],
  general: [
    "Help me with my homework",
    "I need study tips",
    "How do I learn faster?",
    "Explain this to me simply"
  ]
};

export const TOPIC_GREETINGS: Record<Topic, string> = {
  math: "Ready to solve some math puzzles together!",
  science: "Let's explore the wonders of science!",
  history: "Let's journey through time together!",
  writing: "Let's craft some amazing writing!",
  general: "What would you like to learn today?"
};

export const TOPIC_INFO: Record<Topic, { icon: string; label: string; color: string }> = {
  math: { icon: '📐', label: 'Math', color: 'bg-blue-500/30 border-blue-400/30' },
  science: { icon: '🔬', label: 'Science', color: 'bg-green-500/30 border-green-400/30' },
  history: { icon: '📜', label: 'History', color: 'bg-amber-500/30 border-amber-400/30' },
  writing: { icon: '✍️', label: 'Writing', color: 'bg-purple-500/30 border-purple-400/30' },
  general: { icon: '💡', label: 'General', color: 'bg-white/30 border-white/30' }
};
