// Vercel Cron Job: Evaluate new activity and send push notifications
// Schedule: every 5 minutes (see vercel.json)
// Auth: Bearer ${CRON_SECRET} validated by middleware.ts

import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { shouldAlert, isQuietHours, formatAlertMessage } from "@/lib/alerts/evaluate-alerts";
import { sendNotificationToAll } from "@/lib/push/send-notification";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();

  // Load alert settings
  const { data: settings } = await supabase
    .from("alert_settings")
    .select("*")
    .single();

  if (!settings) {
    return NextResponse.json({ error: "Alert settings not found" }, { status: 500 });
  }

  // Respect quiet hours
  if (isQuietHours(settings)) {
    return NextResponse.json({ message: "Quiet hours — skipping alerts" });
  }

  // Find activity that hasn't been alerted yet (no row in alert_history)
  // Look back 24 hours to avoid re-processing very old data
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: unalertedActivity } = await supabase
    .from("institutional_activity")
    .select(`
      *,
      alert_history!left(id)
    `)
    .gte("fetched_at", cutoff)
    .is("alert_history.id", null) // No corresponding alert_history row
    .order("fetched_at", { ascending: false })
    .limit(50);

  if (!unalertedActivity?.length) {
    return NextResponse.json({ message: "No new activity to alert", sent: 0 });
  }

  let sent = 0;
  let skipped = 0;

  for (const activity of unalertedActivity) {
    // Evaluate against thresholds
    if (!shouldAlert(activity, settings)) {
      skipped++;
      // Still record in alert_history so we don't re-check this event
      await supabase.from("alert_history").insert({
        activity_id: activity.id,
        notification_title: null,
        notification_body: null,
        delivery_status: "skipped_threshold",
      });
      continue;
    }

    const { title, body } = formatAlertMessage(activity);

    // Send push to all devices
    const { sent: deliveries } = await sendNotificationToAll({
      title,
      body,
      data: {
        ticker: activity.ticker,
        activityId: activity.id,
        url: `/feed`,
      },
    });

    // Log that we sent this alert
    await supabase.from("alert_history").insert({
      activity_id: activity.id,
      notification_title: title,
      notification_body: body,
      delivery_status: deliveries > 0 ? "sent" : "no_subscriptions",
    });

    sent++;
  }

  return NextResponse.json({ success: true, sent, skipped });
}
