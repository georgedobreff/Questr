"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "quester_click_count";

export function useClickCounter(): number {
    const [clickCount, setClickCount] = useState<number>(0);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setClickCount(parseInt(saved, 10) || 0);
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleClick = () => {
            setClickCount(prev => {
                const newCount = prev + 1;
                localStorage.setItem(STORAGE_KEY, newCount.toString());
                return newCount;
            });
        };


        window.addEventListener('click', handleClick, { capture: true, passive: true });

        return () => {
            window.removeEventListener('click', handleClick, { capture: true });
        };
    }, []);

    return clickCount;
}

