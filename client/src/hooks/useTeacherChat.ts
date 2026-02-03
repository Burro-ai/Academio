import { useState, useCallback, useRef } from 'react';
import { TeacherChatMessage, TeacherStreamEvent, MaterialType } from '@/types';
import { teacherApi } from '@/services/teacherApi';

interface UseTeacherChatOptions {
  onMessageComplete?: (message: TeacherChatMessage) => void;
}

interface UseTeacherChatReturn {
  isStreaming: boolean;
  currentResponse: string;
  error: string | null;
  sendMessage: (sessionId: string, message: string, materialType?: MaterialType) => Promise<void>;
  cancelStream: () => void;
}

export function useTeacherChat({
  onMessageComplete,
}: UseTeacherChatOptions = {}): UseTeacherChatReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (sessionId: string, message: string, materialType?: MaterialType) => {
      if (!sessionId || isStreaming) return;

      // Cancel any existing stream
      cancelStream();

      setIsStreaming(true);
      setCurrentResponse('');
      setError(null);

      // Build SSE URL
      const url = teacherApi.getStreamUrl(sessionId, message, materialType);

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('teacherPassword')}`,
          },
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
                  const event: TeacherStreamEvent = JSON.parse(data);

                  switch (event.type) {
                    case 'start':
                      assistantMessageId = event.assistantMessageId || '';
                      break;

                    case 'token':
                      if (event.content) {
                        fullResponseText += event.content;
                        setCurrentResponse(fullResponseText);
                      }
                      break;

                    case 'done':
                      if (onMessageComplete && assistantMessageId) {
                        onMessageComplete({
                          id: assistantMessageId,
                          sessionId,
                          role: 'assistant',
                          content: fullResponseText,
                          timestamp: new Date().toISOString(),
                        });
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
          return;
        }
        console.error('Stream error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, cancelStream, onMessageComplete]
  );

  return {
    isStreaming,
    currentResponse,
    error,
    sendMessage,
    cancelStream,
  };
}
