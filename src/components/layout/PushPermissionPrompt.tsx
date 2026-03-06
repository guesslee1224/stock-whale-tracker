"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { BellIcon, BellOffIcon, CheckCircleIcon } from "lucide-react";

// Shown in the settings page and optionally as a banner in the app shell
export function PushPermissionPrompt() {
  const { state, subscribe, unsubscribe } = usePushNotifications();

  if (state === "loading") return null;

  if (state === "unsupported") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        <BellOffIcon className="h-4 w-4 shrink-0" />
        <span>
          Push notifications aren&apos;t supported in this browser. On iPhone, add the app to your
          home screen first.
        </span>
      </div>
    );
  }

  if (state === "subscribed") {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg border border-green-500/20 bg-green-500/5">
        <div className="flex items-center gap-3">
          <CheckCircleIcon className="h-4 w-4 text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-400">Push alerts enabled</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You&apos;ll be notified when whales are active on your watchlist.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={unsubscribe}
          className="text-muted-foreground hover:text-destructive shrink-0"
        >
          Disable
        </Button>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
        <BellOffIcon className="h-4 w-4 text-destructive shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-destructive">Notifications blocked</p>
          <p className="text-muted-foreground mt-0.5">
            Go to your browser settings to allow notifications for this site.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3">
        <BellIcon className="h-4 w-4 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium">Enable push alerts</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get notified instantly when whales buy your watchlist stocks.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => subscribe()}
        className="shrink-0"
      >
        Enable
      </Button>
    </div>
  );
}
