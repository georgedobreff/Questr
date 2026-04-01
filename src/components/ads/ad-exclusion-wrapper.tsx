"use client";

import { usePathname } from "next/navigation";
import React from "react";

interface AdExclusionWrapperProps {
    children: React.ReactNode;
}

export default function AdExclusionWrapper({ children }: AdExclusionWrapperProps) {
    const pathname = usePathname();

    if (pathname === "/" || pathname === "/login" || pathname.startsWith("/onboarding")) {
        return null;
    }

    return <>{children}</>;
}
