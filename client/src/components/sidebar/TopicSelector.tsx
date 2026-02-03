import { Topic } from '@/types';
import { useChatContext } from '@/context/ChatContext';
import { motion, LayoutGroup } from 'motion/react';

const TOPICS: { id: Topic; label: string; icon: string; color: string }[] = [
  { id: 'math', label: 'Math', icon: '📐', color: 'hover:bg-blue-500/30 hover:border-blue-400/30' },
  { id: 'science', label: 'Science', icon: '🔬', color: 'hover:bg-green-500/30 hover:border-green-400/30' },
  { id: 'history', label: 'History', icon: '📜', color: 'hover:bg-amber-500/30 hover:border-amber-400/30' },
  { id: 'writing', label: 'Writing', icon: '✍️', color: 'hover:bg-purple-500/30 hover:border-purple-400/30' },
  { id: 'general', label: 'General', icon: '💡', color: 'hover:bg-white/30 hover:border-white/30' },
];

export function TopicSelector() {
  const { createSession, isLoading, currentSession } = useChatContext();

  const handleTopicSelect = async (topic: Topic) => {
    try {
      await createSession(topic);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  return (
    <LayoutGroup>
      <div className="space-y-1">
        <h3 className="px-3 text-xs font-semibold text-subtle uppercase tracking-wider mb-2">
          New Session
        </h3>
        {TOPICS.map((topic) => {
          const isActive = currentSession?.topic === topic.id;

          return (
            <motion.button
              key={topic.id}
              layoutId={`topic-${topic.id}`}
              onClick={() => handleTopicSelect(topic.id)}
              disabled={isLoading}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left
                         transition-all duration-200 border border-transparent
                         ${isActive
                           ? 'backdrop-blur-md bg-primary-500/30 border-primary-400/30 text-solid shadow-glass'
                           : `text-prominent backdrop-blur-sm bg-white/10 ${topic.color}`
                         }
                         disabled:opacity-50 disabled:cursor-not-allowed`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <motion.span
                className="text-lg"
                layoutId={`topic-icon-${topic.id}`}
              >
                {topic.icon}
              </motion.span>
              <motion.span
                className="font-medium"
                layoutId={`topic-label-${topic.id}`}
              >
                {topic.label}
              </motion.span>
              {isActive && (
                <motion.div
                  layoutId="topic-indicator"
                  className="ml-auto w-2 h-2 rounded-full bg-primary-400"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
