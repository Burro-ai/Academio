/**
 * Format a date string to a human-readable format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

/**
 * Format file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get topic display info
 */
export function getTopicInfo(topic: string): { label: string; color: string; icon: string } {
  const topics: Record<string, { label: string; color: string; icon: string }> = {
    math: {
      label: 'Math',
      color: 'bg-blue-100 text-blue-700',
      icon: '📐',
    },
    science: {
      label: 'Science',
      color: 'bg-green-100 text-green-700',
      icon: '🔬',
    },
    history: {
      label: 'History',
      color: 'bg-amber-100 text-amber-700',
      icon: '📜',
    },
    writing: {
      label: 'Writing',
      color: 'bg-purple-100 text-purple-700',
      icon: '✍️',
    },
    general: {
      label: 'General',
      color: 'bg-gray-100 text-gray-700',
      icon: '💡',
    },
  };

  return topics[topic] || topics.general;
}
