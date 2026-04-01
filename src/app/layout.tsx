import type { Metadata } from "next";
import { Modern_Antiqua, MedievalSharp } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import PasswordRecoveryHandler from "@/app/services/password-recovery-handler";
import { ThemeProvider } from "./services/theme-provider";
import ActivityTracker from "@/app/services/activity-tracker";
import ScenePreloader from "@/app/services/scene-preloader";
import InstallPWA from "@/components/install-pwa";
import { PWAProvider } from "@/app/services/pwa-provider";
import NotificationsProvider from "@/app/services/notifications-provider";
import { GoogleAnalytics } from '@next/third-parties/google'
import { LocalLLMProvider } from "@/app/services/local-llm-provider";
import { SpeedInsights } from "@vercel/speed-insights/next";

import NextTopLoader from "nextjs-toploader";
import { CookieBanner } from "@/components/cookie-banner";
import RoutePrefetcher from "@/app/services/route-prefetcher";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import GoogleAdsenseScript from "@/components/google-adsense-script";
import VignetteAdScript from "@/components/ads/vignette-ad-script";
import PushAdScript from "@/components/ads/push-ad-script";
import PopUnderAdScript from "@/components/ads/popunder-ad-script";
import AdBlockDetector from "@/components/ads/adblock-detector";
import AdExclusionWrapper from "@/components/ads/ad-exclusion-wrapper";


const modernAntiqua = Modern_Antiqua({
  variable: "--font-modern-antiqua",
  subsets: ["latin"],
  weight: "400",
});

const medievalSharp = MedievalSharp({
  variable: "--font-medieval-sharp",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://questr.gg'),
  title: {
    default: "Questr | Forge Your Path. Master Your Life.",
    template: "%s | Questr"
  },
  description: "The ultimate gamified productivity app. Turn your real-world goals into epic quests, level up your character, and master your life with AI-guided syllabi.",
  applicationName: "Questr",
  authors: [{ name: "Questr Team" }],
  generator: "Next.js",
  keywords: [
    "Questr", "questr.gg", "qstrio", "productivity app", "gamified productivity",
    "habit tracker", "RPG productivity", "AI productivity", "goal setter",
    "life gamification", "focus tool", "task manager RPG"
  ],
  referrer: "origin-when-cross-origin",
  creator: "Questr",
  publisher: "Questr",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Questr",
  },
  icons: {
    icon: "/q_favicon.png",
    shortcut: "/q_favicon.png",
    apple: "/q_favicon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://questr.gg",
    title: "Questr | Forge Your Path. Master Your Life.",
    description: "The ultimate gamified productivity app. Turn your real-world goals into epic quests, level up your character, and master your life.",
    siteName: "Questr",
    images: [
      {
        url: "/app-showcase/Quest Dark.png",
        width: 1200,
        height: 630,
        alt: "Questr App Screenshot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Questr | Turn your ambition into an adventure",
    description: "The ultimate gamified learning app. Turn your real-world goals into epic quests.",
    images: ["/app-showcase/Quest Dark.png"],
    creator: "@qstrio",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isPro = false;
  if (user) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();

    const subscriptionStatus = subscription?.status || "free";
    isPro = ["active", "trialing", "pro"].includes(subscriptionStatus);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="6a97888e-site-verification" content="d925772c373213b5b340f284387fd5ca" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Questr",
              "alternateName": ["questr.gg", "qstrio"],
              "url": "https://questr.gg",
              "description": "The ultimate gamified learning app. Turn your real-world goals into epic quests, level up your character, and master your life.",
              "applicationCategory": "ProductivityApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              }
            })
          }}
        />
        {false && user && !isPro && (
          <AdExclusionWrapper>
            <GoogleAdsenseScript />
            <VignetteAdScript />
            <PushAdScript />
            <PopUnderAdScript />
          </AdExclusionWrapper>
        )}
      </head>
      <body
        className={`${modernAntiqua.className} ${modernAntiqua.variable} ${medievalSharp.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextTopLoader
            color="#4F6B43"
            showSpinner={false}
            height={3}
            crawl={true}
            speed={200}
          />
          <PWAProvider>
            <NotificationsProvider />
            <RoutePrefetcher />
            <ScenePreloader />
            <LocalLLMProvider>
              {children}
            </LocalLLMProvider>
            <InstallPWA />
            <CookieBanner />
            <Toaster />
            <PasswordRecoveryHandler />
            <ActivityTracker />
            {false && user && !isPro && (
              <AdExclusionWrapper>
                <AdBlockDetector />
              </AdExclusionWrapper>
            )}
          </PWAProvider>
        </ThemeProvider>
        <SpeedInsights />
        <GoogleAnalytics gaId="G-BWZE2BVKWF" />
      </body>
    </html>
  );
}
