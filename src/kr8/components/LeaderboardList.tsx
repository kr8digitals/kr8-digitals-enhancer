// Production LeaderboardList - uses secure RPC get_leaderboard
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./ui";
import Icon from "./Icon";

type LeaderRow = {
  id: string;
  kr8_id: string;
  name: string;
  skill: string | null;
  points: number;
  avatar: string | null;
  graduated: boolean;
  referrals: number;
};

function getSkillName(key?: string | null): string {
  if (!key) return "Digital Skills";
  const map: Record<string, string> = {
    graphic: "Graphic Design",
    video: "Video Editing",
    web: "Website Development",
    frontend: "Front-End Development",
    content_creation: "Content Creation",
    content: "Content Creation",
    smm: "Social Media Management",
    marketing: "Digital Marketing",
  };
  return map[key.toLowerCase()] || key;
}

export default function LeaderboardList({ limit }: { limit?: number }) {
  const { student } = useAuth();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // Use secure RPC get_leaderboard - returns safe fields only
        const { data, error } = await supabase.rpc('get_leaderboard', { limit_n: limit ?? 50 });

        if (error) {
          console.warn('Leaderboard RPC error:', error.message);
          if (mounted) setRows([]);
          return;
        }

        if (mounted) setRows((data as LeaderRow[]) || []);
      } catch (e) {
        console.warn('Leaderboard exception:', e);
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    // Poll every 60-120 seconds to protect free quota, no realtime on whole profiles table
    const interval = setInterval(load, 90000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-2 overflow-x-hidden">
      {rows.map((s, i) => {
        const isMe = student?.id === s.id || student?.kr8_id === s.kr8_id;
        return (
          <div
            key={s.id}
            className={`flex items-center gap-2.5 sm:gap-3.5 rounded-2xl border p-2.5 sm:p-3.5 w-full max-w-full min-w-0 transition-colors ${
              isMe
                ? "border-pink-400/60 bg-pink-500/10"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="w-6 sm:w-8 shrink-0 text-center text-sm sm:text-base font-bold text-[#b8aecf]">
              {i < 3 ? <Icon name="trophy" size={16} className="text-pink-400 mx-auto" /> : i + 1}
            </div>
            <div className="shrink-0">
              <Avatar src={s.avatar || undefined} name={s.name} size={36} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1 leading-snug">
                <span className="truncate text-xs sm:text-sm font-semibold text-white max-w-[110px] xs:max-w-[140px] sm:max-w-xs">
                  {s.name}
                </span>
                {isMe && (
                  <span className="text-[10px] sm:text-xs text-pink-400 font-bold shrink-0">(You)</span>
                )}
                {s.graduated && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-[#cabfe0] shrink-0 font-medium">
                    <Icon name="certificate" size={10} /> Grad
                  </span>
                )}
                {s.referrals >= 5 && (
                  <span className="rounded-full bg-gradient-pink px-1.5 py-0.5 text-[9px] text-white font-bold shrink-0">
                    Life Changer
                  </span>
                )}
              </div>
              <p className="truncate text-[10px] sm:text-xs text-[#8a7ba8] mt-0.5">{getSkillName(s.skill)}</p>
            </div>
            <div className="shrink-0 text-right pl-1">
              <p className="text-sm sm:text-base font-bold text-gradient leading-tight">{s.points || 0}</p>
              <p className="text-[9px] uppercase tracking-wider text-[#8a7ba8]">pts</p>
            </div>
          </div>
        );
      })}
      {rows.length === 0 && (
        <p className="text-xs text-[#8a7ba8] text-center py-6">No students yet. Be the first to earn points!</p>
      )}
    </div>
  );
}
