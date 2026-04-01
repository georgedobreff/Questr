"use client";

import { useEffect, useRef } from "react";
import { driver, DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { usePathname, useRouter } from "next/navigation";

export default function TutorialManager() {
    const pathname = usePathname();
    const router = useRouter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const driverRef = useRef<any>(null);

    useEffect(() => {
        const hasSeenTutorial = localStorage.getItem("tutorial_completed");
        if (hasSeenTutorial) return;

        const isTutorialActive = localStorage.getItem("tutorial_active");
        if (!isTutorialActive && pathname !== "/dashboard") return;

        if (!isTutorialActive && pathname === "/dashboard") {
            localStorage.setItem("tutorial_active", "true");
        }

        if (pathname !== "/dashboard") return;

        const timer = setTimeout(() => {
            const driverObj = driver({
                showProgress: false,
                animate: true,
                allowClose: true,
                doneBtnText: "Got it!",
                nextBtnText: "Next",
                prevBtnText: "Back",
                steps: [
                    {
                        popover: {
                            title: "Welcome to Questr!",
                            description: "Explore the app and join the Discord for support and more events! Good luck on your journey!"
                        }
                    }
                ],
                onDestroyed: () => {
                    localStorage.setItem("tutorial_completed", "true");
                    localStorage.removeItem("tutorial_active");
                    localStorage.removeItem("tutorial_transition");
                }
            });

            driverRef.current = driverObj;
            driverObj.drive();
        }, 1000);

        return () => {
            clearTimeout(timer);
            if (driverRef.current) {
                driverRef.current.destroy();
            }
        };
    }, [pathname, router]);

    return null;
}
