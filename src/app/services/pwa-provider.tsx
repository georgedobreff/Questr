"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { Share, PlusSquare } from "lucide-react";

interface PWAContextType {
  isInstallable: boolean;
  install: () => void;
  isIOS: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error("usePWA must be used within a PWAProvider");
  }
  return context;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const _isIOS = /iphone|ipad|ipod/.test(userAgent);
    const _isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || ('standalone' in window.navigator && (window.navigator as Navigator & { standalone: boolean }).standalone);
    const _isMobile = /android|webos|iphone|ipad|ipod/.test(userAgent);

    setIsIOS(_isIOS);
    setIsStandalone(_isStandalone);
    setIsMobile(_isMobile);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const install = () => {
    if (isIOS) {
      toast("Install Questr App", {
        description: (
          <div className="flex flex-col gap-1 mt-1 text-xs">
            <p>Tap <Share className="w-3 h-3 inline mx-1" /> then &quot;Add to Home Screen&quot; <PlusSquare className="w-3 h-3 inline mx-1" /></p>
          </div>
        ),
        duration: 5000,
      });
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choice) => {
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      });
    }
  };
  const isInstallable = (!!deferredPrompt || (isIOS && !isStandalone)) && !isStandalone;

  return (
    <PWAContext.Provider value={{ isInstallable, install, isIOS }}>
      {children}
    </PWAContext.Provider>
  );
}
