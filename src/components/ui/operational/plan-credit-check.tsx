"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface PlanCreditCheckProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    planGenerationsCount: number;
    subscriptionStatus: string;
    purchasedPlanCredits: number;
}

export default function PlanCreditCheck({
    open,
    onOpenChange,
    onConfirm,
    planGenerationsCount,
    subscriptionStatus,
    purchasedPlanCredits,
}: PlanCreditCheckProps) {
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const limit = subscriptionStatus === "active" ? 2 : 0;
    const remaining = Math.max(0, limit - planGenerationsCount);
    const limitReached = remaining === 0;

    const handleConfirm = () => {
        onConfirm();
    };

    const handleBuyOneOff = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: {
                    successUrl: window.location.href,
                    cancelUrl: window.location.href,
                    productType: 'plan_credit',
                    mode: 'payment'
                },
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error("No checkout URL returned");
            }
        } catch (error) {
            console.error("Error creating checkout:", error);
            toast.error("Failed to initiate checkout");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="dialog-card-glass">
                <DialogHeader>
                    <DialogTitle>
                        {limitReached && purchasedPlanCredits === 0
                            ? "Monthly Limit Reached"
                            : "Start a New Journey?"
                        }
                    </DialogTitle>
                    <DialogDescription>
                        {limitReached && purchasedPlanCredits === 0 ? (
                            <div className="flex flex-col gap-4 pt-2">
                                <p>
                                    You have reached your monthly limit of {limit} journey(s).
                                    To forge a new path immediately, you can purchase a one-off journey credit.
                                </p>
                                <Button onClick={handleBuyOneOff} disabled={loading} className="w-full">
                                    {loading ? "Loading..." : "Buy One-off Journey"}
                                </Button>
                            </div>
                        ) : (
                            <>
                                {limitReached && purchasedPlanCredits > 0 ? (
                                    <span className="block mt-2 font-medium text-green-600">
                                        You have reached your monthly limit, but you have {purchasedPlanCredits} purchased credit(s) available.
                                        Proceeding will use 1 credit.
                                    </span>
                                ) : (
                                    <>
                                        You have used {planGenerationsCount} of your {limit} monthly journeys.
                                        {remaining === 0 ? (
                                            <span className="block mt-2 text-red-500 font-medium">
                                                Warning: You have reached your monthly limit.
                                            </span>
                                        ) : (
                                            <span className="block mt-2">
                                                You have {remaining} remaining this week.
                                            </span>
                                        )}
                                    </>
                                )}
                                <span className="block mt-2">
                                    Are you sure you want to proceed?
                                </span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>
                {!(limitReached && purchasedPlanCredits === 0) && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirm}>Yes, Let's Go</Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
