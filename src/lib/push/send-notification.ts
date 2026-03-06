import webpush from "web-push";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

// Configure VAPID credentials once (called lazily on first send)
let vapidConfigured = false;
function ensureVapidConfigured() {
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    vapidConfigured = true;
  }
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: {
    ticker?: string;
    activityId?: string;
    url?: string;
  };
}

// Send a push notification to all active subscribed devices.
// Automatically cleans up expired subscriptions (HTTP 410 responses).
export async function sendNotificationToAll(payload: NotificationPayload) {
  ensureVapidConfigured();
  const supabase = getSupabaseServiceClient();

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("is_active", true);

  if (error || !subscriptions?.length) return { sent: 0, failed: 0 };

  const notificationPayload = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_secret,
          },
        },
        notificationPayload,
        {
          TTL: 86400, // Deliver within 24 hours or drop
          urgency: "normal",
        }
      )
    )
  );

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      // HTTP 410 = subscription is gone (user uninstalled PWA, revoked permission)
      // HTTP 404 = endpoint no longer exists
      const statusCode = (result.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("endpoint", subscriptions[i].endpoint);
      }
    }
  }

  return { sent, failed };
}
