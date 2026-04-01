"use client";

import { Button } from "@/components/ui/button";
import { useGoPro } from "@/hooks/use-go-pro";
import { ShieldAlert, RefreshCw, CreditCard } from "lucide-react";

export default function AdBlockOverlay() {
    const { handleGoPro } = useGoPro();

    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="dialog-card-solid max-w-md w-full p-8 flex flex-col items-center text-center space-y-6">
                <div className="bg-destructive/10 p-4 rounded-full">
                    <ShieldAlert className="w-12 h-12 text-destructive" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">Adblocker Detected</h2>
                    <p className="text-muted-foreground">
                        We don't like ads either, but they help keep Questr free. To continue using Questr, please disable your adblocker or subscribe to Questr Pro for an ad-free experience.
                    </p>
                </div>

                <div className="flex flex-col w-full gap-3">
                    <Button
                        onClick={handleRefresh}
                        className="w-full flex items-center justify-center gap-2 py-6 text-lg"
                    >
                        <RefreshCw className="w-5 h-5" />
                        I've disabled it
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => handleGoPro()}
                        className="w-full flex items-center justify-center gap-2 py-6 text-lg border-2"
                    >
                        <CreditCard className="w-5 h-5" />
                        Subscribe to Questr Pro
                    </Button>
                </div>

                <p className="text-xs text-muted-foreground/60 italic">
                    Ads help keep the basic version of Questr free for everyone.
                </p>
            </div>
        </div>
    );
}
