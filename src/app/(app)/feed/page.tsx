import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ActivityFeed } from "@/components/feed/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await getSupabaseServerClient();

  const { data: activity } = await supabase
    .from("institutional_activity")
    .select("*")
    .order("fetched_at", { ascending: false })
    .limit(500);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Activity Feed</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Live updates — new trades appear automatically
        </p>
      </div>

      <ActivityFeed initialItems={activity ?? []} />
    </div>
  );
}
