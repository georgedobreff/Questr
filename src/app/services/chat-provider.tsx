"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Message, VoiceModeContextType } from '@/types/chat';
import { useMessageState } from '@/hooks/llm-chat/use-message-state';
import { useTypingLoop } from '@/hooks/llm-chat/use-typing-loop';
import { useCloudStream } from '@/hooks/llm-chat/use-cloud-stream';
export type { VoiceModeContextType };

const VoiceModeContext = createContext<VoiceModeContextType | undefined>(undefined);

export function VoiceModeProvider({ children, initialMessages = [] }: { children: React.ReactNode, initialMessages?: Message[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [minimizedPosition, setMinimizedPosition] = useState({ x: 0, y: 0 });
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [voiceActivityTimestamp, setVoiceActivityTimestamp] = useState(0);
  const { messages, setMessages, addMessage, updateMessage, removeMessage } = useMessageState(initialMessages);
  const { fetchStream } = useCloudStream({ apiPath: '/api/chat' });
  const fullContentRef = useRef("");
  const isStreamDoneRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const wasCancelledRef = useRef(false);
  const { startTypingLoop } = useTypingLoop({
    onUpdate: (content) => {
    }
  });

  const notifyVoiceActivity = useCallback(() => {
    setVoiceActivityTimestamp(Date.now());
  }, []);

  const stop = useCallback(() => {
    wasCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsLoading(false);
    setLastAssistantMessage(null);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    if (content.length > 1000) {
      toast.error("Message cannot be longer than 1000 characters.");
      return;
    }

    wasCancelledRef.current = false;
    fullContentRef.current = "";
    isStreamDoneRef.current = false;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content };
    addMessage(userMessage);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);
    setLastAssistantMessage("");

    const assistantMessageId = (Date.now() + 1).toString();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const typingController = await startTypingLoop(
      () => fullContentRef.current,
      () => !abortController.signal.aborted,
      () => isStreamDoneRef.current
    );

    addMessage({ id: assistantMessageId, role: 'assistant', content: '' });

    const updateCurrentMessage = (text: string) => {
      updateMessage(assistantMessageId, { content: text });
      setLastAssistantMessage(text);
    };

    const runVisualLoop = async () => {
      let displayed = "";
      while (!abortController.signal.aborted) {
        const full = fullContentRef.current;
        const done = isStreamDoneRef.current;

        if (full.length > displayed.length) {
          const step = (full.length - displayed.length) > 50 ? 5 : 2;
          displayed = full.slice(0, displayed.length + step);
          updateCurrentMessage(displayed);
          await new Promise(r => setTimeout(r, Math.random() * 20 + 10));
        } else if (done && full === displayed) {
          break;
        } else {
          await new Promise(r => setTimeout(r, 50));
        }
      }
    };

    const visualPromise = runVisualLoop();

    try {

      await fetchStream(
        { message: content },
        abortController.signal,
        (chunk) => { fullContentRef.current = chunk; }
      );

      isStreamDoneRef.current = true;
      await visualPromise;

    } catch (error: any) {
      if (abortController.signal.aborted) {
        const cancelledText = fullContentRef.current + " [Cancelled]";
        updateMessage(assistantMessageId, { content: cancelledText });
      } else {
        toast.error("Something went wrong. Try again.");
        removeMessage(userMessage.id);
        removeMessage(assistantMessageId);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }

  }, [addMessage, updateMessage, removeMessage, fetchStream]);

  return (
    <VoiceModeContext.Provider value={{
      isOpen,
      isMinimized,
      minimizedPosition,
      lastAssistantMessage,
      isStreaming,
      messages,
      isLoading,
      setIsLoading,
      setIsOpen,
      setIsMinimized,
      setMinimizedPosition,
      sendMessage,
      stop,
      setMessages,
      input,
      setInput,
      voiceActivityTimestamp,
      notifyVoiceActivity
    }}>
      {children}
    </VoiceModeContext.Provider>
  );
}

export function useVoiceMode() {
  const context = useContext(VoiceModeContext);
  if (context === undefined) {
    throw new Error('useVoiceMode must be used within a VoiceModeProvider');
  }
  return context;
}