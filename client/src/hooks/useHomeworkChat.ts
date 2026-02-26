/**
 * useHomeworkChat - SSE Hook for Homework Sidekick Chat
 *
 * Follows useLessonChat pattern. Uses useAIPipe for shared SSE logic.
 * Features:
 * - SSE streaming for real-time responses
 * - Session management
 * - Message history
 * - Question context support
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  HomeworkChatMessage,
  HomeworkChatSession,
  HomeworkChatResponse,
  HomeworkQuestionJson,
} from '@/types';
import { authenticatedFetch } from '@/services/authInterceptor';
import { useAIPipe, SSEEvent } from './useAIPipe';

interface UseHomeworkChatOptions {
  personalizedHomeworkId: string;
  onMessageComplete?: (message: HomeworkChatMessage) => void;
}

interface UseHomeworkChatReturn {
  session: HomeworkChatSession | null;
  messages: HomeworkChatMessage[];
  homework: HomeworkChatResponse['homework'] | null;
  questions: HomeworkQuestionJson[];
  isLoading: boolean;
  isStreaming: boolean;
  currentResponse: string;
  error: string | null;
  sendMessage: (message: string, questionContext?: string) => Promise<void>;
  cancelStream: () => void;
  reload: () => Promise<void>;
}

export function useHomeworkChat({
  personalizedHomeworkId,
  onMessageComplete,
}: UseHomeworkChatOptions): UseHomeworkChatReturn {
  const [session, setSession] = useState<HomeworkChatSession | null>(null);
  const [messages, setMessages] = useState<HomeworkChatMessage[]>([]);
  const [homework, setHomework] = useState<HomeworkChatResponse['homework'] | null>(null);
  const [questions, setQuestions] = useState<HomeworkQuestionJson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Refs for values needed inside stable callbacks
  const sessionRef = useRef(session);
  const pendingMessageRef = useRef('');
  const pendingQuestionContextRef = useRef<string | undefined>(undefined);
  const onMessageCompleteRef = useRef(onMessageComplete);
  sessionRef.current = session;
  onMessageCompleteRef.current = onMessageComplete;

  const { isStreaming, currentResponse, error: streamError, pipe, cancel } = useAIPipe({
    clearResponseOnDone: true,
    onStart: (event: SSEEvent) => {
      const userMessage: HomeworkChatMessage = {
        id: event.userMessageId || '',
        sessionId: event.sessionId || sessionRef.current?.id || '',
        role: 'user',
        content: pendingMessageRef.current,
        questionContext: pendingQuestionContextRef.current,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
    },
    onDone: (event: SSEEvent, fullText: string) => {
      if (event.assistantMessageId) {
        const assistantMessage: HomeworkChatMessage = {
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
    if (!personalizedHomeworkId) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await authenticatedFetch(
        `/api/student/homework-chat/${personalizedHomeworkId}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: HomeworkChatResponse = await response.json();
      setSession(data.session);
      setMessages(data.messages);
      setHomework(data.homework);
      setQuestions(data.homework.questions || []);
    } catch (err) {
      console.error('Failed to load homework chat:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load chat');
    } finally {
      setIsLoading(false);
    }
  }, [personalizedHomeworkId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const sendMessage = useCallback(
    async (message: string, questionContext?: string) => {
      if (!personalizedHomeworkId || isStreaming) return;

      pendingMessageRef.current = message;
      pendingQuestionContextRef.current = questionContext;

      const params = new URLSearchParams({ homeworkId: personalizedHomeworkId, message });
      if (questionContext) params.append('questionContext', questionContext);

      await pipe(`/api/student/homework-chat/stream?${params}`);
    },
    [personalizedHomeworkId, isStreaming, pipe]
  );

  return {
    session,
    messages,
    homework,
    questions,
    isLoading,
    isStreaming,
    currentResponse,
    error: loadError || streamError,
    sendMessage,
    cancelStream: cancel,
    reload: loadSession,
  };
}
