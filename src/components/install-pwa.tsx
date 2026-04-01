"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Share, PlusSquare } from "lucide-react";
import { usePWA } from "@/app/services/pwa-provider";

export default function InstallPWA() {
  const { isInstallable, install, isIOS } = usePWA();

  useEffect(() => {
    if (!isInstallable) return;

    const hasShown = sessionStorage.getItem("pwaPromptShown");
    if (hasShown) return;

    if (isIOS) {
      const dismissed = sessionStorage.getItem("pwaPromptDismissed");
      if (dismissed) return;

      toast("Install Questr App", {
        description: (
          <div className="flex flex-col gap-1 mt-1 text-xs">
            <p>Tap <Share className="w-3 h-3 inline mx-1" /> then &quot;Add to Home Screen&quot; <PlusSquare className="w-3 h-3 inline mx-1" /></p>
          </div>
        ),
        duration: 10000,
        onDismiss: () => sessionStorage.setItem("pwaPromptDismissed", "true"),
        onAutoClose: () => sessionStorage.setItem("pwaPromptDismissed", "true"),
      });
      sessionStorage.setItem("pwaPromptShown", "true");
    } else {

      toast("Install Questr App", {
        description: "Add to home screen for a better experience.",
        duration: 10000,
        action: {
          label: "Install",
          onClick: install,
        },
      });
      sessionStorage.setItem("pwaPromptShown", "true");
    }
  }, [isInstallable, install, isIOS]);

  return null;
}