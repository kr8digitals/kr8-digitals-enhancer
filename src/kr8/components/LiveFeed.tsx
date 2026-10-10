// Production LiveFeed - uses secure RPC get_recent_activity
import { useEffect, useState } from "react";
import { useNavigate } from "../router-shim";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./ui";

type FeedItem = {
  id: string;
  kind: "registration" | "graduation" | "attendance" | "submission" | "stream_live" | "stream_ended" | "tribe" | "project";
  name: string;
  skill: string;
  avatar: string | null;
  ts: number;
  customAction?: string;
};

function feedAction(kind: FeedItem["kind"]): string {
  const map: Record<string, string> = {
    submission: "submitted an assignment",
    attendance: "got attendance accepted",
    graduation: "just graduated",
    registration: "joined the Academy",
    tribe: "joined the Tribe",
    project: "shipped a client project",
    stream_live: "is broadcasting live right now",
    stream_ended: "completed a live masterclass",
  };
  return map[kind] || "had an activity";
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function LiveFeed({ compact }: { compact?: boolean }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const { student } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // Use secure RPC get_recent_activity - returns safe fields only, no direct profiles/activity_log query
        const { data, error } = await supabase.rpc('get_recent_activity', { limit_n: 20 });

        if (error) {
          console.warn('LiveFeed RPC error:', error.message);
          return;
        }

        if (data && mounted) {
          const mapped: FeedItem[] = (data as any[]).map((row: any) => ({
            id: row.id,
            kind: (row.kind === 'sign_in' ? 'registration' : row.kind) as FeedItem["kind"] || 'registration',
            name: row.name || 'KR8 Creator',
            skill: row.skill || 'Digital Skills',
            avatar: row.avatar || null,
            ts: new Date(row.created_at).getTime(),
          }));
          setFeed(mapped);
        }
      } catch (e) {
        console.warn('LiveFeed load exception:', e);
      }
    }

    load();

    // Poll every 60-120 seconds to protect free quota, no realtime on whole profiles table
    const interval = setInterval(load, 90000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const items = compact ? feed.slice(0, 4) : feed.slice(0, 7);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              nav(student ? "/leaderboard" : "/academy");
            }}
            className="flex min-w-0 w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-pink-400/40 sm:p-3.5"
          >
            <span className="relative">
              <Avatar src={f.avatar || undefined} name={f.name} size={40} />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0d0015] bg-green-400" />
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="break-words text-xs leading-relaxed text-white sm:text-sm">
                <span className="font-semibold">{f.name}</span>{" "}
                <span className="text-[#b8aecf]">{feedAction(f.kind)}</span>
              </p>
              <p className="truncate text-[11px] text-[#8a7ba8] sm:text-xs">
                {f.skill} · {timeAgo(f.ts)}
              </p>
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-[#8a7ba8] text-center py-6">No recent activity yet. Community feed will appear here.</p>
        )}
      </div>
    </div>
  );
}
