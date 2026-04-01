import { useCallback } from 'react';

interface UseCloudStreamProps {
    apiPath?: string;
}

export function useCloudStream({ apiPath = '/api/chat' }: UseCloudStreamProps = {}) {

    const fetchStream = useCallback(async (
        payload: any,
        signal: AbortSignal,
        onChunk: (chunk: string) => void
    ) => {
        const response = await fetch(apiPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal,
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || (response.status === 429 ? "You're going too fast." : 'An error occurred.'));
        }

        if (!response.body) throw new Error("No response body.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (signal.aborted) throw new Error("Stream cancelled");

            if (value) {
                const text = decoder.decode(value, { stream: true });
                fullContent += text;
                onChunk(fullContent);
            }
        }

        return fullContent;
    }, [apiPath]);

    return { fetchStream };
}
