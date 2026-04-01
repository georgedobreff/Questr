import Navbar from "@/components/ui/navigation/navbar";
import SubscriptionGuard from "@/app/services/subscription-guard";
import TutorialManager from "@/app/services/tutorial-manager";
import { VoiceModeProvider } from "@/app/services/chat-provider";
import VoiceMode from "@/app/(app)/oracle/voice-mode";
import { CSSProperties } from "react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VoiceModeProvider>
      <div
        className="h-screen overflow-hidden flex flex-col lg:flex-row landscape:flex-row hover-card-glow"
        style={{ "--card-bg": "var(--background)" } as CSSProperties}
      >
        <Navbar />
        <div className="flex-1 relative h-full overflow-y-auto">
          {children}
        </div>
        <TutorialManager />
        <VoiceMode />
      </div>
    </VoiceModeProvider>
  );
}
