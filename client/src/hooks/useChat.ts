import { useState, useCallback, useRef } from 'react';
import { Message, StreamEvent } from '@/types';

interface UseChatOptions {
  sessionId: string;
  studentId?: string; // For personalized AI responses
  onMessageComplete?: (message: Message) => void;
}

interface UseChatReturn {
  isStreaming: boolean;
  currentResponse: string;
  error: string | null;
  sendMessage: (message: string, attachmentContext?: string) => Promise<void>;
  cancelStream: () => void;
}

export function useChat({ sessionId, studentId, onMessageComplete }: UseChatOptions): UseChatReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const cancelStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (message: string, attachmentContext?: string) => {
      if (!sessionId || isStreaming) return;

      // Cancel any existing stream
      cancelStream();

      setIsStreaming(true);
      setCurrentResponse('');
      setError(null);

      // Prepare message with attachment context if provided
      const fullMessage = attachmentContext
        ? `${message}\n\n[Attached content: ${attachmentContext}]`
        : message;

      // Build SSE URL with query parameters
      const params = new URLSearchParams({
        sessionId,
        message: fullMessage,
      });

      // Add studentId for personalized AI responses
      if (studentId) {
        params.append('studentId', studentId);
      }

      try {
        // Use fetch with streaming for better control
        abortControllerRef.current = new AbortController();

        const response = await fetch(`/api/chat/stream?${params}`, {
          method: 'GET',
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
                  const event: StreamEvent = JSON.parse(data);

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
          // Stream was cancelled
          return;
        }
        console.error('Stream error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [sessionId, studentId, isStreaming, cancelStream, onMessageComplete]
  );

  return {
    isStreaming,
    currentResponse,
    error,
    sendMessage,
    cancelStream,
  };
}
