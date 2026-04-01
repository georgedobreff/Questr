"use client";

import { useEffect, useRef } from "react";
import { useClickCounter } from "@/hooks/use-click-counter";

const ADS_SCRIPT_ID = "popunder-ad-script-element";

export default function PopUnderAdScript() {
    const clickCount = useClickCounter();
    const lastProcessedCount = useRef(-1);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const isActive = true;
        
        if (isActive) {
            const existingScript = document.getElementById(ADS_SCRIPT_ID);
            if (!existingScript) {
                console.log("[PopUnderAd] PHASE ACTIVE - Injecting script...");
                const s = document.createElement('script');
                s.id = ADS_SCRIPT_ID;
                // @ts-ignore
                s.dataset.zone = '10570121';
                s.src = 'https://al5sm.com/tag.min.js';

                const target = document.body || document.documentElement;
                target.appendChild(s);
            }
        }

        lastProcessedCount.current = clickCount;
    }, [clickCount]);

    return null;
}