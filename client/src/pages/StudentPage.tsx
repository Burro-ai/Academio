import { useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatCanvas } from '@/components/chat/ChatCanvas';
import { useChatContext } from '@/context/ChatContext';

export function StudentPage() {
  const { loadSessions } = useChatContext();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <ChatCanvas />
    </div>
  );
}
