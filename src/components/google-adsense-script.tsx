"use client";

import Script from "next/script";

const GoogleAdsenseScript = () => {
    return (
        <Script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7733863621336128"
            crossOrigin="anonymous"
            strategy="afterInteractive"
        />
    );
};

export default GoogleAdsenseScript;
