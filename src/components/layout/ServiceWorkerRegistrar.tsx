"use client";

import { useEffect } from "react";

// Registers the service worker on first load.
// Must be a Client Component since it uses browser APIs.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure is non-fatal — app still works, just no push
      });
    }
  }, []);

  return null;
}
