import { useState, useCallback, useRef, useEffect } from 'react';
import { LessonChatMessage, LessonChatSession, LessonChatResponse } from '@/types';
import { authenticatedFetch } from '@/services/authInterceptor';
import { useAIPipe, SSEEvent } from './useAIPipe';

interface UseLessonChatOptions {
  personalizedLessonId: string;
  onMessageComplete?: (message: LessonChatMessage) => void;
}

interface UseLessonChatReturn {
  session: LessonChatSession | null;
  messages: LessonChatMessage[];
  lesson: LessonChatResponse['lesson'] | null;
  isLoading: boolean;
  isStreaming: boolean;
  isPersonalizing: boolean;
  currentResponse: string;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  cancelStream: () => void;
  reload: () => Promise<void>;
  personalizeLesson: () => Promise<void>;
}

export function useLessonChat({
  personalizedLessonId,
  onMessageComplete,
}: UseLessonChatOptions): UseLessonChatReturn {
  const [session, setSession] = useState<LessonChatSession | null>(null);
  const [messages, setMessages] = useState<LessonChatMessage[]>([]);
  const [lesson, setLesson] = useState<LessonChatResponse['lesson'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Refs for values needed inside stable callbacks
  const sessionRef = useRef(session);
  const pendingMessageRef = useRef('');
  const onMessageCompleteRef = useRef(onMessageComplete);
  sessionRef.current = session;
  onMessageCompleteRef.current = onMessageComplete;

  const { isStreaming, currentResponse, error: streamError, pipe, cancel } = useAIPipe({
    clearResponseOnDone: true,
    onStart: (event: SSEEvent) => {
      const userMessage: LessonChatMessage = {
        id: event.userMessageId || '',
        sessionId: event.sessionId || sessionRef.current?.id || '',
        role: 'user',
        content: pendingMessageRef.current,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
    },
    onDone: (event: SSEEvent, fullText: string) => {
      if (event.assistantMessageId) {
        const assistantMessage: LessonChatMessage = {
          id: event.assistantMessageId,
          sessionId: sessionRef.current?.id || '',
          role: 'assistant',
          content: fullText,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        onMessageCompleteRef.current?.(assistantMessage);
      }
    },
  });

  const loadSession = useCallback(async () => {
    if (!personalizedLessonId) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await authenticatedFetch(`/api/student/lesson-chat/${personalizedLessonId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: LessonChatResponse = await response.json();
      setSession(data.session);
      setMessages(data.messages);
      setLesson(data.lesson);
    } catch (err) {
      console.error('Failed to load lesson chat:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load chat');
    } finally {
      setIsLoading(false);
    }
  }, [personalizedLessonId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!personalizedLessonId || isStreaming) return;
      pendingMessageRef.current = message;
      const params = new URLSearchParams({ lessonId: personalizedLessonId, message });
      await pipe(`/api/student/lesson-chat/stream?${params}`);
    },
    [personalizedLessonId, isStreaming, pipe]
  );

  const personalizeLesson = useCallback(async () => {
    if (!personalizedLessonId || isPersonalizing) return;

    setIsPersonalizing(true);

    try {
      const response = await authenticatedFetch(
        `/api/student/lesson-chat/${personalizedLessonId}/personalize`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: { personalizedContent: string } = await response.json();
      setLesson((prev) => (prev ? { ...prev, content: data.personalizedContent } : prev));
    } catch (err) {
      console.error('Failed to personalize lesson:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to personalize');
    } finally {
      setIsPersonalizing(false);
    }
  }, [personalizedLessonId, isPersonalizing]);

  return {
    session,
    messages,
    lesson,
    isLoading,
    isStreaming,
    isPersonalizing,
    currentResponse,
    error: loadError || streamError,
    sendMessage,
    cancelStream: cancel,
    reload: loadSession,
    personalizeLesson,
  };
}
