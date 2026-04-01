import { useEffect, useRef, useCallback } from 'react';
import { TTSStatus } from './use-kokoro-tts';

interface UseResponseQueueProps {
  isOpen: boolean;
  lastAssistantMessage: string | null;
  isStreaming: boolean;
  ttsStatus: TTSStatus;
  startStream: () => Promise<void>;
  pushText: (text: string) => void;
  closeStream: () => void;
  stop: () => void;
  setHasStartedPlayback: (started: boolean) => void;
}

export function useResponseQueue({
  isOpen,
  lastAssistantMessage,
  isStreaming,
  ttsStatus,
  startStream,
  pushText,
  closeStream,
  stop,
  setHasStartedPlayback
}: UseResponseQueueProps) {
  const processedLengthRef = useRef(0);
  const hasInitializedOpenRef = useRef(false);
  const isStreamActiveRef = useRef(false);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const clearQueue = useCallback(() => {
    processedLengthRef.current = 0;
    isStreamActiveRef.current = false;
    stop();
    setHasStartedPlayback(false);
  }, [stop, setHasStartedPlayback]);

  useEffect(() => {
    if (!isOpen) {
      hasInitializedOpenRef.current = false;
      if (isStreamActiveRef.current) {
        closeStream();
        isStreamActiveRef.current = false;
      }
      return;
    }

    if (!hasInitializedOpenRef.current) {
      processedLengthRef.current = lastAssistantMessage?.length || 0;
      hasInitializedOpenRef.current = true;
      return;
    }

    if (!lastAssistantMessage) {
      clearQueue();
      return;
    }

    const newText = lastAssistantMessage.slice(processedLengthRef.current);
    if (newText.length === 0 && isStreaming) return;

    if (!isStreamActiveRef.current && newText.length > 0 && ttsStatus === 'ready') {
      isStreamActiveRef.current = true;
      startStream();
    }

    if (isStreamActiveRef.current && newText.length > 0) {
      pushText(newText);
      processedLengthRef.current = lastAssistantMessage.length;
    }

    if (!isStreaming && isStreamActiveRef.current) {
      closeStream();
      isStreamActiveRef.current = false;
    }

  }, [
    lastAssistantMessage,
    isStreaming,
    isOpen,
    ttsStatus,
    startStream,
    pushText,
    closeStream,
    clearQueue,
    setHasStartedPlayback
  ]);

  return {
    clearQueue
  };
}
