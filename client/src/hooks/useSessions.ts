import { useState, useEffect, useCallback } from 'react';
import { Session, Topic, Message } from '@/types';
import { api } from '@/services/api';

interface UseSessionsReturn {
  sessions: Session[];
  currentSession: (Session & { messages: Message[] }) | null;
  isLoading: boolean;
  error: string | null;
  createSession: (topic: Topic, title?: string) => Promise<Session>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  addMessage: (message: Message) => void;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<
    (Session & { messages: Message[] }) | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setError('Failed to load sessions');
    }
  }, []);

  const createSession = useCallback(
    async (topic: Topic, title?: string): Promise<Session> => {
      setIsLoading(true);
      try {
        const session = await api.createSession(topic, title);
        setSessions((prev) => [session, ...prev]);
        setCurrentSession({ ...session, messages: [] });
        return session;
      } catch (err) {
        setError('Failed to create session');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const selectSession = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const session = await api.getSession(id);
      setCurrentSession(session);
    } catch (err) {
      setError('Failed to load session');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await api.deleteSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (currentSession?.id === id) {
          setCurrentSession(null);
        }
      } catch (err) {
        setError('Failed to delete session');
        throw err;
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
      };
    });
  }, []);

  // Load sessions on mount
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  return {
    sessions,
    currentSession,
    isLoading,
    error,
    createSession,
    selectSession,
    deleteSession,
    refreshSessions,
    addMessage,
  };
}
