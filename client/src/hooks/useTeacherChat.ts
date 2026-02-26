import { useCallback, useRef } from 'react';
import { TeacherChatMessage, MaterialType } from '@/types';
import { teacherApi } from '@/services/teacherApi';
import { useAIPipe, SSEEvent } from './useAIPipe';

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
  const assistantMessageIdRef = useRef('');
  const sessionIdRef = useRef('');
  const onMessageCompleteRef = useRef(onMessageComplete);
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
    async (sessionId: string, message: string, materialType?: MaterialType) => {
      if (!sessionId || isStreaming) return;
      sessionIdRef.current = sessionId;
      const url = teacherApi.getStreamUrl(sessionId, message, materialType);
      await pipe(url);
    },
    [isStreaming, pipe]
  );

  return { isStreaming, currentResponse, error, sendMessage, cancelStream: cancel };
}
