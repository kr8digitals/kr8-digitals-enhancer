// Production LeaderboardList - Real DB unified with Leaderboard page
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./ui";
import Icon from "./Icon";

type ProfileRow = {
  kr8_id: string;
  name: string;
  skill: string | null;
  total_points: number;
  points: number;
  attendance_accepted: number;
  submissions: number;
  referrals: number;
  cert_tier: string | null;
  graduated: boolean;
  double_skill: boolean;
  avatar: string | null;
};

const TIER_SCORE: Record<string, number> = {
  excellent: 200,
  excellence: 200,
  professionalism: 150,
  completion: 100,
  completed: 100,
};

function computePoints(profile: ProfileRow): number {
  if (typeof profile.total_points === "number") return profile.total_points;
  const tierScore = TIER_SCORE[(profile.cert_tier || "").toLowerCase()] || 0;
  return (
    (profile.points || 0) +
    (profile.attendance_accepted || 0) * 5 +
    (profile.submissions || 0) * 10 +
    (profile.referrals || 0) * 20 +
    tierScore +
    (profile.double_skill ? 50 : 0)
  );
}

export default function LeaderboardList({ limit }: { limit?: number }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc("get_unified_leaderboard", { limit_n: 100 });
        if (error) throw error;
        if (active) setProfiles((data || []) as ProfileRow[]);
      } catch (error) {
        console.warn("Could not load public leaderboard:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 20_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const sorted = useMemo(() => {
    const list = profiles.map((profile) => ({ ...profile, _points: computePoints(profile) }));
    list.sort((a, b) => b._points - a._points);
    return list;
  }, [profiles]);

  const rows = sorted.slice(0, limit ?? 10);

  if (loading) return <div className="py-6 text-center text-xs text-[#8a7ba8]">Loading real leaderboard...</div>;

  return (
    <div className="w-full max-w-full space-y-2 overflow-x-hidden">
      {rows.map((student, index) => {
        const isMe = user?.kr8_id === student.kr8_id;
        return (
          <div
            key={student.kr8_id}
            className={`flex items-center gap-2.5 sm:gap-3.5 rounded-2xl border p-2.5 sm:p-3.5 w-full max-w-full min-w-0 transition-colors ${
              isMe ? "border-pink-400/60 bg-pink-500/10" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="w-6 sm:w-8 shrink-0 text-center text-sm sm:text-base font-bold text-[#b8aecf]">
              {index < 3 ? <Icon name="trophy" size={16} className="text-pink-400 mx-auto" /> : index + 1}
            </div>
            <div className="shrink-0">
              <Avatar {...(student.avatar ? { src: student.avatar } : {})} name={student.name} size={36} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1 leading-snug">
                <span className="truncate text-xs sm:text-sm font-semibold text-white max-w-[110px] xs:max-w-[140px] sm:max-w-xs">
                  {student.name}
                </span>
                {isMe && <span className="text-[10px] sm:text-xs text-pink-400 font-bold shrink-0">(You)</span>}
                {student.double_skill && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[9px] text-amber-300 shrink-0 font-bold">
                    <Icon name="bolt" size={10} /> Double Skill
                  </span>
                )}
                {student.cert_tier && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-[#cabfe0] shrink-0 font-medium">
                    <Icon name="certificate" size={10} /> {student.cert_tier}
                  </span>
                )}
              </div>
              <p className="truncate text-[10px] sm:text-xs text-[#8a7ba8] mt-0.5">{student.skill || "—"} • {student.kr8_id}</p>
            </div>
            <div className="shrink-0 text-right pl-1">
              <p className="text-sm sm:text-base font-bold text-gradient leading-tight">{student._points}</p>
              <p className="text-[9px] uppercase tracking-wider text-[#8a7ba8]">xp</p>
            </div>
          </div>
        );
      })}
      {rows.length === 0 && <p className="text-xs text-center text-[#6a5b82] py-4">No students yet — be the first to join the leaderboard!</p>}
    </div>
  );
}
