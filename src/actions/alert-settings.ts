"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function updateAlertSettings(formData: FormData): Promise<void> {
  const supabase = await getSupabaseServerClient();

  const minValue = formData.get("min_trade_value_usd");
  const alertCongress = formData.get("alert_congress") === "on";
  const alertInsider = formData.get("alert_insider") === "on";
  const alertInstitutional = formData.get("alert_institutional") === "on";
  const quietStart = formData.get("quiet_hours_start") as string;
  const quietEnd = formData.get("quiet_hours_end") as string;

  const minValueCents = Math.round(Number(minValue) * 100);
  if (isNaN(minValueCents) || minValueCents < 0) return;

  await supabase
    .from("alert_settings")
    .update({
      min_trade_value_usd: minValueCents,
      alert_congress: alertCongress,
      alert_insider: alertInsider,
      alert_institutional: alertInstitutional,
      quiet_hours_start: quietStart || "22:00",
      quiet_hours_end: quietEnd || "08:00",
      updated_at: new Date().toISOString(),
    })
    .not("id", "is", null);

  revalidatePath("/settings");
}
