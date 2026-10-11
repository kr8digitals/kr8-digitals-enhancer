// Production Dashboard - Real DB, WhatsApp reminder if skipped, live feed, leaderboard
import { useState, useEffect } from "react";
import { useSeo } from "../lib/useSeo";
import { Link } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { useLiveStream } from "../context/LiveStreamContext";
import { getSkill } from "../data/store";
import LiveFeed from "../components/LiveFeed";
import { Pill, Card, GradientButton } from "../components/ui";
import { supabase } from "@/integrations/supabase/client";

const actions = [
  { icon: "📚", label: "Program", title: "Continue Learning", desc: "Pick up your skill track where you left off.", to: "/academy" },
  { icon: "✅", label: "Attendance", title: "Mark Attendance", desc: "Submit class, assignment or hangout proof.", to: "/academy" },
  { icon: "👤", label: "Profile", title: "View My Profile", desc: "Portfolio, activity, badges & referrals.", to: "/academy" },
  { icon: "💼", label: "Opportunities", title: "Browse Opportunities", desc: "Real client work from KR8 Agency.", to: "/agency" },
  { icon: "🤖", label: "Mentor", title: "Chat on KR8 AI", desc: "Unlimited access to your creative mentor.", to: "/ai" },
  { icon: "🔒", label: "Security", title: "Settings & Biometrics", desc: "Manage Touch ID / Fingerprint, password and privacy.", to: "/settings" },
];

