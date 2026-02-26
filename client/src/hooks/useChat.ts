import { useCallback, useRef } from 'react';
import { Message } from '@/types';
import { useAIPipe, SSEEvent } from './useAIPipe';

interface UseChatOptions {
  sessionId: string;
  onMessageComplete?: (message: Message) => void;
}

interface UseChatReturn {
  isStreaming: boolean;
  currentResponse: string;
  error: string | null;
  sendMessage: (message: string, attachmentContext?: string) => Promise<void>;
  cancelStream: () => void;
}

export function useChat({ sessionId, onMessageComplete }: UseChatOptions): UseChatReturn {
  const assistantMessageIdRef = useRef('');
  const sessionIdRef = useRef(sessionId);
  const onMessageCompleteRef = useRef(onMessageComplete);
  sessionIdRef.current = sessionId;
  onMessageCompleteRef.current = onMessageComplete;

  const { isStreaming, currentResponse, error, pipe, cancel } = useAIPipe({
    onStart: (event: SSEEvent) => {
      assistantMessageIdRef.current = event.assistantMessageId || '';
    },
    onDone: (_event: SSEEvent, fullText: string) => {
      if (onMessageCompleteRef.current && assistantMessageIdRef.current) {
        onMessageCompleteRef.current({
          id: assistantMessageIdRef.current,
          sessionId: sessionIdRef.current,
          role: 'assistant',
          content: fullText,
          timestamp: new Date().toISOString(),
        });
      }
    },
  });

  const sendMessage = useCallback(
    async (message: string, attachmentContext?: string) => {
      if (!sessionId || isStreaming) return;

      const fullMessage = attachmentContext
        ? `${message}\n\n[Attached content: ${attachmentContext}]`
        : message;

      const params = new URLSearchParams({ sessionId, message: fullMessage });
      await pipe(`/api/chat/stream?${params}`);
    },
    [sessionId, isStreaming, pipe]
  );

  return { isStreaming, currentResponse, error, sendMessage, cancelStream: cancel };
}
