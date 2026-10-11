import { useEffect, useState } from "react";
import { Link, useNavigate } from "../router-shim";
import { useSeo } from "../lib/useSeo";
import { Pill, GradientButton } from "../components/ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../context/AuthContext";

export default function EmailConfirmedPage() {
  useSeo({ title: "Email Confirmed — Welcome to KR8!", description: "Join your WhatsApp learning group", path: "/auth/confirmed" });
  const navigate = useNavigate();
  const { student } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string>("");
  const [skillName, setSkillName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Try to get session from hash (Supabase email link)
          const hash = window.location.hash;
          if (hash) {
            // supabase client will parse automatically, wait a bit
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        const { data: { user: u2 } } = await supabase.auth.getUser();
        if (!u2) {
          setLoading(false);
          return;
        }
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', u2.id).maybeSingle();
        if (prof) {
          setProfile(prof);
          setSkillName(prof.skill || '');
          // Fetch whatsapp url
          if (prof.skill) {
            const { data: skillRow } = await supabase.from('skill_settings').select('whatsapp_url,name').eq('skill_key', prof.skill).maybeSingle();
            if (skillRow?.whatsapp_url) {
              setWhatsappUrl(skillRow.whatsapp_url);
              setSkillName(skillRow.name || prof.skill);
            } else {
              // fallback to store defaults
              const map: Record<string, string> = {
                graphic: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4",
                web: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v?s=cl&p=a&mlu=4&ilr=4",
                video: "https://chat.whatsapp.com/C9IyCVi8pWMJJUsErJhQ0M?s=cl&p=a&mlu=4&ilr=4",
              };
              setWhatsappUrl(map[prof.skill] || "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4");
            }
          }
          // Update email_confirmed_at
          await supabase.from('profiles').update({ email_confirmed_at: new Date().toISOString() }).eq('id', u2.id);
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleDone = async () => {
    if (profile) {
      try {
        await supabase.from('profiles').update({ whatsapp_joined: true, whatsapp_joined_at: new Date().toISOString() }).eq('id', profile.id);
        await supabase.from('notifications').insert({
          user_id: profile.id,
          text: `Welcome to KR8 ${skillName}! Your KR8 ID ${profile.kr8_id} is active. Class Mon/Wed/Fri 9PM-12AM WAT. Check attendance daily.`,
          read: false,
          link: '/academy',
        });
      } catch {}
    }
    navigate('/academy');
  };

  const handleSkip = async () => {
    if (profile) {
      try {
        await supabase.from('profiles').update({ onboarding_skipped: true }).eq('id', profile.id);
      } catch {}
    }
    navigate('/academy');
  };

  const handleJoin = () => {
    setJoined(true);
    if (whatsappUrl) window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return <div className="section-bg min-h-screen flex items-center justify-center"><div className="h-10 w-10 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="section-bg min-h-[90vh] flex items-center justify-center px-5 py-16">
      <div className="mx-auto max-w-2xl w-full text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-500/30 via-pink-500/20 to-purple-500/30 border-2 border-emerald-500/40 shadow-2xl shadow-emerald-500/20 animate-bounce">
          <span className="text-5xl">🎊</span>
        </div>
        <Pill>✅ Email Confirmed — You're Officially In!</Pill>
        <h1 className="font-display mt-6 text-4xl sm:text-5xl font-black text-white leading-tight">
          Welcome to the <span className="text-gradient">Family, {profile?.name?.split(' ')[0] || 'Creator'}!</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[#cabfe0] leading-relaxed">
          Your KR8 ID <strong className="font-mono text-pink-300 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded">{profile?.kr8_id || 'generated'}</strong> is now verified and active. You just unlocked tuition-free training, live feedback, and a tribe that never lets you build alone.
        </p>

        <div className="mt-8 rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-[#1a0030] to-pink-950/30 p-6 sm:p-8 text-left shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-3xl">📲</div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-white">FINAL STEP: Join Your Learning Group on WhatsApp</h3>
              <p className="mt-2 text-sm text-[#cabfe0] leading-relaxed">
                This is where the magic happens — daily live class links (Mon/Wed/Fri 9PM-12AM WAT), assignment drops, accountability, and direct access to senior instructors.
                <span className="block mt-2 text-emerald-300 font-bold text-base">👉 Unmistakable — click the green button below NOW. Don't skip this.</span>
              </p>

              {whatsappUrl ? (
                <div className="mt-6">
                  <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={handleJoin} className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-8 py-5 text-base font-black text-white shadow-2xl shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-98">
                    <span className="text-2xl">💬</span>
                    <span>Join {skillName || 'My'} WhatsApp Group — It's Free →</span>
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-emerald-600 text-xs font-black animate-pulse">!</span>
                  </a>
                  <p className="mt-3 text-[11px] text-center text-[#8a7ba8]">Opens WhatsApp • 1,500+ active learners • You can mute notifications, but don't leave</p>
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200">WhatsApp link loading... If it doesn't appear, contact support.</div>
              )}

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={handleDone} className={`rounded-full px-6 py-3 text-sm font-bold transition ${joined ? 'bg-gradient-pink text-white shadow-xl' : 'bg-white/10 border border-white/15 text-[#8a7ba8] hover:text-white'}`}>
                  {joined ? '✓ I Joined — Take Me to My Profile →' : 'I Joined — Done →'}
                </button>
                <button onClick={handleSkip} className="rounded-full border border-white/10 bg-transparent px-6 py-3 text-xs font-semibold text-[#8a7ba8] hover:text-white">
                  Skip for now → Go to Profile
                </button>
              </div>
              <p className="mt-3 text-[11px] text-[#6a5b82] text-center">If you skip, we'll remind you next time you log in. But seriously, join now — classes are live.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-[#8a7ba8] text-left">
          <p className="font-bold text-white">What happens next:</p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Class holds Mon/Wed/Fri 9PM-12AM WAT — attendance window auto-opens</li>
            <li>Assignments Tue/Thu/Sat — submit with date/topic/time + proof image</li>
            <li>Mindset Shift 1st & 3rd Sunday 7PM-11PM, attendance 10PM-11PM auto-marked via live</li>
            <li>Hangout last Sunday same time — community vibes</li>
            <li>Earn XP, climb leaderboard, graduate with verifiable QR certificate</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
