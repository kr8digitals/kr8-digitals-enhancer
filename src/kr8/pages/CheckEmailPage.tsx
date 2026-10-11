import { useState, useEffect } from "react";
import { useLocation, Link, useNavigate } from "../router-shim";
import { supabase } from "@/integrations/supabase/client";
import { Card, Pill } from "../components/ui";
import { useSeo } from "../lib/useSeo";
import { getSkillName } from "../data/store";

export default function CheckEmailPage() {
  useSeo({
    title: "Step 1 Complete! Confirm Your Email to Finish Registration | KR8 Digitals",
    description:
      "Congratulations on taking the first step! Confirm your email address to complete your KR8 Digitals registration and unlock your WhatsApp learning group.",
    path: "/register/check-email",
    noindex: true,
  });

  const location = useLocation();
  const nav = useNavigate();
  const params = new URLSearchParams(location.search);
  const email = params.get("email") || "";
  const name = params.get("name") || "Creator";
  const skillKey = params.get("skill") || "graphic";
  const skillName =
    params.get("skillName") ||
    (skillKey === "tribe" ? "KR8 Creative Tribe" : getSkillName(skillKey));
  const mode = (params.get("mode") === "tribe" ? "tribe" : "student") as "student" | "tribe";

  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Listen in case user confirms email in another tab
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.email_confirmed_at) {
        nav(
          `/auth/confirmed?email=${encodeURIComponent(email)}&name=${encodeURIComponent(
            name
          )}&skill=${encodeURIComponent(skillKey)}`
        );
      }
    });
    return () => subscription.unsubscribe();
  }, [email, name, skillKey, nav]);

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setResending(true);
    setResentMsg("");
    try {
      const siteOrigin = typeof window !== "undefined" ? window.location.origin : "https://www.kr8digitals.com";
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${siteOrigin}/auth/confirmed`,
        },
      });

      try {
        const { sendRegistrationConfirmationEmail } = await import("@/lib/welcome.functions");
        await sendRegistrationConfirmationEmail({
          data: {
            email,
            name,
            skillKey,
            mode,
            siteOrigin,
          },
        });
      } catch {}

      if (error && !error.message.toLowerCase().includes("rate")) {
        setResentMsg("⚠️ " + error.message);
      } else {
        setResentMsg(
          "✅ Fresh confirmation email sent! Please check your Inbox, Spam, and Promotions folders now."
        );
        setCooldown(45);
      }
    } catch (e: any) {
      setResentMsg("⚠️ " + (e.message || "Failed to resend confirmation email."));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="section-bg min-h-screen py-12 sm:py-16 px-4">
      <div className="mx-auto max-w-2xl">
        <Card className="p-6 sm:p-10 text-center border-pink-500/40 relative overflow-hidden shadow-2xl shadow-pink-500/15">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />

          {/* Celebration Icon */}
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-pink text-4xl shadow-2xl shadow-pink-500/40 animate-bounce">
            🎉
          </div>

          <Pill>Step 1 of 2 Complete · Proud of You!</Pill>

          <h1 className="font-display mt-4 text-3xl sm:text-5xl font-black text-white leading-tight">
            Congratulations on Taking the First Step,{" "}
            <span className="text-gradient">{name.split(" ")[0]}!</span>
          </h1>

          <p className="mt-3 text-sm sm:text-base text-[#d8cce8] max-w-xl mx-auto leading-relaxed">
            90% of people only talk about learning a high-income digital skill — <strong className="text-white">you actually took action today</strong> for <strong className="text-pink-300">{skillName}</strong>.
          </p>

          {/* UNMISTAKABLE BOLD CALLOUT */}
          <div className="mt-7 rounded-3xl border-2 border-amber-400/80 bg-gradient-to-br from-amber-500/20 via-pink-500/15 to-purple-900/30 p-6 sm:p-8 text-center shadow-xl shadow-amber-500/10">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-black">
              ⚠️ ACTION REQUIRED TO COMPLETE REGISTRATION
            </div>
            <h2 className="font-display mt-4 text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-snug">
              Now Confirm Your Email to Activate Your KR8 Account!
            </h2>
            <p className="mt-3 text-sm sm:text-base font-semibold text-amber-100 leading-relaxed">
              Your registration is <span className="underline decoration-amber-400 decoration-2 font-black text-white">NOT complete</span> until you open the email we just sent to:
            </p>
            <div className="mt-3 inline-block rounded-2xl border border-pink-400/50 bg-black/60 px-5 py-2.5 font-mono text-sm sm:text-base font-bold text-pink-300 break-all">
              {email || "your email inbox"}
            </div>
            <p className="mt-3 text-xs sm:text-sm text-[#e9d5ff]">
              Open that email and click the large <strong className="text-white">"Confirm My Email"</strong> button. Once confirmed, you will immediately unlock your <strong className="text-emerald-300">Official {skillName} WhatsApp Learning Group</strong> and your verifiable <strong className="text-pink-300">KR8 ID</strong>!
            </p>

            {/* Quick Open Email Client Buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-pink px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-pink-500/30 hover:scale-105 transition-transform"
              >
                <span>📬 Open Gmail Inbox →</span>
              </a>
              <a
                href="https://outlook.live.com/mail/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-xs sm:text-sm font-bold text-white hover:bg-white/15 transition-colors"
              >
                <span>Open Outlook / Yahoo ↗</span>
              </a>
            </div>
          </div>

          {/* Step-by-Step Checklist */}
          <div className="mt-7 rounded-2xl border border-white/10 bg-black/40 p-5 sm:p-6 text-left">
            <p className="text-xs font-black uppercase tracking-wider text-pink-400 mb-3">
              How to Complete Your Registration in 30 Seconds:
            </p>
            <ol className="space-y-3 text-xs sm:text-sm text-[#cabfe0]">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white font-black text-xs">
                  1
                </span>
                <span>
                  Open your email inbox for <strong className="text-white">{email || "your email"}</strong> (also check <strong className="text-amber-300">Spam / Junk / Promotions</strong>).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white font-black text-xs">
                  2
                </span>
                <span>
                  Open the email from <strong className="text-white">KR8 Digitals</strong> and click the large <strong className="text-pink-300">"Confirm My Email & Complete Registration"</strong> button.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-black font-black text-xs">
                  3
                </span>
                <span>
                  On the next page, click the green button to join your <strong className="text-emerald-300">{skillName} WhatsApp Learning Group</strong> and access your profile!
                </span>
              </li>
            </ol>
          </div>

          {resentMsg && (
            <div className="mt-5 rounded-xl border border-pink-500/30 bg-pink-500/15 p-3.5 text-xs font-semibold text-pink-200">
              {resentMsg}
            </div>
          )}

          {/* Resend & Navigation Actions */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {email && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="rounded-full border border-pink-400/50 bg-pink-500/15 px-6 py-3 text-xs sm:text-sm font-bold text-pink-200 hover:bg-pink-500/25 disabled:opacity-50 transition-all cursor-pointer"
              >
                {resending
                  ? "Sending Confirmation Email..."
                  : cooldown > 0
                  ? `Resend Available in ${cooldown}s`
                  : "Didn't get the email? Resend Confirmation Email ↻"}
              </button>
            )}
            <Link
              to="/signin"
              className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-xs sm:text-sm font-bold text-white hover:bg-white/10 transition-all"
            >
              Already Confirmed? Sign In →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
