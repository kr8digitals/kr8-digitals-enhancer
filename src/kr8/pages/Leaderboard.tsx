// Production Leaderboard - public, privacy-safe database ranking
import { useEffect, useState, useMemo } from "react";
import { useSeo } from "../lib/useSeo";
import { Card, Pill, Avatar } from "../components/ui";
import { Link } from "../router-shim";
import { supabase } from "@/integrations/supabase/client";

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
  created_at: string | null;
  graduation_comment: string | null;
  graduation_score: number;
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
    (profile.graduation_score || 0) +
    (profile.double_skill ? 50 : 0)
  );
}

export default function Leaderboard() {
  useSeo({ path: "/leaderboard", title: "Leaderboard — Real DB Ranking | KR8 Digitals" });
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState("");
  const [filterSkill, setFilterSkill] = useState("all");
  const [viewAll, setViewAll] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc("get_unified_leaderboard", { limit_n: 200 });
        if (error) throw error;
        if (active) setProfiles((data || []) as ProfileRow[]);
      } catch (error) {
        console.warn("Could not load public leaderboard:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const ranked = useMemo(() => {
    let list = profiles.map((profile) => ({ ...profile, _points: computePoints(profile) }));
    list.sort((a, b) => b._points - a._points);
    if (filterSkill !== "all") {
      list = list.filter((profile) => (profile.skill || "").toLowerCase() === filterSkill.toLowerCase());
    }
    if (searchId.trim()) {
      const query = searchId.trim().toLowerCase();
      list = list.filter((profile) =>
        (profile.kr8_id || "").toLowerCase().includes(query) ||
        (profile.name || "").toLowerCase().includes(query)
      );
    }
    return list.map((profile, index) => ({ ...profile, rank: index + 1 }));
  }, [profiles, filterSkill, searchId]);

  const visibleRows = viewAll ? ranked.slice(0, 100) : ranked.slice(0, 10);
  const skills = Array.from(new Set(profiles.map((profile) => profile.skill).filter((skill): skill is string => Boolean(skill))));
  const myRank = searchId.trim()
    ? ranked.find((profile) => (profile.kr8_id || "").toLowerCase() === searchId.trim().toLowerCase())
    : null;

  return (
    <div className="section-bg min-h-screen py-12 px-5">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-8">
          <Pill>Live DB · Real Tasks · Tier Scoring Excellence &gt; Professionalism &gt; Completion</Pill>
          <h1 className="font-display mt-4 text-4xl sm:text-5xl font-black text-white">Leaderboard <span className="text-gradient">Live</span></h1>
          <p className="mt-3 text-sm text-[#cabfe0] max-w-2xl mx-auto">Real points from attendance (5xp), submissions (10xp), referrals (20xp), tier Excellence 200, Professionalism 150, Completion 100, double skill 50, and graduation score. Rankings refresh automatically as students complete tasks.</p>
        </div>

        <Card className="p-5 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <input type="text" placeholder="Search KR8 ID to find your ranking (e.g. KR82026...)" className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none" value={searchId} onChange={e => setSearchId(e.target.value)} />
            </div>
            <select value={filterSkill} onChange={e => setFilterSkill(e.target.value)} className="rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-xs text-white">
              <option value="all">All Skills</option>
              {skills.map(skill => <option key={skill} value={skill}>{skill}</option>)}
            </select>
            <button onClick={() => setViewAll(!viewAll)} className="rounded-full bg-white/10 border border-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/15">{viewAll ? "View Top 10" : "View Full 100 →"}</button>
          </div>
          {myRank && (
            <div className="mt-4 rounded-xl border-2 border-pink-500/40 bg-pink-500/10 p-3 text-sm">
              <p className="font-bold text-white">Ranking: #{myRank.rank} — {myRank.name} ({myRank.kr8_id}) — {myRank._points} XP • Tier {myRank.cert_tier || "—"}</p>
            </div>
          )}
        </Card>

        {loading ? (
          <div className="text-center py-16 text-[#8a7ba8] text-sm">Loading privacy-safe leaderboard from Supabase...</div>
        ) : (
          <div className="space-y-3">
            {visibleRows.map((profile) => (
              <Card key={profile.kr8_id} className={`p-4 flex items-center gap-4 ${profile.rank <= 3 ? "border-amber-500/30 bg-amber-500/[0.06]" : ""}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full font-black text-sm ${profile.rank === 1 ? "bg-amber-400 text-black" : profile.rank === 2 ? "bg-zinc-300 text-black" : profile.rank === 3 ? "bg-amber-700 text-white" : "bg-white/10 text-white"}`}>#{profile.rank}</div>
                <Avatar {...(profile.avatar ? { src: profile.avatar } : {})} name={profile.name} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{profile.name} <span className="font-mono text-[11px] text-[#8a7ba8]">{profile.kr8_id}</span></p>
                  <p className="text-[11px] text-[#8a7ba8] truncate">{profile.skill || "—"} • Att {profile.attendance_accepted} • Sub {profile.submissions} • Ref {profile.referrals} {profile.double_skill ? "• Double Skill" : ""} {profile.cert_tier ? `• Tier ${profile.cert_tier}` : ""}</p>
                  {profile.graduation_comment && <p className="text-[11px] text-emerald-300 truncate">💬 {profile.graduation_comment}</p>}
                </div>
                <div className="text-right">
                  <p className="font-black text-white text-sm">{profile._points} XP</p>
                  <p className="text-[10px] text-[#6a5b82]">{profile.graduated ? "graduated" : "active"}</p>
                </div>
              </Card>
            ))}
            {ranked.length === 0 && <div className="text-center py-12 text-[#8a7ba8] text-sm">No students found for this filter or search.</div>}
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="font-bold text-white text-sm">How Points Work (Real Tasks, Real-Time)</h3>
          <ul className="mt-2 text-xs text-[#8a7ba8] space-y-1 list-disc list-inside">
            <li>Attendance: 5 XP per approved session</li>
            <li>Submissions: 10 XP per portfolio/task submission</li>
            <li>Referrals: 20 XP per verified referral</li>
            <li>Graduation Tier: Excellence 200 &gt; Professionalism 150 &gt; Completion 100</li>
            <li>Double Skill: +50 bonus when a student completes 2 skills</li>
            <li>Graduation Score: custom admin score adds directly</li>
            <li>Leaderboard data is returned by a security-definer RPC that excludes private contact details.</li>
          </ul>
        </div>

        <div className="mt-8 text-center">
          <Link to="/register" className="rounded-full bg-gradient-pink px-6 py-3 text-sm font-bold text-white shadow-xl shadow-pink-500/25">Join Cohort Free — Climb Leaderboard →</Link>
        </div>
      </div>
    </div>
  );
}
