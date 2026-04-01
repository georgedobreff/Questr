"use client";

import { useEffect } from "react";

export default function VignetteAdScript() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        (function (s: any) {
            s.dataset.zone = '10570204';
            s.src = 'https://gizokraijaw.net/vignette.min.js';
        })([document.documentElement, document.body].filter(Boolean).pop()!.appendChild(document.createElement('script')));
    }, []);

    return null;
}
