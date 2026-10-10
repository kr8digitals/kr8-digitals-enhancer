// Production Sign-In Page - KR8 ID server fn, Google, WebAuthn, reset limit
import { useState, useEffect } from "react";
import { useSeo } from "../lib/useSeo";
import { Link, useNavigate, useSearchParams } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { Card, GradientButton, GhostButton, Pill } from "../components/ui";
import { useServerFn } from "@tanstack/react-start";
import { signInWithKr8Id, requestPasswordResetSecure } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";

export default function SignInPage() {
  useSeo({ path: "/signin", noindex: true });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<"credentials" | "reset" | "magic" | "webauthn">("credentials");
  const [identifier, setIdentifier] = useState(searchParams.get("email") || ""); // KR8 ID or email
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  const signInKr8Fn = useServerFn(signInWithKr8Id);
  const resetSecureFn = useServerFn(requestPasswordResetSecure);

  const inputCls = "w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none";

  useEffect(() => {
    if (searchParams.get("registered")) {
      setStatusMsg({ type: "success", text: "Account created! Please check your email to verify, then sign in. Your KR8 ID works on any device." });
    }
    if (searchParams.get("reset")) {
      setStatusMsg({ type: "info", text: "Password reset email sent. Check your inbox." });
    }
  }, [searchParams]);

  const handleKr8SignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const cleanId = identifier.trim();
    if (!cleanId) {
      setStatusMsg({ type: "error", text: "Please enter your KR8 ID or email." });
      return;
    }
    if (!password) {
      setStatusMsg({ type: "error", text: "Please enter your password." });
      return;
    }
    setLoading(true);
    try {
      const result = await signInKr8Fn({ data: { identifier: cleanId, password } });
      if ((result as any)?.session) {
        const session = (result as any).session;
        // Set session in supabase client
        const { error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
        if (error) throw error;
        setStatusMsg({ type: "success", text: `Welcome back! Redirecting to dashboard...` });
        setTimeout(() => navigate("/dashboard"), 800);
      } else {
        setStatusMsg({ type: "error", text: "Invalid KR8 ID or password" });
      }
    } catch (err: any) {
      // Generic error, never reveal email
      const msg = err.message || "Invalid KR8 ID or password";
      if (msg.includes("PASSWORD_RESET_LIMIT")) {
        // handled in reset
        setStatusMsg({ type: "error", text: msg });
      } else {
        setStatusMsg({ type: "error", text: "Invalid KR8 ID or password" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setStatusMsg({ type: "error", text: "Please enter a valid email" });
      return;
    }
    setLoading(true);
    try {
      const result = await resetSecureFn({ data: { email: cleanEmail } });
      if ((result as any)?.ok) {
        setStatusMsg({ type: "success", text: `Password reset email sent to ${cleanEmail}. Check inbox. You can only reset once every 60 days.` });
        setMode("credentials");
      }
    } catch (err: any) {
      const msg = err.message || "Reset failed";
      if (msg.startsWith("PASSWORD_RESET_LIMIT")) {
        // Parse friendly date
        const parts = msg.split("Next allowed:");
        const nextDate = parts[1] ? parts[1].trim() : "in 60 days";
        setStatusMsg({ type: "error", text: `Password reset is limited to once every 60 days. Next allowed: ${nextDate}.` });
      } else {
        setStatusMsg({ type: "error", text: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setStatusMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Google sign-in failed" });
      setGoogleLoading(false);
    }
  };

  const handleResendConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToResend = (resendEmail || identifier || resetEmail).trim().toLowerCase();
    if (!emailToResend || !emailToResend.includes("@")) {
      setStatusMsg({ type: "error", text: "Please enter a valid email to resend confirmation." });
      return;
    }
    setResendLoading(true);
    setStatusMsg(null);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: emailToResend, options: { emailRedirectTo: `${window.location.origin}/signin` } });
      if (error) throw error;
      setStatusMsg({ type: "success", text: `Confirmation email resent to ${emailToResend}. Check your email to confirm - including spam folder.` });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to resend confirmation email" });
    } finally {
      setResendLoading(false);
    }
  };

  const handleWebAuthnSignIn = async () => {
    setStatusMsg(null);
    setLoading(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const { data: challengeData, error: challengeError } = await supabase.functions.invoke('webauthn-auth-options', {
        body: { identifier: identifier.trim() || undefined }
      });
      if (challengeError || !challengeData) {
        throw new Error("WebAuthn not configured. Please use KR8 ID or Google.");
      }
      const authResp = await startAuthentication(challengeData);
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('webauthn-auth-verify', {
        body: authResp
      });
      if (verifyError) throw verifyError;
      if ((verifyData as any)?.session) {
        await supabase.auth.setSession({ access_token: (verifyData as any).session.access_token, refresh_token: (verifyData as any).session.refresh_token });
        navigate("/dashboard");
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Biometric sign-in failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-bg min-h-[85vh] py-12 sm:py-16 px-5">
      <div className="mx-auto max-w-md">
        <div className="text-center mb-8">
          <Pill>Secure Sign-In - Any Device</Pill>
          <h1 className="font-display mt-4 text-3xl font-bold text-white whitespace-nowrap">Welcome <span className="text-gradient">Back</span></h1>
          <p className="mt-3 text-sm text-[#cabfe0]">Sign in with KR8 ID or email + password. Works on phone, laptop, private window.</p>
        </div>

        {user && (
          <Card className="mb-6 p-4 text-center border border-emerald-500/30 bg-emerald-500/10">
            <p className="text-xs text-emerald-200">Signed in as <span className="font-bold text-white">{user.name}</span> ({user.kr8_id})</p>
            <div className="mt-3 flex gap-2 justify-center">
              <Link to="/dashboard" className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white">Dashboard →</Link>
              <button onClick={() => signOut()} className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-white">Sign Out</button>
            </div>
          </Card>
        )}

        <Card className="p-6 sm:p-8">
          <div className="flex rounded-full bg-black/30 p-1 mb-6 border border-white/10">
            <button onClick={() => setMode("credentials")} className={`flex-1 rounded-full py-2 text-xs font-bold transition ${mode === "credentials" ? "bg-gradient-pink text-white" : "text-[#8a7ba8]"}`}>KR8 ID</button>
            <button onClick={() => setMode("webauthn")} className={`flex-1 rounded-full py-2 text-xs font-bold transition ${mode === "webauthn" ? "bg-gradient-pink text-white" : "text-[#8a7ba8]"}`}>Biometrics</button>
            <button onClick={() => setMode("reset")} className={`flex-1 rounded-full py-2 text-xs font-bold transition ${mode === "reset" ? "bg-gradient-pink text-white" : "text-[#8a7ba8]"}`}>Reset</button>
          </div>

          {statusMsg && (
            <div className={`mb-4 rounded-xl p-3 text-xs font-semibold ${statusMsg.type === "success" ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : statusMsg.type === "info" ? "border border-blue-500/40 bg-blue-500/15 text-blue-200" : "border border-red-500/40 bg-red-500/15 text-red-200"}`}>
              {statusMsg.type === "success" ? "✓ " : statusMsg.type === "info" ? "ℹ " : "✕ "}{statusMsg.text}
            </div>
          )}

          {mode === "credentials" && (
            <form onSubmit={handleKr8SignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">KR8 ID or Email *</label>
                <input type="text" required placeholder="e.g. KR82026JC0024GDVFD or your@email.com" className={inputCls} value={identifier} onChange={e => setIdentifier(e.target.value)} />
                <p className="mt-1 text-[11px] text-[#8a7ba8]">Server resolves email from KR8 ID, never reveals email. Rate limit 5/min.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Password *</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required placeholder="Your password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8a7ba8]">{showPassword ? "Hide" : "Show"}</button>
                </div>
              </div>
              <GradientButton type="submit" disabled={loading || authLoading} className="w-full py-3.5 text-sm font-bold disabled:opacity-50">
                {loading ? "Signing in securely..." : "Sign In with KR8 ID →"}
              </GradientButton>

              <div className="relative my-4 flex items-center">
                <div className="flex-1 border-t border-white/10"></div>
                <span className="px-3 text-[11px] text-[#8a7ba8]">or</span>
                <div className="flex-1 border-t border-white/10"></div>
              </div>

              <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading} className="w-full rounded-xl border border-white/15 bg-white text-black py-3 text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-100 disabled:opacity-50">
                <span>G</span> Continue with Google
              </button>
            </form>
          )}

          {mode === "webauthn" && (
            <div className="space-y-4">
              <p className="text-xs text-[#8a7ba8]">Use your device biometrics (Face ID, Touch ID, fingerprint) or security key. Add passkeys in Profile → Security.</p>
              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">KR8 ID (optional for discovery)</label>
                <input type="text" placeholder="KR8 ID or leave blank" className={inputCls} value={identifier} onChange={e => setIdentifier(e.target.value)} />
              </div>
              <GradientButton onClick={handleWebAuthnSignIn} disabled={loading} className="w-full py-3.5 text-sm font-bold disabled:opacity-50">
                {loading ? "Authenticating..." : "Sign In with Biometrics →"}
              </GradientButton>
              <GhostButton onClick={() => setMode("credentials")} className="w-full text-xs">Back to KR8 ID</GhostButton>
            </div>
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Email for Reset *</label>
                <input type="email" required placeholder="your@email.com" className={inputCls} value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
                <p className="mt-1 text-[11px] text-amber-300">⚠ Password reset only once every 60 days. Next allowed date shown if limited.</p>
              </div>
              <GradientButton type="submit" disabled={loading} className="w-full py-3.5 text-sm font-bold disabled:opacity-50">
                {loading ? "Checking limit..." : "Send Reset Email →"}
              </GradientButton>
              <GhostButton onClick={() => setMode("credentials")} className="w-full text-xs">Back to Sign In</GhostButton>
            </form>
          )}

          {/* Resend Confirmation Email */}
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold text-[#cabfe0] mb-2">Didn't get confirmation email?</p>
            <form onSubmit={handleResendConfirmation} className="flex gap-2">
              <input type="email" placeholder="your@email.com" className={`${inputCls} flex-1`} value={resendEmail} onChange={e => setResendEmail(e.target.value)} />
              <button type="submit" disabled={resendLoading} className="rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50">{resendLoading ? "Sending..." : "Resend Confirmation Email"}</button>
            </form>
            <p className="mt-1 text-[11px] text-[#8a7ba8]">Check your email to confirm - including spam folder. Works on any device after confirmation.</p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#8a7ba8]">New student? <Link to="/register" className="font-bold text-pink-400 underline">Register here</Link></p>
            <p className="mt-2 text-[11px] text-[#8a7ba8] leading-relaxed">Security: KR8 ID server resolves email, generic error, rate limit 5/min. Founder role only after email verification.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
