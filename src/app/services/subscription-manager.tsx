"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useGoPro } from "@/hooks/use-go-pro";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CreditCard, Sparkles } from "lucide-react";

interface SubscriptionManagerProps {
  status: string;
  hasHadTrial: boolean;
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  status,
  hasHadTrial,
}) => {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const { handleGoPro } = useGoPro();

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error accessing portal:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const isPro = ["active", "trialing", "pro"].includes(status);
  const isTrial = status === "trialing";

  return (
    <Card className="titled-cards">
      <CardHeader className="text-center flex flex-col items-center">
        <CardTitle className="flex items-center gap-2 justify-center">
          <CreditCard className="h-5 w-5" />
          Subscription
        </CardTitle>
        <CardDescription>
          Manage your subscription.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex flex-col items-center w-full">
        <div className="flex flex-col items-center gap-2 w-full">
          <span className="text-sm font-medium">Current Status</span>
          <Badge
            variant="default"
            className={isPro ? "bg-[#4F6B43] border-none text-white" : "text-white dark:text-black"}
          >
            {isTrial ? "Trial Period" : (isPro ? "Pro Plan" : "Free Plan")}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-6 flex justify-center w-full">
        {isPro ? (
          <Button onClick={handleManageSubscription} disabled={loading} variant="outline" className="w-full max-w-sm">
            {loading ? "Loading..." : "Manage Billing"}
          </Button>
        ) : (
          <Button
            onClick={() => handleGoPro()}
            className="w-full max-w-sm bg-[radial-gradient(circle_at_center,#4F6B43,#35492d)] hover:brightness-110 text-white animate-pulsate-green border-none rounded-full"
          >
            {hasHadTrial ? "Upgrade" : "Upgrade"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
