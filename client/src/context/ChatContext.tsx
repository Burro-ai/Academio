import React, { createContext, useContext, useState, useCallback } from 'react';
import { Session, Message, Topic } from '@/types';
import { api } from '@/services/api';

interface ChatContextValue {
  sessions: Session[];
  currentSession: (Session & { messages: Message[] }) | null;
  isLoading: boolean;
  loadSessions: () => Promise<void>;
  createSession: (topic: Topic, title?: string) => Promise<Session>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateCurrentSessionMessages: (messages: Message[]) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<
    (Session & { messages: Message[] }) | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, []);

  const createSession = useCallback(async (topic: Topic, title?: string) => {
    setIsLoading(true);
    try {
      const session = await api.createSession(topic, title);
      setSessions((prev) => [session, ...prev]);
      setCurrentSession({ ...session, messages: [] });
      return session;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectSession = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const session = await api.getSession(id);
      setCurrentSession(session);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      await api.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (currentSession?.id === id) {
        setCurrentSession(null);
      }
    },
    [currentSession]
  );

  const addMessage = useCallback((message: Message) => {
    setCurrentSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, message],
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const updateCurrentSessionMessages = useCallback((messages: Message[]) => {
    setCurrentSession((prev) => {
      if (!prev) return prev;
      return { ...prev, messages };
    });
  }, []);

  return (
    <ChatContext.Provider
      value={{
        sessions,
        currentSession,
        isLoading,
        loadSessions,
        createSession,
        selectSession,
        deleteSession,
        addMessage,
        updateCurrentSessionMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