export default function Dashboard() {
  useSeo({ path: "/dashboard", noindex: true });
  const { user } = useAuth();
  const { isLive, activeStream, openStage } = useLiveStream();
  const [profile, setProfile] = useState<any>(null);
  const [whatsappReminder, setWhatsappReminder] = useState<any>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (prof) {
          setProfile(prof);
          if (!prof.whatsapp_joined) {
            const { data: skillRow } = await supabase.from('skill_settings').select('whatsapp_url,name').eq('skill_key', prof.skill || '').maybeSingle();
            if (skillRow?.whatsapp_url) {
              setWhatsappReminder({ profile: prof, whatsappUrl: skillRow.whatsapp_url, skillName: skillRow.name });
            }
          }
        }
        const [{ data: all, error: leaderboardError }, { data: counts }] = await Promise.all([
          supabase.rpc("get_unified_leaderboard", { limit_n: 1000 }),
          supabase.rpc("public_counts" as any),
        ]);
        if (leaderboardError) throw leaderboardError;
        const publicCounts = counts as { total_students?: number } | null;
        if (typeof publicCounts?.total_students === "number") setTotalStudents(publicCounts.total_students);
        if (all) {
          const idx = all.findIndex((row) => row.kr8_id === user.kr8_id);
          if (idx >= 0) setRank(idx + 1);
        }
      } catch {}
    };
    load();
  }, [user]);

  if (!user) return null;
  const skill = getSkill(profile?.skill || user.skill || 'graphic');
  const first = (profile?.name || user.name || 'Creator').split(' ')[0];

  const handleJoinWhatsapp = async () => {
    if (!whatsappReminder) return;
    try {
      await supabase.from('profiles').update({ whatsapp_joined: true, whatsapp_joined_at: new Date().toISOString() }).eq('id', user.id);
      window.open(whatsappReminder.whatsappUrl, '_blank');
      setWhatsappReminder(null);
    } catch {}
  };

  const handleDismissWhatsapp = async () => {
    try {
      await supabase.from('profiles').update({ onboarding_skipped: true }).eq('id', user.id);
    } catch {}
    setWhatsappReminder(null);
  };

  return (
    <div className="section-bg min-h-screen py-8 px-5">
      <div className="mx-auto max-w-6xl">
        {whatsappReminder && (
          <div className="mb-6 rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-[#0d0015] p-6 shadow-2xl shadow-emerald-500/10">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white">You skipped WhatsApp group join — your tribe is waiting!</h3>
                <p className="mt-1 text-sm text-emerald-200">Join <strong className="text-white">{whatsappReminder.skillName}</strong> WhatsApp group now to get live class links Mon/Wed/Fri 9PM-12AM WAT. Without this, you'll miss class notifications.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={handleJoinWhatsapp} className="rounded-full bg-[#25D366] px-6 py-3 text-sm font-black text-white shadow-xl shadow-emerald-500/30 hover:bg-[#20bd5a]">Join WhatsApp Group →</button>
                  <button onClick={handleDismissWhatsapp} className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-bold text-white hover:bg-white/10">Dismiss (remind later)</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <Pill>Dashboard · Live DB · {profile?.kr8_id || user.kr8_id}</Pill>
            <h1 className="font-display mt-3 text-3xl sm:text-4xl font-black text-white">Welcome back, <span className="text-gradient">{first}</span>! 👋</h1>
            <p className="mt-2 text-sm text-[#cabfe0]">Skill: <strong className="text-white">{profile?.skill || user.skill || '—'}</strong> • Points: <strong className="text-white">{profile?.total_points ?? 0} XP</strong> • Rank: <strong className="text-white">#{rank || '—'} of {totalStudents}</strong> • Attendance: {profile?.attendance_count || 0}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/leaderboard" className="rounded-full bg-white/10 border border-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/15">Leaderboard →</Link>
            <Link to="/verify" className="rounded-full bg-gradient-pink px-4 py-2 text-xs font-bold text-white">Verify ID</Link>
          </div>
        </div>

        {isLive && activeStream && (
          <Card className="p-4 mb-6 border-pink-500/30 bg-pink-500/10 flex items-center justify-between">
            <p className="text-sm font-bold text-white">🔴 LIVE NOW: {activeStream.title} — {activeStream.hostName}</p>
            <button onClick={() => openStage()} className="rounded-full bg-pink-500 px-4 py-1.5 text-xs font-bold text-white">Join Live →</button>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {actions.map(a => (
            <Link key={a.label} to={a.to} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-pink-500/30 hover:bg-white/[0.06] transition group">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a7ba8]">{a.label}</p>
                  <h3 className="font-bold text-white text-sm group-hover:text-pink-300">{a.title}</h3>
                  <p className="text-xs text-[#8a7ba8] mt-1">{a.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h3 className="font-bold text-white mb-4">Your Journey — Real DB</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-black/30 border border-white/10 p-3"><p className="text-[11px] text-[#8a7ba8]">KR8 ID</p><p className="font-mono text-xs font-bold text-white">{profile?.kr8_id || '—'}</p></div>
                <div className="rounded-xl bg-black/30 border border-white/10 p-3"><p className="text-[11px] text-[#8a7ba8]">Points</p><p className="font-bold text-white text-sm">{profile?.total_points ?? 0} XP</p></div>
                <div className="rounded-xl bg-black/30 border border-white/10 p-3"><p className="text-[11px] text-[#8a7ba8]">Attendance</p><p className="font-bold text-white text-sm">{profile?.attendance_count || 0}</p></div>
                <div className="rounded-xl bg-black/30 border border-white/10 p-3"><p className="text-[11px] text-[#8a7ba8]">Tier</p><p className="font-bold text-white text-sm capitalize">{profile?.graduation_tier || 'Learning'}</p></div>
              </div>
              <div className="mt-6">
                <Link to="/academy" className="inline-flex rounded-full bg-gradient-pink px-5 py-2.5 text-xs font-bold text-white">Continue Learning →</Link>
              </div>
            </Card>
          </div>
          <div>
            <Card className="p-5">
              <LiveFeed limit={12} showHeader={true} />
              <div className="mt-4 text-center">
                <Link to="/leaderboard" className="text-xs text-pink-400 hover:text-pink-300 underline">View Full Leaderboard →</Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
