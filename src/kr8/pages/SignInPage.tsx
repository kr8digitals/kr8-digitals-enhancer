// Production SignIn - Yesterday's rich design restored + Supabase functional + founder unlocked
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSeo } from "../lib/useSeo";
import { Link, useNavigate, useSearchParams } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { Card, GradientButton, GhostButton, Pill } from "../components/ui";
import Icon from "../components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { signInWithKr8Id, requestPasswordResetSecure } from "@/lib/auth.functions";

export default function SignInPage() {
  useSeo({ path: "/signin", noindex: true });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signOut, addNotification } = useAuth();
  const signInByIdentifier = useServerFn(signInWithKr8Id);
  const requestPasswordReset = useServerFn(requestPasswordResetSecure);

  const [mode, setMode] = useState<"credentials" | "google" | "reset">("credentials");
  const [identifier, setIdentifier] = useState(searchParams.get("id") || searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null);
  const [resetTarget, setResetTarget] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [whatsappReminder, setWhatsappReminder] = useState<any>(null);

  const inputCls = "w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none";

  useEffect(() => {
    const registered = searchParams.get("registered");
    if (registered) {
      setStatusMsg({ type: "success", text: "Account created! Check your email to confirm — check spam too. After confirming, sign in here." });
    }
  }, []);

  const checkWhatsappReminder = async (userId: string) => {
    try {
      const { data: prof } = await supabase.from('profiles').select('whatsapp_joined,onboarding_skipped,skill,name,kr8_id').eq('id', userId).maybeSingle();
      if (prof && !prof.whatsapp_joined) {
        const { data: skillRow } = await supabase.from('skill_settings').select('whatsapp_url,name').eq('skill_key', prof.skill || '').maybeSingle();
        if (skillRow?.whatsapp_url) {
          setWhatsappReminder({ profile: prof, whatsappUrl: skillRow.whatsapp_url, skillName: skillRow.name });
        }
      }
    } catch {}
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!identifier.trim()) { setStatusMsg({ type: "error", text: "Please enter your registered Email address or KR8 ID." }); return; }
    if (!password) { setStatusMsg({ type: "error", text: "Please enter your account password." }); return; }

    setLoading(true);
    try {
      const authResult = await signInByIdentifier({
        data: { identifier: identifier.trim(), password },
      });
      if (!authResult.session?.access_token || !authResult.session.refresh_token) {
        throw new Error("Invalid KR8 ID or password");
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: authResult.session.access_token,
        refresh_token: authResult.session.refresh_token,
      });
      if (error) throw error;
      if (data.user) {
        try { await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id); } catch {}
        addNotification(`Welcome back!`);
        const { data: prof } = await supabase.from('profiles').select('whatsapp_joined').eq('id', data.user.id).maybeSingle();
        if (prof && !prof.whatsapp_joined) {
          await checkWhatsappReminder(data.user.id);
          setStatusMsg({ type: "info", text: "You skipped WhatsApp group join last time — please join now to get live class links!" });
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      const msg = err.message || "Sign in failed";
      if (msg.toLowerCase().includes('email not confirmed')) {
        setStatusMsg({ type: "error", text: "Your email is not confirmed yet. Please check your inbox (and spam) for confirmation email and click the button. Then sign in again." });
      } else {
        setStatusMsg({ type: "error", text: msg.includes('Invalid login') ? "The email/ID or password is incorrect. Founder? Use your registered email and password, or reset password." : msg });
      }
    } finally { setLoading(false); }
  };

  const handleGoogleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/confirmed` } });
      if (error) throw error;
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Google sign-in failed" });
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = resetTarget.trim() || identifier.trim();
    if (!target) { setStatusMsg({ type: "error", text: "Please enter the email address registered to your KR8 account." }); return; }
    if (!target.includes("@")) {
      setStatusMsg({ type: "error", text: "For account security, password resets must use your registered email address." });
      return;
    }
    try {
      const result = await requestPasswordReset({ data: { email: target } });
      setStatusMsg({ type: "success", text: result.message || "If the account is eligible, a reset email will be sent. Check inbox and spam." });
      setDemoCode("sent");
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Reset failed" });
    }
  };

  return (
    <div className="section-bg min-h-[85vh] py-12 sm:py-16 px-5">
      <div className="mx-auto max-w-lg">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500/25 via-purple-500/15 to-transparent p-2 border border-pink-500/40 shadow-2xl shadow-pink-500/30">
              <img src="/branding/kr8_logo.png" alt="KR8 Digitals Logo" className="h-full w-full object-contain filter drop-shadow" />
            </div>
          </div>
          <Pill>Member Portal · Yesterday's Design Restored</Pill>
          <h1 className="font-display mt-4 text-3xl sm:text-4xl font-bold text-white">
            Sign In to <span className="text-gradient">KR8 Platform</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#cabfe0]">Sign in with your Email, KR8 ID, or Google. Secure Supabase Auth — works on any device.</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-[#a594c7]">
            <span>Need an account?</span>
            <Link to="/register" className="font-bold text-pink-400 hover:text-pink-300 underline">Register Free here →</Link>
          </div>
        </div>

        {user && (
          <div className="mb-6 rounded-2xl border border-pink-500/40 bg-pink-500/10 p-4 text-center">
            <p className="text-xs sm:text-sm text-pink-200">You are currently signed in as <span className="font-bold text-white">{user.name}</span>.</p>
            <div className="mt-3 flex justify-center gap-2.5">
              <GradientButton to="/dashboard" className="text-xs px-4 py-2">Open Dashboard →</GradientButton>
              <GhostButton onClick={signOut} className="text-xs px-4 py-2 border-white/20">Sign Out</GhostButton>
            </div>
          </div>
        )}

        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex rounded-xl border border-white/10 bg-black/30 p-1 text-xs">
            <button type="button" onClick={() => { setMode("credentials"); setStatusMsg(null); }} className={`flex-1 rounded-lg py-2 font-bold ${mode === "credentials" ? "bg-gradient-pink text-white shadow" : "text-[#b8aecf] hover:text-white"}`}>Email / ID 🔑</button>
            <button type="button" onClick={() => { setMode("google"); setStatusMsg(null); }} className={`flex-1 rounded-lg py-2 font-bold ${mode === "google" ? "bg-gradient-pink text-white shadow" : "text-[#b8aecf] hover:text-white"}`}>Google 🌐</button>
            <button type="button" onClick={() => { setMode("reset"); setStatusMsg(null); }} className={`flex-1 rounded-lg py-2 font-bold ${mode === "reset" ? "bg-gradient-pink text-white shadow" : "text-[#b8aecf] hover:text-white"}`}>Lost Password 🔄</button>
          </div>

          {statusMsg && (
            <div className={`mb-5 rounded-xl p-3.5 text-xs font-semibold ${statusMsg.type === "error" ? "border border-red-500/40 bg-red-500/15 text-red-200" : statusMsg.type === "success" ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : "border border-blue-500/40 bg-blue-500/15 text-blue-200"}`}>
              {statusMsg.text}
            </div>
          )}

          {whatsappReminder && (
            <div className="mb-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-sm font-bold text-white">⚠️ You skipped WhatsApp group join!</p>
              <p className="text-xs text-emerald-200 mt-1">Join {whatsappReminder.skillName} group now to get live class links Mon/Wed/Fri 9PM-12AM WAT</p>
              <div className="mt-3 flex gap-2">
                <a href={whatsappReminder.whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white">Join WhatsApp Group →</a>
                <button onClick={() => { setWhatsappReminder(null); navigate('/dashboard'); }} className="rounded-full border border-white/15 px-4 py-2 text-xs text-white">Skip & Go to Dashboard</button>
              </div>
            </div>
          )}

          {mode === "credentials" && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Email or KR8 ID *</label>
                <input type="text" required placeholder="e.g. name@example.com or KR82026KT0001GDVFD" className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none" value={identifier} onChange={e => setIdentifier(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#cabfe0]">Password *</label>
                  <button type="button" onClick={() => { setMode("reset"); setResetTarget(identifier); }} className="text-xs text-pink-400 hover:text-pink-300 underline">Forgot Password?</button>
                </div>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required placeholder="••••••••" className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none pr-12" value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3 text-xs text-[#8a7ba8] hover:text-white">{showPassword ? "Hide" : "Show"}</button>
                </div>
              </div>
              <div className="pt-2">
                <GradientButton type="submit" disabled={loading} className="w-full py-3.5 shadow-xl shadow-pink-500/25 text-sm font-bold disabled:opacity-50">
                  {loading ? "Authenticating..." : "Sign In to KR8 →"}
                </GradientButton>
              </div>
              <p className="text-[11px] text-center text-[#6a5b82]">Founder locked out? Use your registered email (not phone) + password. Or click Forgot Password to reset. Ensure email confirmed.</p>
            </form>
          )}

          {mode === "google" && (
            <form onSubmit={handleGoogleSignIn} className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow">
                  <svg className="h-6 w-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                </div>
                <h3 className="text-base font-bold text-white">Google Account Sign-In</h3>
                <p className="mt-1 text-xs text-[#cabfe0]">Secure OAuth via Supabase — redirects to confirmation page.</p>
              </div>
              <GradientButton type="submit" className="w-full py-3.5 shadow-xl shadow-pink-500/25 text-sm font-bold">Continue with Google →</GradientButton>
            </form>
          )}

          {mode === "reset" && (
            <div className="space-y-4">
              <form onSubmit={handleRequestReset} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Registered Email *</label>
                  <input type="email" required placeholder="name@example.com" className="w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none" value={resetTarget} onChange={e => setResetTarget(e.target.value)} />
                </div>
                <GradientButton type="submit" className="w-full py-3 text-xs font-bold">Request Reset Email 📩</GradientButton>
              </form>
              {demoCode && (
                <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Reset email sent — check inbox</p>
                    <p className="text-[10px] text-emerald-300">Click link in email to set new password. Link goes to /reset-password page.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
