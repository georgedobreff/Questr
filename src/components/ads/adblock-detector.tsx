"use client";

import { useEffect, useState } from "react";
import AdBlockOverlay from "./adblock-overlay";

export default function AdBlockDetector() {
    const [isAdBlockDetected, setIsAdBlockDetected] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const checkAdBlock = async () => {
            const bait = document.createElement("div");
            bait.className = "ad-banner adsense-ad pub_300x250 pub_728x90 text-ad textAd ads-box content-ad universal-ad-top";
            bait.setAttribute("style", "position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px;");
            document.body.appendChild(bait);
            await new Promise((resolve) => setTimeout(resolve, 500));

            const isBaitHidden =
                window.getComputedStyle(bait).getPropertyValue("display") === "none" ||
                window.getComputedStyle(bait).getPropertyValue("visibility") === "hidden" ||
                bait.offsetParent === null ||
                bait.offsetHeight === 0 ||
                bait.offsetWidth === 0;

            document.body.removeChild(bait);

            if (isBaitHidden) {
                console.log("[AdBlockDetector] AdBlock detected via bait element");
                setIsAdBlockDetected(true);
                return;
            }

            try {
                const url = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
                await fetch(url, {
                    method: "HEAD",
                    mode: "no-cors",
                    cache: "no-store",
                });
            } catch (error) {
                console.log("[AdBlockDetector] AdBlock detected via bait script fetch", error);
                setIsAdBlockDetected(true);
            }
        };

        checkAdBlock();
    }, []);

    if (isAdBlockDetected) {
        return <AdBlockOverlay />;
    }

    return null;
}
