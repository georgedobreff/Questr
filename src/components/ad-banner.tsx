"use client";

import { useEffect } from "react";
import { User } from "@supabase/supabase-js";

interface AdBannerProps {
    dataAdSlot: string;
    dataAdFormat: string;
    dataFullWidthResponsive: boolean;
    user: User | null;
    isPro: boolean;
}

const AdBanner = ({
    dataAdSlot,
    dataAdFormat,
    dataFullWidthResponsive,
    user,
    isPro,
}: AdBannerProps) => {
    useEffect(() => {
        if (user && !isPro) {
            try {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
            } catch (err) {
                console.error("AdSense error:", err);
            }
        }
    }, [user, isPro]);

    if (!user || isPro) {
        return null;
    }

    return (
        <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-7733863621336128"
            data-ad-slot={dataAdSlot}
            data-ad-format={dataAdFormat}
            data-full-width-responsive={dataFullWidthResponsive.toString()}
        />
    );
};

export default AdBanner;
