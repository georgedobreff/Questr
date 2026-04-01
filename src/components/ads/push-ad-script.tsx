"use client";

import { useEffect } from "react";

export default function PushAdScript() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        (function (s: any) {
            s.dataset.zone = '10570411';
            s.src = 'https://nap5k.com/tag.min.js';
        })([document.documentElement, document.body].filter(Boolean).pop()!.appendChild(document.createElement('script')));

        const moveAd = () => {
            const iframes = document.getElementsByTagName('iframe');
            for (let i = 0; i < iframes.length; i++) {
                const iframe = iframes[i];
                // Check if this iframe has the specific high z-index
                if (iframe.style.zIndex === '2147483647' || iframe.style.zIndex === '2147483647 !important') {
                    const isVignette = iframe.offsetWidth > 450 || iframe.offsetHeight > 250;

                    if (isVignette) {
                        if (iframe.style.transform !== 'none' || iframe.style.top !== '0px') {
                            iframe.style.setProperty('transform', 'none', 'important');
                            iframe.style.setProperty('inset', '0px', 'important');
                            iframe.style.setProperty('top', '0px', 'important');
                            iframe.style.setProperty('width', '100%', 'important');
                            iframe.style.setProperty('height', '100%', 'important');
                        }
                    } else if (iframe.style.top !== '80px') {
                        iframe.style.setProperty('inset', '80px 0px auto auto', 'important');
                        iframe.style.setProperty('top', '80px', 'important');
                        iframe.style.setProperty('transform', 'scale(0.8)', 'important');
                        iframe.style.setProperty('transform-origin', 'top right', 'important');
                    }
                }
            }
        };

        const observer = new MutationObserver(() => {
            moveAd();
        });

        observer.observe(document.body, { childList: true, subtree: true, attributes: true });

        const intervalId = setInterval(moveAd, 500);

        return () => {
            observer.disconnect();
            clearInterval(intervalId);
        };
    }, []);

    return null;
}