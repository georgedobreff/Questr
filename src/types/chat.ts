import React from 'react';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    action?: any;
}

export interface VoiceModeContextType {
    isOpen: boolean;
    isMinimized: boolean;
    minimizedPosition: { x: number; y: number };
    lastAssistantMessage: string | null;
    isStreaming: boolean;
    messages: Message[];
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    setIsOpen: (open: boolean) => void;
    setIsMinimized: (minimized: boolean) => void;
    setMinimizedPosition: (pos: { x: number; y: number }) => void;
    sendMessage: (content: string) => Promise<void>;
    stop: () => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    input: string;
    setInput: (input: string) => void;
    voiceActivityTimestamp: number;
    notifyVoiceActivity: () => void;
}
