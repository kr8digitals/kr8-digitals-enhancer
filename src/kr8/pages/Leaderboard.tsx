// @ts-nocheck
import { useState, useEffect } from "react";
import { Pill, Card, GradientButton } from "../components/ui";
import LeaderboardList from "../components/LeaderboardList";
import { useSeo } from "../lib/useSeo";
import { useServerFn } from "@tanstack/react-start";
import * as pubFns from "@/lib/public-data.functions";

const pointRules = [
  {
    act: "Graduated with Excellent / Professionalism Distinction",
    pts: "+180 XP",
    badge: "⭐ Highest Distinction",
  },
  {
    act: "Graduated with Certificate of Completion",
    pts: "+110 XP",
    badge: "🎓 Certified Graduate",
  },
  {
    act: "Good Comment / Official Instructor Commendation",
    pts: "+45 XP",
    badge: "💬 Commended",
  },
  {
    act: "Double / Multi-Skill Track Mastery (per additional track)",
    pts: "+85 XP",
    badge: "⚡ Multi-Skill",
  },
  {
    act: "Approved Practical Assignment / Project Submission",
    pts: "+25 XP",
    badge: "📤 Coursework",
  },
  {
    act: "Verified Live Class Attendance (Mon/Wed/Fri)",
    pts: "+15 XP",
    badge: "✅ Attendance",
  },
  {
    act: "Verified Referral of a Fellow Scholar",
    pts: "+30 XP",
    badge: "🤝 Community",
  },
  {
    act: "Real-Time Tasks, Challenges & Admin Merit Awards",
    pts: "Variable XP",
    badge: "🔥 Live Tasks",
  },
];

export default function Leaderboard() {
  useSeo({
    title: "KR8 Digitals Leaderboard · Live Student & Graduate Rankings",
    description:
      "Real-time database rankings of KR8 Digitals Academy students and graduates across Graphic Design, Website Development, and Video Editing. Type your KR8 ID to find your ranking.",
    path: "/leaderboard",
  });

  const getLeaderboardFn = useServerFn(pubFns.getPublicLeaderboardAndFeed);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res: any = await getLeaderboardFn();
        if (active && res?.stats) {
          setStats(res.stats);
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="section-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="text-center">
          <Pill>Live Database Rankings · Proof of Consistency</Pill>
          <h1 className="font-display mt-5 text-4xl text-white sm:text-6xl font-bold">
            The <span className="text-gradient">KR8 Leaderboard</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[#b8aecf] text-sm sm:text-base">
            Every rank is computed directly from live database records — graduated credentials, instructor commendations, double-skill mastery, project submissions, class attendance, and real-time task awards.
          </p>
        </div>

        {/* Live Database Metrics Row */}
        {stats && (
          <div className="mt-10 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <Card className="p-4 text-center border-pink-500/25">
              <div className="font-display text-2xl sm:text-3xl font-bold text-gradient">
                {stats.totalStudents}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#8a7ba8]">
                Ranked Scholars
              </div>
            </Card>
            <Card className="p-4 text-center border-emerald-500/25">
              <div className="font-display text-2xl sm:text-3xl font-bold text-emerald-400">
                {stats.graduatedStudents}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#8a7ba8]">
                Certified Graduates
              </div>
            </Card>
            <Card className="p-4 text-center border-amber-500/25">
              <div className="font-display text-2xl sm:text-3xl font-bold text-amber-300">
                {stats.multiSkillStudents || 0}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#8a7ba8]">
                Multi-Skill Scholars
              </div>
            </Card>
            <Card className="p-4 text-center border-purple-500/25">
              <div className="font-display text-2xl sm:text-3xl font-bold text-white">
                {stats.totalCertificates}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#8a7ba8]">
                Verified Credentials
              </div>
            </Card>
          </div>
        )}

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {/* Main Ranked List */}
          <div className="lg:col-span-2">
            <LeaderboardList showSearch={true} />
          </div>

          {/* Sidebar: How XP & Rankings Work */}
          <div className="space-y-6">
            <Card className="border-pink-500/25 p-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-pink-400">
                Transparent Scoring Engine
              </span>
              <h3 className="font-display mt-1 text-xl font-bold text-white">
                How Points & Ranks Are Calculated
              </h3>
              <p className="mt-1.5 text-xs text-[#b8aecf] leading-relaxed">
                Graduates with <strong className="text-white">Excellent / Professionalism</strong> distinction and strong instructor comments earn higher points than standard completion, alongside real-time coursework and task points:
              </p>
              <ul className="mt-4 space-y-2.5 text-xs">
                {pointRules.map((r) => (
                  <li
                    key={r.act}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5"
                  >
                    <div>
                      <span className="inline-block rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-pink-300 mb-1">
                        {r.badge}
                      </span>
                      <p className="text-[#cabfe0] leading-snug">{r.act}</p>
                    </div>
                    <span className="shrink-0 font-mono font-bold text-pink-400">{r.pts}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="border-pink-400/30 p-6">
              <h3 className="font-bold text-white text-lg">Perks for Top Ranked Scholars</h3>
              <ul className="mt-3 space-y-2 text-xs text-[#b8aecf] leading-relaxed">
                <li>• Priority placement on paid KR8 Agency client briefs</li>
                <li>• Featured graduate spotlight on the Home & Academy pages</li>
                <li>• Direct 1-on-1 portfolio review with Founder Timfire & Co-Founders</li>
                <li>• Official commendation badge on your public `/verify` credential</li>
              </ul>
              <div className="mt-5">
                <GradientButton to="/register" className="w-full text-xs">
                  Register & Start Climbing →
                </GradientButton>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
