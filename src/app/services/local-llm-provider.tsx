'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { CreateMLCEngine, MLCEngine, InitProgressCallback, ChatCompletionMessageParam, prebuiltAppConfig } from "@mlc-ai/web-llm";
import { toast } from 'sonner';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

import { createClient } from "@/lib/supabase/client";
import { BASE_DESKTOP, BASE_MOBILE, ENGINE_CONFIG, ENGINE_LOG_LEVEL, ModelId } from "@/config/llm";

interface NavigatorWithMemory extends Navigator {
    deviceMemory?: number;
}

// ModelId type is re-exported from @/config/llm for backwards compatibility
export type { ModelId } from "@/config/llm";

interface EngineConfig {
    temperature: number;
    max_tokens: number;
    seed?: number;
    repetition_penalty?: number;
    presence_penalty?: number;
}

export interface LocalLLMState {
    isReady: boolean;
    isLoading: boolean;
    progress: number;
    text: string;
    modelId: ModelId | null;
}

interface LocalLLMContextType extends LocalLLMState {
    loadModel: (modelId: ModelId) => Promise<void>;
    generate: (messages: ChatCompletionMessageParam[], onUpdate: (text: string) => void, signal?: AbortSignal, config?: EngineConfig) => Promise<string>;
}

const LocalLLMContext = createContext<LocalLLMContextType | null>(null);

function getRecommendedModel(): ModelId {
    if (typeof navigator === 'undefined') return BASE_MOBILE;


    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) {
        return BASE_DESKTOP;
    }


    return BASE_MOBILE;
}

export function LocalLLMProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<LocalLLMState>({
        isReady: false,
        isLoading: false,
        progress: 0,
        text: '',
        modelId: null
    });

    const engineRef = useRef<MLCEngine | null>(null);
    const supabase = createClient();

    useEffect(() => {
        return () => {
            engineRef.current?.unload();
        };
    }, []);

    const initCallback: InitProgressCallback = useCallback((report) => {
        setState(prev => ({
            ...prev,
            progress: report.progress,
            text: report.text
        }));
    }, []);

    const loadModel = useCallback(async (modelId: ModelId) => {
        if (engineRef.current && state.modelId === modelId && state.isReady) return;

        if (typeof window !== 'undefined') {
            localStorage.setItem('oracle_model_pref', modelId);
        }

        setState(prev => ({ ...prev, isLoading: true, modelId, progress: 0, text: 'Starting engine...' }));

        try {
            if (engineRef.current) {
                await engineRef.current.unload();
                engineRef.current = null;
            }

            const engine = await CreateMLCEngine(modelId, {
                initProgressCallback: initCallback,
                logLevel: ENGINE_LOG_LEVEL
            });

            engineRef.current = engine;

            setState(prev => ({
                ...prev,
                isLoading: false,
                isReady: true,
                text: 'Ready'
            }));

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error("Failed to load local model:", errorMessage);
            setState(prev => ({
                ...prev,
                isLoading: false,
                isReady: false,
                text: 'Failed to load',
                modelId: null
            }));
        }
    }, [initCallback, state.modelId, state.isReady]);


    useEffect(() => {
        const handleSession = (session: Session | null) => {
            if (!session) return;

            if (engineRef.current || state.isLoading || state.isReady) return;

            const pref = localStorage.getItem('oracle_model_pref') as ModelId | null;
            const modelToLoad = pref || getRecommendedModel();


            loadModel(modelToLoad);
        };

        supabase.auth.getSession().then((response: { data: { session: Session | null } }) => {
            handleSession(response.data.session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
            handleSession(session);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [loadModel, state.isLoading, state.isReady, supabase.auth]);

    const generate = useCallback(async (
        messages: ChatCompletionMessageParam[],
        onUpdate: (currentFullText: string) => void,
        signal?: AbortSignal,
        config: EngineConfig = ENGINE_CONFIG.default
    ): Promise<string> => {
        if (!engineRef.current || !state.isReady) {
            throw new Error("Engine not ready");
        }

        let fullResponse = "";

        try {
            const cleanMessages = messages.map(m => ({
                ...m,
                content: (m.content || "") as string
            }));

            const chunks = await engineRef.current.chat.completions.create({
                messages: cleanMessages,
                stream: true,
                ...config,
            });

            for await (const chunk of chunks) {
                if (signal?.aborted) {
                    await engineRef.current.interruptGenerate();
                    throw new Error('AbortError');
                }
                const delta = chunk.choices[0]?.delta.content || "";
                fullResponse += delta;
                onUpdate(fullResponse);
            }

            return fullResponse;

        } catch (error) {
            console.error("Local Generation Error:", error);
            throw error;
        }
    }, [state.isReady]);

    return (
        <LocalLLMContext.Provider value={{ ...state, loadModel, generate }}>
            {children}
        </LocalLLMContext.Provider>
    );
}

export function useLocalLLM() {
    const context = useContext(LocalLLMContext);
    if (!context) {
        throw new Error("useLocalLLM must be used within a LocalLLMProvider");
    }
    return context;
}
