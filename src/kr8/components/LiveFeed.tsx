// Live, privacy-safe activity feed backed by the public activity_feed table.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "./ui";

type Activity = {
  id: string;
  action: string;
  message: string;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  registered: "🟢 Community update",
  graduated: "🎓 Graduation",
  attendance: "✅ Attendance",
  submission: "📤 Assignment",
  referral: "👥 Referral",
  points_earned: "⭐ Leaderboard",
};

export default function LiveFeed({
  limit = 20,
  showHeader = true,
}: {
  limit?: number;
  showHeader?: boolean;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("activity_feed")
          .select("id,action,message,created_at")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        if (active) setActivities(data ?? []);
      } catch (error) {
        console.warn("Unable to load the public activity feed", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    const channel = supabase
      .channel("public-activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_feed" },
        (payload) => {
          const activity = payload.new as Activity;
          setActivities((previous) =>
            [activity, ...previous.filter((item) => item.id !== activity.id)].slice(0, limit),
          );
        },
      )
      .subscribe();

    const intervalId = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, [limit]);

  if (loading)
    return (
      <div className="py-8 text-center text-xs text-[#8a7ba8]">Loading live community activity...</div>
    );

  return (
    <div>
      {showHeader && (
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span>
          <h3 className="text-sm font-bold text-white">Live Feed — Recent Community Activity</h3>
        </div>
      )}
      <div className="space-y-2">
        {activities.length === 0 && (
          <p className="py-4 text-center text-xs text-[#6a5b82]">
            No public activity yet. Updates appear as learners register, attend, submit, and graduate.
          </p>
        )}
        {activities.map((activity) => (
          <Card key={activity.id} className="flex items-start gap-3 p-3">
            <span className="mt-0.5 shrink-0 text-[11px] font-bold text-white">
              {ACTION_LABEL[activity.action] || "KR8 Update"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-[#cabfe0]">{activity.message}</p>
              <p className="text-[10px] text-[#6a5b82]">
                {new Date(activity.created_at).toLocaleString()}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
