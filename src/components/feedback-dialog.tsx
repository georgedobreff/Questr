"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

interface FeedbackDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FeedbackDialog({ isOpen, onOpenChange }: FeedbackDialogProps) {
  const supabase = createClient();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  
  const [formData, setFormData] = useState({
    type: "issue",
    message: "",
  });

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        if (profile?.full_name) setUserName(profile.full_name);
      }
    };
    if (isOpen) fetchUser();
  }, [isOpen, supabase]);

  const handleSubmit = async () => {
    if (!formData.message.trim()) {
      toast.error("Please describe your issue or suggestion.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-feedback", {
        body: {
          ...formData,
          url: window.location.origin + pathname,
          name: userName,
        },
      });

      if (error) throw error;

      setFormData({ type: "issue", message: "" });
      onOpenChange(false);
    } catch (error) {
      console.error("Feedback error:", error);
      toast.error("Failed to send feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] dialog-card-glass">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Report a bug, suggest a feature, or just say hello. We read every message!
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="col-span-3"
              placeholder="Your Name"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Type
            </Label>
            <div className="col-span-3">
                <select
                    id="type"
                    className="h-10 w-full rounded-md border border-input bg-transparent dark:bg-input/30 px-3 pr-8 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                    <option value="issue">Report an Issue</option>
                    <option value="feature">Feature Suggestion</option>
                    <option value="question">Question</option>
                    <option value="other">Other</option>
                </select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="message" className="text-right mt-2">
              Message
            </Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="col-span-3"
              placeholder="Tell us what happened or what you'd like to see..."
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading ? "Sending..." : "Send Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
