"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const DynamicMarkdown = dynamic(() => import('@/components/markdown-renderer'), { ssr: false });

interface BossFeedbackCardProps {
  explanation: string;
  onClose: () => void;
}

export default function BossFeedbackCard({ explanation, onClose }: BossFeedbackCardProps) {
  return (
    <div className="absolute inset-0 z-50 bg-background p-4 animate-in fade-in zoom-in-95">
      <div className="flex flex-col h-full max-w-2xl mx-auto border rounded-lg shadow-2xl titled-cards overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">🔮</span>
            The Oracle's Wisdom
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-destructive/10 hover:text-destructive">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="max-w-none">
            {explanation ? (
              <DynamicMarkdown>{explanation}</DynamicMarkdown>
            ) : (
              <p className="italic text-muted-foreground text-center py-12">
                The ancient scrolls are blank. No record of this battle's wisdom remains.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/10 flex justify-end">
          <Button onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
