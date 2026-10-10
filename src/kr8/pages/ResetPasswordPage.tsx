// Reset Password Page - works on any device, for claimed accounts and password reset flow
import { useState, useEffect } from "react";
import { useSeo } from "../lib/useSeo";
import { Link, useNavigate, useSearchParams } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { Card, GradientButton, Pill } from "../components/ui";

export default function ResetPasswordPage() {
  useSeo({ title: "Reset Password | KR8 Digitals", description: "Set new password for your KR8 account. Works on any device." });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updatePassword, session } = useAuth();

  const claim = searchParams.get('claim') === 'true';
  const kr8_id = searchParams.get('kr8_id');

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Supabase sets session from URL hash after clicking recovery link
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token') || hash.includes('type=recovery'))) {
      setHasSession(true);
    }
    // Also check current session
    if (session) setHasSession(true);

    // Poll for session after hash parsing
    const t = setTimeout(() => {
      // @ts-ignore
      const supabaseSession = (window as any).__supabase_session || session;
      if (supabaseSession) setHasSession(true);
    }, 1000);
    return () => clearTimeout(t);
  }, [session]);

  const inputCls = "w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (password.length < 6) {
      setMsg({ ok: false, text: "Password must be at least 6 characters" });
      return;
    }
    if (password !== confirm) {
      setMsg({ ok: false, text: "Passwords do not match" });
      return;
    }

    setLoading(true);
    try {
      const res = await updatePassword(password);
      if (res.ok) {
        setMsg({ ok: true, text: res.message || "Password updated! You can now sign in on any device." });
        setTimeout(() => navigate('/signin'), 2000);
      } else {
        setMsg({ ok: false, text: res.error || "Failed to update password" });
      }
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || "Update failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-bg min-h-[85vh] py-12 sm:py-16 px-5">
      <div className="mx-auto max-w-md">
        <div className="text-center mb-8">
          <Pill>{claim ? `Claim ${kr8_id || 'Account'}` : "Reset Password"}</Pill>
          <h1 className="font-display mt-4 text-3xl font-bold text-white">
            {claim ? <>Set Password for <span className="text-gradient">{kr8_id}</span></> : "Set New Password"}
          </h1>
          <p className="mt-3 text-sm text-[#cabfe0]">
            {claim
              ? `Your KR8 ID ${kr8_id || ''} is preserved. Set a secure password to complete claiming. Then sign in anywhere - phone, laptop, any device.`
              : "Enter your new password. This will work on any device after."}
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          {!hasSession && !session && (
            <div className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
              Waiting for recovery session... Please make sure you clicked the link from your email. If you opened this page directly, request a new reset link from Sign In.
            </div>
          )}

          {msg && (
            <div className={`mb-6 rounded-xl p-3 text-xs font-semibold ${msg.ok ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : "border border-red-500/40 bg-red-500/15 text-red-200"}`}>
              {msg.ok ? "✓ " : "✕ "}{msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">New Password *</label>
              <input
                type="password"
                required
                placeholder="At least 6 characters, secure"
                className={inputCls}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Confirm Password *</label>
              <input
                type="password"
                required
                placeholder="Repeat new password"
                className={inputCls}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
            </div>

            <GradientButton type="submit" disabled={loading} className="w-full py-3.5 text-sm font-bold disabled:opacity-50">
              {loading ? "Updating securely..." : claim ? `Set Password & Keep ${kr8_id || 'KR8 ID'} →` : "Update Password →"}
            </GradientButton>
          </form>

          <div className="mt-6 text-center">
            <Link to="/signin" className="text-xs text-pink-400 underline hover:text-pink-300">Back to Sign In</Link>
          </div>

          {claim && (
            <div className="mt-6 rounded-xl bg-purple-500/10 border border-purple-500/30 p-3">
              <p className="text-[11px] text-[#cabfe0] leading-relaxed">
                <strong className="text-white">Claim flow:</strong> This password is hashed by Supabase Auth (bcrypt). It replaces old plain-text password. Your KR8 ID, points, graduation, certificates stay. You can now sign in on any device with email + this new password.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
