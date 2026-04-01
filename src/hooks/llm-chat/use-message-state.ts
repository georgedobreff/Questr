import { useState, useCallback } from 'react';
import { Message } from '@/types/chat';

export function useMessageState(initialMessages: Message[] = []) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);

    const addMessage = useCallback((message: Message) => {
        setMessages((prev) => [...prev, message]);
    }, []);

    const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
        setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
        );
    }, []);

    const removeMessage = useCallback((id: string) => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
    }, []);

    return {
        messages,
        setMessages,
        addMessage,
        updateMessage,
        removeMessage,
    };
}
