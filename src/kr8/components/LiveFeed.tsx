// @ts-nocheck
import { useEffect, useState, useCallback } from "react";
import { getActivityFeed, getStudents, type ActivityItem } from "../data/store";
import { Avatar } from "./ui";
import { useServerFn } from "@tanstack/react-start";
import * as pubFns from "@/lib/public-data.functions";
import { supabase } from "@/integrations/supabase/client";

function formatRelativeTime(ts: number | string) {
  const timeMs = typeof ts === "number" ? ts : new Date(ts).getTime();
  const diff = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));
  if (diff < 60) return "just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timeMs).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export default function LiveFeed() {
  const getFeedFn = useServerFn(pubFns.getPublicLeaderboardAndFeed);

  const [feed, setFeed] = useState<ActivityItem[]>(() => getActivityFeed());
  const [totalScholars, setTotalScholars] = useState<number>(() => getStudents().length);
  const [graduatedCount, setGraduatedCount] = useState<number>(0);
  const [idx, setIdx] = useState(0);
  const [showFullModal, setShowFullModal] = useState(false);

  const loadLiveActivities = useCallback(async () => {
    try {
      const res: any = await getFeedFn();
      if (res?.ok && Array.isArray(res.feed) && res.feed.length > 0) {
        const mapped: ActivityItem[] = res.feed.map((item: any) => ({
          id: item.id,
          who: item.who || "KR8 Scholar",
          action: item.action || "completed an activity in KR8 Academy",
          when: formatRelativeTime(item.when || Date.now()),
          avatar: item.avatar || "",
          timestamp: typeof item.when === "number" ? item.when : Date.now(),
          type: item.type || "activity",
          kr8Id: item.kr8Id || undefined,
        }));
        setFeed(mapped);
        if (res.stats) {
          setTotalScholars(res.stats.totalStudents || mapped.length);
          setGraduatedCount(res.stats.graduatedStudents || 0);
        }
        return;
      }
    } catch (err) {
      console.warn("[LiveFeed] ServerFn fallback:", err);
    }

    // Fallback to local feed if offline
    const local = getActivityFeed();
    if (local.length > 0) setFeed(local);
  }, []);

  useEffect(() => {
    loadLiveActivities();
    const channel = supabase
      .channel("kr8-live-activity-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadLiveActivities())
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates" }, () => loadLiveActivities())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => loadLiveActivities())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => loadLiveActivities())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLiveActivities]);

  // Rotate ticker every 4 seconds
  useEffect(() => {
    if (feed.length <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % feed.length);
    }, 4000);
    return () => clearInterval(id);
  }, [feed.length]);

  const item = feed[idx] ?? feed[0];
  const recentFive = feed.slice(0, 6);

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-pink-300">
                Real-Time Ecosystem Activity
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[#8a7ba8]">
                {totalScholars} Scholars{graduatedCount > 0 ? ` · ${graduatedCount} Graduates` : ""}
              </span>
              {feed.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowFullModal(true)}
                  className="rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-pink-300 hover:bg-pink-500/20 hover:text-white transition-colors cursor-pointer"
                >
                  View All ({feed.length}) →
                </button>
              )}
            </div>
          </div>

          {/* Highlighted Rotating Latest Activity */}
          {item ? (
            <div
              key={item.id + idx}
              onClick={() => setShowFullModal(true)}
              className="mt-4 flex items-center gap-3 rounded-2xl border border-pink-500/25 bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-transparent p-3.5 cursor-pointer hover:border-pink-400/50 transition-all"
            >
              <Avatar src={item.avatar} name={item.who} size={42} />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-white leading-snug">
                  <span className="font-bold text-pink-200">{item.who}</span>{" "}
                  <span className="text-[#cabfe0]">{item.action}</span>
                </p>
                <p className="text-[11px] text-[#8a7ba8] mt-0.5">{item.when}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#8a7ba8]">Listening for real-time student activity...</p>
          )}

          {/* Recent Stream List (Most Recent Real-Time Activities) */}
          <div className="mt-4 space-y-2">
            {recentFive.slice(1, 5).map((act) => (
              <div
                key={act.id}
                onClick={() => setShowFullModal(true)}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/25 px-3 py-2.5 hover:border-white/15 transition cursor-pointer"
              >
                <Avatar src={act.avatar} name={act.who} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#d6cbe9] truncate">
                    <strong className="text-white">{act.who}</strong> {act.action}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-mono text-[#8a7ba8]">{act.when}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer controls */}
        {feed.length > 1 && (
          <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-white/5">
            <div className="flex gap-1 overflow-hidden">
              {feed.slice(0, 10).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    i === idx % 10 ? "w-6 bg-gradient-pink" : "w-1.5 bg-white/15 hover:bg-white/30"
                  }`}
                  aria-label={`View activity ${i + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowFullModal(true)}
              className="text-[11px] text-[#a594c7] hover:text-pink-300 transition-colors font-semibold cursor-pointer"
            >
              Open Full Activity Log ({feed.length}) ↗
            </button>
          </div>
        )}
      </div>

      {/* FULL COMMUNITY ACTIVITY FEED MODAL */}
      {showFullModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setShowFullModal(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-pink-500/30 bg-[#140024] p-6 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-pink-400">
                    Real-Time Community Activity Log
                  </span>
                </div>
                <h3 className="font-display mt-1 text-2xl font-bold text-white">
                  Recent KR8 Ecosystem Activities
                </h3>
                <p className="mt-0.5 text-xs text-[#a594c7]">
                  Showing the {feed.length} most recent real-time registrations, graduations, submissions, and XP awards.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullModal(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/15 transition cursor-pointer"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {feed.map((act, index) => (
                <div
                  key={act.id || index}
                  className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 hover:border-pink-500/30 transition"
                >
                  <Avatar src={act.avatar} name={act.who} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-white leading-snug">
                      <span className="font-bold text-pink-300">{act.who}</span>{" "}
                      <span className="text-[#cabfe0]">{act.action}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-[#8a7ba8]">{act.when}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
