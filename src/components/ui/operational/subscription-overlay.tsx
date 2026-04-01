"use client";

import { Badge } from "@/components/ui/badge";
import { useGoPro } from "@/hooks/use-go-pro";

export default function SubscriptionOverlay() {
  const { handleGoPro } = useGoPro();

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 p-4 pointer-events-auto">
      <button 
        onClick={() => handleGoPro()} 
        className="transition-transform hover:scale-105 active:scale-95 sticky top-1/2"
      >
        <Badge className="px-8 py-4 text-xl bg-orange-500 hover:bg-orange-600 text-white shadow-2xl animate-pulsate-orange border-none cursor-pointer rounded-full text-center">
          Subscribe to Continue your Journey
        </Badge>
      </button>
    </div>
  );
}