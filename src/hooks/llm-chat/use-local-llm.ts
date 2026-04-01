import { useCallback } from 'react';
import { useLocalLLM } from '@/app/services/local-llm-provider';
import { ENGINE_CONFIG } from '@/config/llm';
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";

interface EngineConfig {
    temperature: number;
    max_tokens: number;
    seed?: number;
    repetition_penalty?: number;
    presence_penalty?: number;
}

interface UseLocalLLMProps {
    apiPath?: string;
    engineConfig?: EngineConfig;
}

export function useLocalAgent({ apiPath = '/api/chat', engineConfig = ENGINE_CONFIG.default }: UseLocalLLMProps = {}) {
    const localLLM = useLocalLLM();

    const generateResponse = useCallback(async (
        payload: { message: string, mode?: string, modelId?: string, [key: string]: unknown },
        signal: AbortSignal,
        onChunk: (fullText: string) => void
    ) => {
        if (!localLLM.isReady) throw new Error("Local LLM not ready");

        const prepPayload = {
            ...payload,
            mode: payload.mode || 'prepare_local',
            action: 'prepare_local',
            modelId: localLLM.modelId
        };

        const prepRes = await fetch(apiPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prepPayload)
        });

        if (!prepRes.ok) throw new Error("Failed to prepare local agent");
        const prepData = await prepRes.json();

        const { systemPrompt, history = [], messageId } = prepData;

        const completionMessages: ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: payload.message }
        ];

        let fullResponse = "";

        await localLLM.generate(completionMessages, (currentText) => {
            fullResponse = currentText;
            onChunk(currentText);
        }, signal, engineConfig);

        const completePromise = (async () => {
            try {
                const completePayload = {
                    mode: 'complete_local',
                    action: 'complete_local',
                    messageId,
                    content: fullResponse,
                    message: "Check complete"
                };

                const completeRes = await fetch(apiPath, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(completePayload)
                });
                return await completeRes.json();
            } catch (err) {
                console.error("Background save failed", err);
                return null;
            }
        })();

        return {
            fullResponse,
            completeDataPromise: completePromise
        };

    }, [localLLM, apiPath, engineConfig]);

    return { generateResponse, isReady: localLLM.isReady };
}
