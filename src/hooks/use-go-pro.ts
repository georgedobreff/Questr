"use client";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export const useGoPro = () => {
  const supabase = createClient();

  const handleGoPro = async (customSuccessUrl?: string, customCancelUrl?: string) => {
    try {
      toast.loading("Redirecting to checkout...");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.dismiss();
        toast.error("You must be logged in.");
        return;
      }

      const successUrl = customSuccessUrl || `${window.location.origin}/settings?success=true`;
      const cancelUrl = customCancelUrl || `${window.location.origin}/settings?canceled=true`;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          successUrl,
          cancelUrl,
          mode: 'subscription'
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No URL returned");
      }

    } catch (err) {
      console.error("Go Pro Error:", err);
      toast.dismiss();
      toast.error("Something went wrong. Please try again.");
    }
  };

  return { handleGoPro };
};