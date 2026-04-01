import { useRef, useCallback } from 'react';
import { Message } from '@/types/chat';

interface UseTypingLoopProps {
    onUpdate: (content: string) => void;
}

export function useTypingLoop({ onUpdate }: UseTypingLoopProps) {
    const displayedContentRef = useRef("");

    const startTypingLoop = useCallback(async (
        targetContentAccessor: () => string,
        shouldContinue: () => boolean,
        isStreamDoneAccessor: () => boolean
    ) => {
        displayedContentRef.current = "";
        let loopRunning = true;

        const loop = async () => {
            while (shouldContinue() && loopRunning) {
                const fullContent = targetContentAccessor();
                const currentDisplayed = displayedContentRef.current;
                const isStreamDone = isStreamDoneAccessor();

                if (fullContent.length > currentDisplayed.length) {
                    const backlog = fullContent.length - currentDisplayed.length;

                    const step = backlog > 200 ? 6 : backlog > 50 ? 3 : 2;

                    const newContent = fullContent.slice(0, currentDisplayed.length + step);
                    displayedContentRef.current = newContent;
                    onUpdate(newContent);

                    const backlogDelay = backlog > 200 ? 2 : backlog > 50 ? 6 : 15;
                    const delay = backlogDelay + Math.random() * 6;
                    await new Promise(r => setTimeout(r, delay));
                } else {
                    if (isStreamDone && fullContent === currentDisplayed) {
                        loopRunning = false;
                        break;
                    }
                    await new Promise(r => setTimeout(r, 20));
                }
            }
        };

        const promise = loop();
        return {
            stop: () => { loopRunning = false; },
            promise
        };
    }, [onUpdate]);

    return {
        startTypingLoop,
        displayedContentRef
    };
}
