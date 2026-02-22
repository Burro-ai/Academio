import { useState, useCallback, useRef, useEffect } from 'react';
import { LessonChatMessage, LessonChatSession, LessonChatResponse } from '@/types';
import { authApi } from '@/services/authApi';

interface StreamEvent {
  type: 'start' | 'token' | 'done' | 'error';
  content?: string;
  sessionId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  error?: string;
}

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
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load existing session and messages
  const loadSession = useCallback(async () => {
    if (!personalizedLessonId) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = authApi.getToken();
      const response = await fetch(`/api/student/lesson-chat/${personalizedLessonId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: LessonChatResponse = await response.json();
      setSession(data.session);
      setMessages(data.messages);
      setLesson(data.lesson);
    } catch (err) {
      console.error('Failed to load lesson chat:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chat');
    } finally {
      setIsLoading(false);
    }
  }, [personalizedLessonId]);

  // Load on mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!personalizedLessonId || isStreaming) return;

      // Cancel any existing stream
      cancelStream();

      setIsStreaming(true);
      setCurrentResponse('');
      setError(null);

      // Build SSE URL with query parameters
      const params = new URLSearchParams({
        lessonId: personalizedLessonId,
        message,
      });

      // Build headers with JWT auth token
      const headers: Record<string, string> = {};
      const token = authApi.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch(`/api/student/lesson-chat/stream?${params}`, {
          method: 'GET',
          headers,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponseText = '';
        let userMessageId = '';
        let assistantMessageId = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data.trim()) {
                try {
                  const event: StreamEvent = JSON.parse(data);

                  switch (event.type) {
                    case 'start':
                      userMessageId = event.userMessageId || '';
                      assistantMessageId = event.assistantMessageId || '';

                      // Add user message to the list
                      const userMessage: LessonChatMessage = {
                        id: userMessageId,
                        sessionId: event.sessionId || session?.id || '',
                        role: 'user',
                        content: message,
                        timestamp: new Date().toISOString(),
                      };
                      setMessages((prev) => [...prev, userMessage]);
                      break;

                    case 'token':
                      if (event.content) {
                        fullResponseText += event.content;
                        setCurrentResponse(fullResponseText);
                      }
                      break;

                    case 'done':
                      if (assistantMessageId) {
                        const assistantMessage: LessonChatMessage = {
                          id: assistantMessageId,
                          sessionId: session?.id || '',
                          role: 'assistant',
                          content: fullResponseText,
                          timestamp: new Date().toISOString(),
                        };
                        setMessages((prev) => [...prev, assistantMessage]);

                        if (onMessageComplete) {
                          onMessageComplete(assistantMessage);
                        }
                      }
                      break;

                    case 'error':
                      setError(event.error || 'Unknown error');
                      break;
                  }
                } catch (e) {
                  console.error('Failed to parse SSE event:', data);
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Stream was cancelled
          return;
        }
        console.error('Stream error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setIsStreaming(false);
        setCurrentResponse('');
        abortControllerRef.current = null;
      }
    },
    [personalizedLessonId, isStreaming, cancelStream, session, onMessageComplete]
  );

  /**
   * Trigger on-demand AI personalization for this lesson
   */
  const personalizeLesson = useCallback(async () => {
    if (!personalizedLessonId || isPersonalizing) return;

    setIsPersonalizing(true);

    try {
      const token = authApi.getToken();
      const response = await fetch(`/api/student/lesson-chat/${personalizedLessonId}/personalize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: { personalizedContent: string } = await response.json();

      // Update the lesson content in state
      setLesson((prev) =>
        prev ? { ...prev, content: data.personalizedContent } : prev
      );
    } catch (err) {
      console.error('Failed to personalize lesson:', err);
      setError(err instanceof Error ? err.message : 'Failed to personalize');
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
    error,
    sendMessage,
    cancelStream,
    reload: loadSession,
    personalizeLesson,
  };
}
