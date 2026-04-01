# PWA & Installation

This document provides a comprehensive, code-level breakdown of the Progressive Web App (PWA) implementation in Questr, explaining how the application provides a "native-like" experience on mobile and desktop.

---

## Part 1: Manifest & Service Worker

The PWA is defined by two static files in the `public/` directory.

### 1. `manifest.json`
This file instructs the browser on how to display the application when installed.
- **`display: standalone`**: Removes browser chrome (URL bar, navigation buttons) to provide a full-screen app experience.
- **`start_url: /`**: Ensures the app always opens to the root.
- **Icons**: Provides high-resolution icons (`192x192` and `512x512`) for the home screen.

### 2. `sw.js` (Service Worker)
Questr uses a minimal service worker strategy.
- **`install` event**: Calls `self.skipWaiting()` to ensure the latest service worker is activated immediately.
- **`fetch` event**: Currently empty, but exists to satisfy the browser's requirement for a service worker to trigger the installation prompt.

---

## Part 2: Installation Orchestration

Because different operating systems handle PWA installation differently (especially iOS), Questr uses a robust React-based orchestration system.

### 1. `PWAProvider.tsx`
This component wraps the application and provides a global `usePWA` hook.
- **Platform Detection**: It identifies if the user is on **iOS** vs other platforms.
- **Standlone Check**: It verifies if the app is already running in standalone mode (`display-mode: standalone`).
- **`beforeinstallprompt`**: On supported browsers (Chrome, Edge, Samsung Internet), it captures this event and stores it as a `deferredPrompt`.
- **Logic:** It calculates the `isInstallable` flag:
    - **Android/Desktop:** True if a `deferredPrompt` exists.
    - **iOS:** True if the user is on an iPhone/iPad AND the app is not already standalone.

### 2. `InstallPWA.tsx`
This component is responsible for the user-facing installation prompt.
- **Timing:** It uses `sessionStorage` (`pwaPromptShown`) to ensure the prompt only appears once per session.
- **iOS Flow:** Displays a custom toast instructing the user to tap the "Share" button and then "Add to Home Screen".
- **Android/Desktop Flow:** Displays a toast with an "Install" button that triggers the browser's native installation dialog via the `deferredPrompt.prompt()`.

---

## Part 3: User Benefits

By installing the PWA, users gain:
- **Home Screen Presence:** A permanent app icon.
- **Full Screen:** A dedicated UI window without browser distractions.
- **Better Performance:** The browser prioritizes resources for standalone PWAs.
- **Consistency:** The app feels like a game, rather than a website.
