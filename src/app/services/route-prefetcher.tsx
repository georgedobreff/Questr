"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTES_TO_PREFETCH = [
  "/log",
  "/path",
  "/oracle",
  "/pet",
  "/character",
  "/adventure",
  "/shop"
];

const PREFETCH_INTERVAL_MS = 25000; // 25 seconds

export default function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      ROUTES_TO_PREFETCH.forEach((route) => {
        router.prefetch(route);
      });
    }, 2000);

    const intervalTimer = setInterval(() => {
      ROUTES_TO_PREFETCH.forEach((route) => {
        router.prefetch(route);
      });
    }, PREFETCH_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [router]);

  return null;
}
