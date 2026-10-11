// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { Link } from "../router-shim";
import { getSkillName, getStudents } from "../data/store";
import { Avatar, Card, GradientButton } from "./ui";
import { useServerFn } from "@tanstack/react-start";
import * as pubFns from "@/lib/public-data.functions";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardListProps {
  limit?: number;
  compact?: boolean;
  showSearch?: boolean;
  showFullCta?: boolean;
}

export default function LeaderboardList({
  limit,
  compact = false,
  showSearch = true,
  showFullCta = false,
}: LeaderboardListProps) {
  const getLeaderboardFn = useServerFn(pubFns.getPublicLeaderboardAndFeed);

  const [entries, setEntries] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState<string>("all");

  const loadRankings = async () => {
    try {
      const res: any = await getLeaderboardFn();
      if (res?.ok && Array.isArray(res.leaderboard) && res.leaderboard.length > 0) {
        setEntries(res.leaderboard);
        if (res.stats) setStats(res.stats);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("[LeaderboardList] ServerFn fallback:", err);
    }

    // Fallback to direct Supabase profiles + certificates query
    try {
      const [{ data: profs }, { data: certs }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("is_suspended", false)
          .order("points", { ascending: false })
          .limit(300),
        supabase.from("certificates").select("*").eq("status", "active"),
      ]);

      if (profs && profs.length > 0) {
        const certByStudent = new Map<string, any[]>();
        for (const c of certs || []) {
          const k = (c.kr8_id || "").toUpperCase();
          if (k) {
            if (!certByStudent.has(k)) certByStudent.set(k, []);
            certByStudent.get(k)!.push(c);
          }
        }

        const computed = profs
          .filter((p: any) => !["kr8digitals01@gmail.com", "kutimfire001@gmail.com"].includes((p.email || "").toLowerCase()))
          .map((p: any) => {
            const pCerts = certByStudent.get((p.kr8_id || "").toUpperCase()) || [];
            const isGrad = Boolean(p.graduated || pCerts.length > 0);
            const tier = pCerts[0]?.tier || p.cert_tier || (isGrad ? "Professionalism" : null);
            const rec = pCerts[0]?.additional_notes || p.cert_recognition || p.verify_remark || "";
            const isExc = isGrad && (tier === "Professionalism" || /excellen|distinction|outstanding/i.test(rec));
            const hasComment = isGrad && rec.trim().length > 8;
            const multiCount = Math.max(1, pCerts.length);
            const subs = Number(p.submissions || 0);
            const att = Number(p.attendance_accepted || 0);
            const refs = Number(p.referrals || 0);
            const calc =
              50 +
              (isGrad ? (isExc ? 180 : 110) : 0) +
              (hasComment ? 45 : 0) +
              (multiCount > 1 ? (multiCount - 1) * 85 : 0) +
              subs * 25 +
              att * 15 +
              refs * 30;
            return {
              id: p.kr8_id || p.id,
              kr8_id: p.kr8_id || p.id,
              name: p.name || "KR8 Scholar",
              skill: p.skill || "graphic",
              skillName: getSkillName(p.skill),
              avatar: p.avatar || "",
              graduated: isGrad,
              certTier: tier,
              certRecognition: rec || null,
              isExcellent: isExc,
              hasGoodComment: hasComment,
              multiSkillCount: multiCount,
              submissions: subs,
              attendanceAccepted: att,
              referrals: refs,
              points: Math.max(Number(p.points || 0), calc),
            };
          })
          .sort((a: any, b: any) => b.points - a.points)
          .map((item: any, idx: number) => ({ ...item, rank: idx + 1 }));

        setEntries(computed);
        setLoading(false);
        return;
      }
    } catch {}

    // Local store fallback
    const localStudents = getStudents()
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .map((s, idx) => ({
        ...s,
        kr8_id: s.id,
        skillName: getSkillName(s.skill),
        rank: idx + 1,
      }));
    setEntries(localStudents);
    setLoading(false);
  };

  useEffect(() => {
    loadRankings();
    const channel = supabase
      .channel("kr8-leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadRankings())
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates" }, () => loadRankings())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => loadRankings())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Exact match lookup when user types a KR8 ID
  const exactLookupMatch = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q || q.length < 4) return null;
    return (
      entries.find(
        (e) =>
          String(e.kr8_id || e.id).toUpperCase() === q ||
          String(e.kr8_id || e.id).toUpperCase().includes(q)
      ) || null
    );
  }, [entries, searchQuery]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (trackFilter === "graduates") {
      list = list.filter((e) => e.graduated);
    } else if (trackFilter === "multiskill") {
      list = list.filter((e) => (e.multiSkillCount || 1) > 1);
    } else if (trackFilter !== "all") {
      list = list.filter((e) => e.skill === trackFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          String(e.kr8_id || e.id).toLowerCase().includes(q) ||
          String(e.name || "").toLowerCase().includes(q) ||
          String(e.skillName || "").toLowerCase().includes(q)
      );
    }

    if (limit && !searchQuery.trim()) {
      return list.slice(0, limit);
    }
    return list.slice(0, limit ? Math.max(limit, 25) : 150);
  }, [entries, trackFilter, searchQuery, limit]);

  if (loading) {
    return (
      <div className="space-y-3 py-6">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="h-16 rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search by KR8 ID or Name + Filter Pills */}
      {showSearch && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Type your KR8 ID (e.g. KR82026...) or Name to find your ranking..."
              className="w-full rounded-2xl border border-white/15 bg-black/40 pl-4 pr-10 py-3 text-xs sm:text-sm text-white placeholder-[#8a7ba8] focus:border-pink-400 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#a594c7] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {!compact && (
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "all", label: "All Ranked" },
                { key: "graduates", label: "🎓 Graduates" },
                { key: "multiskill", label: "⚡ Multi-Skill" },
                { key: "graphic", label: "🎨 Design" },
                { key: "web", label: "💻 Web Dev" },
                { key: "video", label: "🎬 Video" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTrackFilter(t.key)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                    trackFilter === t.key
                      ? "bg-gradient-pink text-white shadow-md"
                      : "border border-white/10 bg-white/[0.03] text-[#b8aecf] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Instant KR8 ID Rank Lookup Spotlight Card */}
      {exactLookupMatch && searchQuery.trim().length >= 5 && (
        <div className="rounded-2xl border-2 border-pink-500/60 bg-gradient-to-r from-pink-950/70 via-[#1b0530] to-purple-950/60 p-4 sm:p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-pink text-white font-black shadow-lg">
                <span className="text-[9px] uppercase tracking-wider opacity-80">Rank</span>
                <span className="text-sm leading-none">#{exactLookupMatch.rank}</span>
              </div>
              <Avatar src={exactLookupMatch.avatar} name={exactLookupMatch.name} size={46} />
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-white text-sm sm:text-base">
                    {exactLookupMatch.name}
                  </span>
                  {exactLookupMatch.graduated && (
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      🎓 {exactLookupMatch.isExcellent ? "Excellent / Professionalism" : "Graduated"}
                    </span>
                  )}
                  {(exactLookupMatch.multiSkillCount || 1) > 1 && (
                    <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      ⚡ {exactLookupMatch.multiSkillCount} Skills
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-pink-300 mt-0.5">
                  {exactLookupMatch.kr8_id} · {exactLookupMatch.skillName}
                </p>
                {exactLookupMatch.certRecognition && (
                  <p className="mt-1 text-[11px] italic text-pink-200 line-clamp-1">
                    "⭐ {exactLookupMatch.certRecognition}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-display text-2xl font-black text-gradient">
                  {exactLookupMatch.points} XP
                </div>
                <div className="text-[10px] text-[#a594c7]">
                  Ranked #{exactLookupMatch.rank} of {entries.length}
                </div>
              </div>
              <Link
                to={`/verify?id=${encodeURIComponent(exactLookupMatch.kr8_id)}`}
                className="rounded-xl border border-pink-400/40 bg-pink-500/15 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-pink-500/25 transition"
              >
                Verify ID →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Ranked Rows */}
      {filteredEntries.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-[#b8aecf]">
            No scholar found matching <span className="font-mono text-white">"{searchQuery}"</span>.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredEntries.map((s) => {
            const rank = s.rank || 1;
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
            const isTop3 = rank <= 3;

            return (
              <div
                key={s.kr8_id || s.id}
                className={`flex items-center gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 transition-all ${
                  isTop3
                    ? "border-pink-400/40 bg-gradient-to-r from-pink-500/15 via-purple-500/10 to-white/[0.02] shadow-lg shadow-pink-500/5"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                <div
                  className={`w-10 text-center font-display ${
                    isTop3 ? "text-2xl" : "text-sm font-bold text-[#a594c7]"
                  }`}
                >
                  {medal}
                </div>

                <Avatar src={s.avatar} name={s.name} size={compact ? 40 : 46} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      to={`/verify?id=${encodeURIComponent(s.kr8_id || s.id)}`}
                      className="truncate font-bold text-white hover:text-pink-300 transition text-sm sm:text-base"
                    >
                      {s.name}
                    </Link>

                    {s.graduated && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          s.isExcellent
                            ? "bg-gradient-pink text-white border-pink-400/50"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        }`}
                      >
                        {s.isExcellent ? "⭐ Excellent · Pro Graduate" : "🎓 Completed"}
                      </span>
                    )}

                    {(s.multiSkillCount || 1) > 1 && (
                      <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        ⚡ {s.multiSkillCount}x Skill
                      </span>
                    )}

                    {s.hasGoodComment && !compact && (
                      <span
                        className="rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[10px] font-semibold text-purple-200"
                        title={s.certRecognition}
                      >
                        💬 Commended
                      </span>
                    )}
                  </div>

                  <p className="truncate text-xs text-[#8a7ba8] mt-0.5">
                    {s.skillName || getSkillName(s.skill)} ·{" "}
                    <span className="font-mono text-[#b8aecf]">{s.kr8_id || s.id}</span>
                    {!compact && (
                      <>
                        {" "}
                        · {s.submissions || 0} submissions · {s.attendanceAccepted || 0} classes
                      </>
                    )}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-display text-lg sm:text-xl font-bold text-gradient">
                    {s.points}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[#8a7ba8]">
                    XP Points
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA to View Full Leaderboard when displayed in compact Top 10 mode */}
      {(showFullCta || compact) && (
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-pink-500/25 bg-pink-500/5 px-5 py-4">
          <div className="text-xs text-[#cabfe0] text-center sm:text-left">
            Showing <strong className="text-white">Top {filteredEntries.length}</strong> of{" "}
            <strong className="text-pink-300">{stats?.totalStudents || entries.length}</strong> ranked scholars & graduates. Type your KR8 ID above or view the full board.
          </div>
          <GradientButton to="/leaderboard" className="text-xs px-5 py-2.5 shrink-0">
            See Full Leaderboard & Rankings →
          </GradientButton>
        </div>
      )}
    </div>
  );
}
