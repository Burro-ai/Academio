/**
 * useAIPipe — Universal SSE streaming hook.
 *
 * Centralizes the SSE reader loop so all chat hooks share one
 * implementation. Callers supply callbacks; the pipe handles
 * auth (via authenticatedFetch), buffering, and abort control.
 *
 * Usage:
 *   const { isStreaming, currentResponse, error, pipe, cancel } = useAIPipe({
 *     onStart: (event) => { ... },
 *     onDone: (event, fullText) => { ... },
 *     clearResponseOnDone: true,
 *   });
 *   await pipe('/api/student/lesson-chat/stream?...');
 */

import { useState, useCallback, useRef } from 'react';
import { authenticatedFetch } from '@/services/authInterceptor';

export interface SSEEvent {
  type: 'start' | 'token' | 'done' | 'error';
  content?: string;
  sessionId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  error?: string;
}

interface UseAIPipeOptions {
  /** Called when the server emits a 'start' event (contains userMessageId / assistantMessageId). */
  onStart?: (event: SSEEvent) => void;
  /**
   * Called when the server emits a 'done' event.
   * The event is enriched with assistantMessageId / userMessageId captured from 'start'.
   */
  onDone?: (event: SSEEvent, fullText: string) => void;
  /** Called on stream or network errors. */
  onError?: (message: string) => void;
  /**
   * When true, currentResponse is cleared in the finally block after streaming ends.
   * Use for hooks that maintain a separate messages array (lesson/homework chat).
   * Default: false (student/teacher general chat keep the response visible).
   */
  clearResponseOnDone?: boolean;
}

export interface UseAIPipeReturn {
  isStreaming: boolean;
  currentResponse: string;
  error: string | null;
  /** Starts streaming from the given URL. Cancels any in-progress stream first. */
  pipe: (url: string) => Promise<void>;
  cancel: () => void;
}

export function useAIPipe({
  onStart,
  onDone,
  onError,
  clearResponseOnDone = false,
}: UseAIPipeOptions = {}): UseAIPipeReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Store callbacks in refs so pipe() stays stable across renders.
  // Updated synchronously on every render — always current when pipe() runs.
  const onStartRef = useRef(onStart);
  const onDoneRef = useRef(onDone);
  const onErrorRef = useRef(onError);
  onStartRef.current = onStart;
  onDoneRef.current = onDone;
  onErrorRef.current = onError;

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const pipe = useCallback(
    async (url: string) => {
      // Cancel any previous stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      setIsStreaming(true);
      setCurrentResponse('');
      setError(null);

      // Track IDs from 'start' event so onDone receives them even if the
      // server's 'done' payload omits them.
      let capturedUserMessageId = '';
      let capturedAssistantMessageId = '';

      try {
        abortControllerRef.current = new AbortController();

        const response = await authenticatedFetch(url, {
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data.trim()) {
                try {
                  const event: SSEEvent = JSON.parse(data);

                  switch (event.type) {
                    case 'start':
                      capturedUserMessageId = event.userMessageId || '';
                      capturedAssistantMessageId = event.assistantMessageId || '';
                      onStartRef.current?.(event);
                      break;

                    case 'token':
                      if (event.content) {
                        fullResponseText += event.content;
                        setCurrentResponse(fullResponseText);
                      }
                      break;

                    case 'done':
                      onDoneRef.current?.(
                        {
                          ...event,
                          userMessageId: event.userMessageId || capturedUserMessageId,
                          assistantMessageId: event.assistantMessageId || capturedAssistantMessageId,
                        },
                        fullResponseText
                      );
                      break;

                    case 'error':
                      setError(event.error || 'Unknown error');
                      onErrorRef.current?.(event.error || 'Unknown error');
                      break;
                  }
                } catch {
                  // Skip malformed JSON chunks
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('[useAIPipe] Stream error:', err);
        const message = err instanceof Error ? err.message : 'Failed to connect';
        setError(message);
        onErrorRef.current?.(message);
      } finally {
        setIsStreaming(false);
        if (clearResponseOnDone) setCurrentResponse('');
        abortControllerRef.current = null;
      }
    },
    [cancel, clearResponseOnDone]
  );

  return { isStreaming, currentResponse, error, pipe, cancel };
}
