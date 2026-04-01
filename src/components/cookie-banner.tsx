"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { X } from "lucide-react";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookieConsent", "declined");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t p-4 shadow-lg md:p-6 animate-in slide-in-from-bottom-full duration-500">
      <div className="container mx-auto flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 space-y-2">
          <h3 className="text-lg font-semibold">We value your privacy</h3>
          <p className="text-sm text-muted-foreground max-w-3xl">
            We use cookies to enhance your experience, analyze site traffic, and provide personalized content. 
            By clicking "Accept", you agree to our use of cookies. Read our{" "}
            <Link href="/legal/cookie-policy" className="underline hover:text-primary">
              Cookie Policy
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy-policy" className="underline hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleDecline}>
            Decline
          </Button>
          <Button onClick={handleAccept}>
            Accept
          </Button>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-2 right-2 md:hidden"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
    </div>
  );
}
