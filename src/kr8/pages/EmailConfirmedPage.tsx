import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "../router-shim";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../context/AuthContext";
import { Card, Pill } from "../components/ui";
import { useSeo } from "../lib/useSeo";
import { OFFICIAL_WHATSAPP_LINKS, normalizeSkillWhatsAppUrl } from "../data/store";
import * as welcomeFns from "@/lib/welcome.functions";
import { useServerFn } from "@tanstack/react-start";

const SKILL_DISPLAY: Record<string, string> = {
  graphic: "Graphic Design",
  web: "Website Development",
  frontend: "Front-End Development",
  video: "Video Editing & Animation",
  content_creation: "Content Creation",
  smm: "Social Media Management",
  marketing: "Digital Marketing",
  tribe: "KR8 Creative Tribe",
};

export default function EmailConfirmedPage() {
  useSeo({
    title: "Email Confirmed! Join Your WhatsApp Learning Group | KR8 Digitals",
    description:
      "Your KR8 Digitals email is officially confirmed! Join your WhatsApp learning group now to start your tuition-free cohort.",
    path: "/auth/confirmed",
    noindex: true,
  });

  const nav = useNavigate();
  const location = useLocation();
  const { user, refreshProfile, markWhatsAppOnboarding } = useAuth();
  const sendWelcomeFn = useServerFn(welcomeFns.sendWelcomeWithWhatsapp);

  const queryParams = new URLSearchParams(location.search);
  const querySkill = queryParams.get("skill") || "";
  const queryName = queryParams.get("name") || "";

  const [status, setStatus] = useState<"verifying" | "ready">("verifying");
  const [whatsappUrl, setWhatsappUrl] = useState(
    normalizeSkillWhatsAppUrl(querySkill || "graphic")
  );
  const [skillName, setSkillName] = useState(
    SKILL_DISPLAY[querySkill || "graphic"] || "Graphic Design"
  );
  const [kr8Id, setKr8Id] = useState("");
  const [studentName, setStudentName] = useState(queryName || "Scholar");
  const [busy, setBusy] = useState(false);
  const [clickedWhatsApp, setClickedWhatsApp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handleConfirm = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type") as any;

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (tokenHash && type) {
          await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        }

        await refreshProfile();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser && !cancelled) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id, kr8_id, name, skill")
            .eq("id", authUser.id)
            .maybeSingle();

          const sk = prof?.skill || authUser.user_metadata?.skill || querySkill || "graphic";
          const sName = SKILL_DISPLAY[sk] || sk;
          const wa = normalizeSkillWhatsAppUrl(sk);

          setKr8Id(prof?.kr8_id || "");
          setStudentName(prof?.name || authUser.user_metadata?.name || queryName || "Scholar");
          setSkillName(sName);
          setWhatsappUrl(wa);

          try {
            const res: any = await sendWelcomeFn({
              data: { userId: authUser.id, skillKey: sk },
            });
            if (res?.whatsappUrl) {
              setWhatsappUrl(normalizeSkillWhatsAppUrl(sk, res.whatsappUrl));
            }
            if (res?.skillName) {
              setSkillName(res.skillName);
            }
          } catch {}
        }
      } catch (e) {
        console.warn("[EmailConfirmedPage] verification notice:", e);
      } finally {
        if (!cancelled) setStatus("ready");
      }
    };
    handleConfirm();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep synced with AuthContext user if loaded
  useEffect(() => {
    if (user) {
      if (user.kr8_id && !kr8Id) setKr8Id(user.kr8_id);
      if (user.name) setStudentName(user.name);
      if (user.skill) {
        setSkillName(SKILL_DISPLAY[user.skill] || user.skill);
        setWhatsappUrl(normalizeSkillWhatsAppUrl(user.skill));
      }
    }
  }, [user, kr8Id]);

  const handleDone = async () => {
    setBusy(true);
    try {
      await markWhatsAppOnboarding(true, false);
      await refreshProfile();
    } catch {}
    setBusy(false);
    nav(user ? "/academy" : "/signin");
  };

  const handleSkip = async () => {
    setBusy(true);
    try {
      await markWhatsAppOnboarding(false, true);
      await refreshProfile();
    } catch {}
    setBusy(false);
    nav(user ? "/academy" : "/signin?remind_whatsapp=1");
  };

  if (status === "verifying") {
    return (
      <div className="section-bg min-h-screen flex items-center justify-center px-5">
        <Card className="p-10 text-center max-w-md border-pink-500/30">
          <div className="mx-auto h-12 w-12 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
          <p className="mt-4 text-base font-bold text-white">
            Confirming your email & preparing your KR8 Learning Group...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="section-bg min-h-screen py-12 sm:py-16 px-4">
      <div className="mx-auto max-w-2xl">
        <Card className="p-6 sm:p-10 text-center border-emerald-500/40 relative overflow-hidden shadow-2xl shadow-emerald-500/15">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />

          {/* Big Celebration Icon */}
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-4xl shadow-2xl shadow-emerald-500/40 animate-bounce">
            🥳
          </div>

          <Pill className="border-emerald-400/40 bg-emerald-500/10 text-emerald-200">
            Email Confirmed · Welcome to KR8 Digitals!
          </Pill>

          <h1 className="font-display mt-4 text-3xl sm:text-5xl font-black text-white leading-tight">
            Congratulations,{" "}
            <span className="text-gradient">{studentName.split(" ")[0]}!</span> You're Officially In! 🎉
          </h1>

          <p className="mt-3 text-sm sm:text-base text-[#d8cce8] max-w-xl mx-auto leading-relaxed">
            Your email is confirmed and your tuition-free scholarship seat in{" "}
            <strong className="text-white">{skillName}</strong> is officially active!
          </p>

          {kr8Id && (
            <div className="mt-6 rounded-2xl border border-pink-500/40 bg-pink-500/10 p-4 max-w-md mx-auto">
              <p className="text-[10px] uppercase tracking-widest text-pink-300 font-black">
                Your Official Verifiable KR8 ID
              </p>
              <p className="font-mono text-xl sm:text-2xl font-black text-white mt-1 tracking-wider">
                {kr8Id}
              </p>
              <p className="text-[11px] text-[#cabfe0] mt-1">
                Verifiable worldwide at <span className="text-pink-300">kr8digitals.com/verify</span>
              </p>
            </div>
          )}

          {/* UNMISTAKABLE WHATSAPP LEARNING GROUP CALLOUT */}
          <div className="mt-7 rounded-3xl border-2 border-[#25D366] bg-gradient-to-br from-[#25D366]/20 via-emerald-950/60 to-black/70 p-6 sm:p-8 shadow-2xl shadow-[#25D366]/20">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-1 text-[11px] font-black uppercase tracking-widest text-black">
              📲 FINAL STEP · DO NOT MISS THIS!
            </span>

            <h2 className="font-display mt-4 text-2xl sm:text-3xl font-black text-white leading-snug">
              Join Your {skillName} Learning Group on WhatsApp Now!
            </h2>

            <p className="mt-3 text-sm sm:text-base text-emerald-100 leading-relaxed max-w-lg mx-auto">
              All live class links (<strong className="text-white">Mon/Wed/Fri 9PM–12AM WAT</strong>), practical assignments (<strong className="text-white">Tue/Thu/Sat</strong>), and mentor feedback are shared directly inside your WhatsApp Learning Group.
            </p>

            {/* Primary Huge WhatsApp Button */}
            <div className="mt-6">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setClickedWhatsApp(true)}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-full bg-[#25D366] hover:bg-[#20bd5a] px-8 py-4 sm:py-5 text-base sm:text-lg font-black text-black shadow-2xl shadow-[#25D366]/40 hover:scale-[1.03] active:scale-95 transition-all"
              >
                <span className="text-2xl">💬</span>
                <span>Join {skillName} WhatsApp Group →</span>
              </a>
            </div>

            {clickedWhatsApp && (
              <p className="mt-3 text-xs font-bold text-emerald-300">
                ✓ WhatsApp opened! Once you've joined the group, click "Done — Go to My Profile" below!
              </p>
            )}

            {/* Direct links for all 3 official learning tracks in case they need them */}
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-[11px] uppercase tracking-wider font-bold text-[#a594c7] mb-2.5">
                Official Cohort WhatsApp Groups by Track:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <a
                  href={OFFICIAL_WHATSAPP_LINKS.graphic}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setClickedWhatsApp(true)}
                  className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-bold text-white transition-all"
                >
                  🎨 Graphic Design Group ↗
                </a>
                <a
                  href={OFFICIAL_WHATSAPP_LINKS.web}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setClickedWhatsApp(true)}
                  className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-bold text-white transition-all"
                >
                  💻 Website Development Group ↗
                </a>
                <a
                  href={OFFICIAL_WHATSAPP_LINKS.video}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setClickedWhatsApp(true)}
                  className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-bold text-white transition-all"
                >
                  🎬 Video Editing Group ↗
                </a>
              </div>
            </div>
          </div>

          {/* Done or Skip Actions */}
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={handleDone}
              disabled={busy}
              className="w-full rounded-full bg-gradient-pink py-4 px-8 text-sm sm:text-base font-black text-white shadow-xl shadow-pink-500/30 hover:scale-[1.01] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              ✓ I've Joined My WhatsApp Group — Done! Go to My Profile →
            </button>

            <button
              type="button"
              onClick={handleSkip}
              disabled={busy}
              className="w-full rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] py-3 px-6 text-xs sm:text-sm font-semibold text-[#b8aecf] hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              Skip for now — Go to My Profile (Remind me next time I log in)
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
