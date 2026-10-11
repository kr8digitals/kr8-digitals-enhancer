import { useEffect, useState } from "react";
import { Link, useSearchParams } from "../router-shim";
import { useSeo } from "../lib/useSeo";
import { Pill, GradientButton } from "../components/ui";
import { supabase } from "@/integrations/supabase/client";

export default function CheckEmailPage() {
  useSeo({ title: "Check Your Email — KR8 Digitals", description: "Confirm your email to complete registration", path: "/register/check-email" });
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const name = searchParams.get("name") || "Future Creator";
  const skill = searchParams.get("skill") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` } });
      if (!error) setResent(true);
    } catch {}
    setResending(false);
  };

  return (
    <div className="section-bg min-h-[90vh] flex items-center justify-center px-5 py-16">
      <div className="mx-auto max-w-2xl w-full text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500/30 via-purple-500/20 to-transparent border border-pink-500/40 shadow-2xl shadow-pink-500/30 animate-pulse">
          <span className="text-4xl">🎉</span>
        </div>
        <Pill>Congratulations — You Took The First Step!</Pill>
        <h1 className="font-display mt-6 text-4xl sm:text-5xl font-black text-white leading-tight">
          You're Almost In, <span className="text-gradient">{name.split(' ')[0]}!</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[#cabfe0] leading-relaxed">
          You just did what 90% of people never do — you started. Your KR8 account for <strong className="text-white">{skill || 'your chosen skill'}</strong> is created and waiting.
        </p>

        <div className="mt-8 rounded-3xl border-2 border-pink-500/50 bg-gradient-to-br from-pink-950/40 via-[#1a0030] to-purple-950/40 p-6 sm:p-8 text-left shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30 text-2xl">📧</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">BOLD STEP: Confirm Your Email NOW</h3>
              <p className="mt-2 text-sm text-[#cabfe0] leading-relaxed">
                We sent a confirmation email to <strong className="text-white font-mono bg-white/10 px-2 py-0.5 rounded">{email || 'your email'}</strong>.
                <span className="block mt-2 text-pink-300 font-bold">Most people who registered today didn't confirm because they didn't see this. Don't be that person.</span>
              </p>
              <div className="mt-4 rounded-2xl bg-black/40 border border-white/10 p-4">
                <p className="text-xs font-bold text-white uppercase tracking-wider">What to do now:</p>
                <ol className="mt-2 space-y-2 text-xs sm:text-sm text-[#b8aecf] list-decimal list-inside">
                  <li>Open your inbox (and <strong className="text-white">Spam / Promotions</strong> folder)</li>
                  <li>Look for email from <strong className="text-white">KR8 Digitals — Confirm Your Account</strong></li>
                  <li>Click the big <strong className="text-pink-400">Confirm My Account →</strong> button inside</li>
                  <li>You'll be celebrated and taken to join your WhatsApp learning group</li>
                </ol>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={handleResend} disabled={resending} className="rounded-full bg-white/10 border border-white/15 px-5 py-2.5 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-50">
                  {resending ? "Sending..." : resent ? "✓ Email Resent!" : "Resend Confirmation Email"}
                </button>
                <a href={`https://mail.google.com/search/from:kr8`} target="_blank" rel="noreferrer" className="rounded-full bg-gradient-pink px-5 py-2.5 text-xs font-bold text-white shadow-lg">Open Gmail →</a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-[#8a7ba8]">
          <p><strong className="text-white">What you're signing up for:</strong> 100% tuition-free 8-week intensive cohort, live feedback daily Mon/Wed/Fri 9PM-12AM WAT, assignments Tue/Thu/Sat, verifiable KR8 ID + QR certificate, agency pipeline, lifetime tribe community. Zero tuition forever.</p>
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <Link to="/signin" className="text-xs text-[#8a7ba8] hover:text-white underline">Already confirmed? Sign in →</Link>
          <span className="text-[#3a2d52]">•</span>
          <Link to="/" className="text-xs text-[#8a7ba8] hover:text-white underline">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
