"use client";

import { useState, useEffect } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export type PushState = "unsupported" | "prompt" | "denied" | "subscribed" | "loading";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    // Check current permission + subscription status
    (async () => {
      const permission = Notification.permission;
      if (permission === "denied") {
        setState("denied");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          setSubscription(existing);
          setState("subscribed");
        } else {
          setState("prompt");
        }
      } catch {
        setState("prompt");
      }
    })();
  }, []);

  async function subscribe(deviceLabel?: string): Promise<{ error?: string }> {
    setState("loading");
    try {
      // Register service worker if not already registered
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;

      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as unknown as ArrayBuffer,
      });

      // Send subscription to server
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: pushSubscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(pushSubscription.getKey("p256dh")!),
            auth: arrayBufferToBase64(pushSubscription.getKey("auth")!),
          },
          deviceLabel: deviceLabel ?? detectDeviceLabel(),
        }),
      });

      if (!res.ok) {
        setState("prompt");
        return { error: "Failed to save subscription" };
      }

      setSubscription(pushSubscription);
      setState("subscribed");
      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState(Notification.permission === "denied" ? "denied" : "prompt");
      return { error: message };
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!subscription) return;
    setState("loading");
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
    setSubscription(null);
    setState("prompt");
  }

  return { state, subscription, subscribe, unsubscribe };
}

function detectDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Mac/.test(ua)) return "MacBook";
  if (/Android/.test(ua)) return "Android";
  return "Browser";
}
