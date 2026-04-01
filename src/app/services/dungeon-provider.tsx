"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Message, VoiceModeContextType } from '@/types/chat';
import { useMessageState } from '@/hooks/llm-chat/use-message-state';
import { useKokoroTTS } from '@/hooks/llm-chat/use-kokoro-tts';
import { KOKORO_CONFIG } from '@/config/tts';

interface InternalDungeonContext extends VoiceModeContextType { }

const DungeonContext = createContext<InternalDungeonContext | undefined>(undefined);

interface DungeonProviderProps {
    children: React.ReactNode;
    initialMessages?: Message[];
    onDungeonUpdate?: (data: any) => void;
}

export function DungeonProvider({ children, initialMessages = [], onDungeonUpdate }: DungeonProviderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [minimizedPosition, setMinimizedPosition] = useState({ x: 0, y: 0 });

    const { messages, setMessages, addMessage, updateMessage, removeMessage } = useMessageState(initialMessages);
    const [input, setInput] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [lastAssistantMessage, setLastAssistantMessage] = useState<string | null>(null);
    const [voiceActivityTimestamp, setVoiceActivityTimestamp] = useState(0);

    const tts = useKokoroTTS({ voice: KOKORO_CONFIG.dungeonVoice });

    const abortControllerRef = useRef<AbortController | null>(null);
    const fullContentRef = useRef("");
    const isStreamDoneRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
        }
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [isOpen]);

    const notifyVoiceActivity = useCallback(() => {
        setVoiceActivityTimestamp(Date.now());
    }, []);

    const stop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsStreaming(false);
        setIsLoading(false);
        setLastAssistantMessage(null);
        tts.stop();
    }, [tts]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim()) return;

        if (content.length > 1000) {
            toast.error("Message too long.");
            return;
        }

        fullContentRef.current = "";
        isStreamDoneRef.current = false;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content };
        addMessage(userMsg);
        setInput('');
        setIsLoading(true);
        setIsStreaming(true);
        setLastAssistantMessage("");

        const assistantId = (Date.now() + 1).toString();
        addMessage({ id: assistantId, role: 'assistant', content: '' });

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const processLoop = async () => {
            let displayed = "";

            while (!abortController.signal.aborted) {
                const full = fullContentRef.current;
                const done = isStreamDoneRef.current;

                if (full.length > displayed.length) {
                    const step = (full.length - displayed.length) > 50 ? 5 : 2;
                    displayed = full.slice(0, displayed.length + step);

                    updateMessage(assistantId, { content: displayed });
                    setLastAssistantMessage(displayed);

                    await new Promise(r => setTimeout(r, Math.random() * 20 + 10));
                } else if (done && full === displayed) {
                    break;
                } else {
                    await new Promise(r => setTimeout(r, 50));
                }
            }
        };

        const displayPromise = processLoop();

        try {
            const payload = {
                action: 'continue',
                message: content
            };

            const res = await fetch('/api/adventure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: abortController.signal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Connection Error");

            fullContentRef.current = data.message || "";

            if (data.action) {
                updateMessage(assistantId, { action: data.action });
            }
            if (onDungeonUpdate) onDungeonUpdate(data);

            isStreamDoneRef.current = true;
            await displayPromise;

        } catch (e: unknown) {
            const error = e as Error;
            if (!abortController.signal.aborted) {
                toast.error("Something went wrong. Try again.");
                removeMessage(userMsg.id);
                removeMessage(assistantId);
            }
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            abortControllerRef.current = null;
        }

    }, [addMessage, updateMessage, removeMessage, onDungeonUpdate, tts.stop]);

    return (
        <DungeonContext.Provider value={{
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
        </DungeonContext.Provider>
    );
}

export function useDungeon() {
    const context = useContext(DungeonContext);
    if (context === undefined) {
        throw new Error('useDungeon must be used within a DungeonProvider');
    }
    return context;
}
