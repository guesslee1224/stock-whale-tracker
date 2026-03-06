import { getSupabaseServerClient } from "@/lib/supabase/server";
import { updateAlertSettings } from "@/actions/alert-settings";
import { PushPermissionPrompt } from "@/components/layout/PushPermissionPrompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();

  const [settingsResult, subscriptionsResult, fetchLogResult] =
    await Promise.allSettled([
      supabase.from("alert_settings").select("*").single(),
      supabase
        .from("push_subscriptions")
        .select("id, device_label, subscribed_at, is_active")
        .eq("is_active", true),
      supabase
        .from("fetch_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5),
    ]);

  const settings =
    settingsResult.status === "fulfilled" ? settingsResult.value.data : null;
  const subscriptions =
    subscriptionsResult.status === "fulfilled" ? subscriptionsResult.value.data : null;
  const fetchLog =
    fetchLogResult.status === "fulfilled" ? fetchLogResult.value.data : null;

  const minValueDollars = settings
    ? (settings.min_trade_value_usd / 100).toFixed(0)
    : "1000000";

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure alert thresholds and notification preferences
        </p>
      </div>

      {/* Push notifications */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Push Notifications</CardTitle>
          <CardDescription>
            Requires the app to be added to your iPhone home screen (iOS 16.4+)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PushPermissionPrompt />

          {subscriptions && subscriptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Active devices</p>
              {subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {sub.device_label ?? "Unknown device"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Since{" "}
                    {new Date(sub.subscribed_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert thresholds */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Alert Thresholds</CardTitle>
          <CardDescription>
            Only send push alerts when trades exceed these criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAlertSettings} className="space-y-6">
            {/* Minimum trade value */}
            <div className="space-y-2">
              <Label htmlFor="min_trade_value_usd">
                Minimum trade value (USD)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  id="min_trade_value_usd"
                  name="min_trade_value_usd"
                  type="number"
                  defaultValue={minValueDollars}
                  min="0"
                  step="1000"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Only alert when a single trade exceeds this dollar amount.
                Default: $1,000,000.
              </p>
            </div>

            {/* Actor type toggles */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Alert sources</p>
              {[
                { name: "alert_congress", label: "Congressional trades", description: "Trades by US Congress members", defaultChecked: settings?.alert_congress ?? true },
                { name: "alert_insider", label: "Insider trades", description: "Executive and director trades (SEC Form 4)", defaultChecked: settings?.alert_insider ?? true },
                { name: "alert_institutional", label: "Institutional holdings", description: "Large fund position changes (13F filings)", defaultChecked: settings?.alert_institutional ?? true },
              ].map(({ name, label, description, defaultChecked }) => (
                <div key={name} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Switch name={name} defaultChecked={defaultChecked} />
                </div>
              ))}
            </div>

            {/* Quiet hours */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quiet_hours_start">Quiet hours start</Label>
                <Input
                  id="quiet_hours_start"
                  name="quiet_hours_start"
                  type="time"
                  defaultValue={settings?.quiet_hours_start ?? "22:00"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet_hours_end">Quiet hours end</Label>
                <Input
                  id="quiet_hours_end"
                  name="quiet_hours_end"
                  type="time"
                  defaultValue={settings?.quiet_hours_end ?? "08:00"}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              No push notifications will be sent during quiet hours.
            </p>

            <Button type="submit" className="w-full">
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Data sync log */}
      {fetchLog && fetchLog.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Recent Data Syncs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {fetchLog.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div>
                    <span className="font-medium capitalize">{log.source.replace("_", " ")}</span>
                    <span className="text-muted-foreground ml-2">
                      {log.records_new} new records
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        log.status === "success"
                          ? "text-green-400"
                          : log.status === "error"
                          ? "text-destructive"
                          : "text-yellow-400"
                      }
                    >
                      {log.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {log.completed_at
                        ? new Date(log.completed_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
