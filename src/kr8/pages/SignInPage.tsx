import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import {
  submitSuspensionAppeal,
  getSuspendedAccounts,
  normalizeSkillWhatsAppUrl,
  getSkillName,
  type SuspendedAccountRecord,
} from "../data/store";
import {
  getRegisteredBiometrics,
  authenticateWithBiometrics,
} from "../utils/biometrics";
import { Pill, Card, GradientButton } from "../components/ui";
import { useSeo } from "../lib/useSeo";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import * as authFns from "@/lib/auth.functions";

export default function SignInPage() {
  useSeo({
    title: "Sign In — KR8 Digitals Account Portal",
    description:
      "Sign in to your KR8 Digitals Student, Tribe, or Executive account using your Email, KR8 ID, Phone Number, or linked Google account.",
    path: "/signin",
  });

  const nav = useNavigate();
  const location = useLocation();
  const {
    student: currentAccount,
    signIn,
    signInWithGoogle,
    whatsappReminderPending,
    markWhatsAppOnboarding,
    dismissWhatsappReminderForSession,
  } = useAuth();
  const resetReqFn = useServerFn(authFns.requestPasswordResetSecure);

  const [mode, setMode] = useState<"credentials" | "google" | "forgot">("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Unconfirmed email state
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendingConfirm, setResendingConfirm] = useState(false);
  const [resendConfirmSuccess, setResendConfirmSuccess] = useState("");

  // Biometric state
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);

  const isBiometricSupported = () =>
    typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
  const hasPasskeyRegistered = () => getRegisteredBiometrics().length > 0;
  const getPasskeyUserId = () => getRegisteredBiometrics()[0]?.studentId || null;

  useEffect(() => {
    setCanUseBiometrics(isBiometricSupported() && hasPasskeyRegistered());
  }, []);

  // Forgot password state
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetSentMsg, setResetSentMsg] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  // Suspension & Appeal state
  const [suspendedAccount, setSuspendedAccount] = useState<SuspendedAccountRecord | null>(null);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealMessage, setAppealMessage] = useState("");
  const [appealFeedback, setAppealFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // WhatsApp onboarding reminder modal
  const [showWaModal, setShowWaModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("remind_whatsapp") === "1") {
      setShowWaModal(true);
    }
  }, [location.search]);

  if (currentAccount && !showWaModal && !whatsappReminderPending) {
    return (
      <div className="section-bg min-h-[80vh] py-16 px-4">
        <div className="mx-auto max-w-xl text-center">
          <Card className="p-8 sm:p-10 border-pink-500/30">
            <Pill>Signed In</Pill>
            <h1 className="font-display mt-4 text-2xl sm:text-3xl font-bold text-white">
              Welcome back, {currentAccount.name}
            </h1>
            <p className="mt-2 text-sm text-[#b8aecf]">
              KR8 ID: <span className="font-mono text-pink-300 font-bold">{currentAccount.id}</span>
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {currentAccount.isFounder || currentAccount.isCoFounder || currentAccount.isAdmin ? (
                <GradientButton to="/admin">Open Admin Dashboard →</GradientButton>
              ) : null}
              <GradientButton to="/dashboard">Open Dashboard →</GradientButton>
              <Link
                to="/academy"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-xs sm:text-sm font-bold text-white hover:bg-white/10"
              >
                Open Academy Profile
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Show WhatsApp reminder modal if user skipped onboarding previously
  if (currentAccount && (showWaModal || whatsappReminderPending)) {
    const waUrl = normalizeSkillWhatsAppUrl(currentAccount.skill || "graphic");
    const sName = getSkillName(currentAccount.skill || "graphic");
    return (
      <div className="section-bg min-h-screen py-16 px-4 flex items-center justify-center">
        <div className="mx-auto max-w-xl w-full">
          <Card className="p-6 sm:p-10 text-center border-2 border-[#25D366] shadow-2xl shadow-[#25D366]/20">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#25D366] text-3xl text-black shadow-lg">
              📲
            </div>
            <Pill className="border-emerald-400/40 bg-emerald-500/10 text-emerald-300">
              Onboarding Reminder
            </Pill>
            <h1 className="font-display mt-3 text-2xl sm:text-4xl font-black text-white">
              Don't Forget to Join Your <span className="text-gradient">{sName}</span> WhatsApp Group!
            </h1>
            <p className="mt-3 text-sm text-[#cabfe0] leading-relaxed">
              Welcome back, <strong className="text-white">{currentAccount.name}</strong>! You skipped joining your WhatsApp learning group earlier. All live class links (<strong className="text-white">Mon/Wed/Fri 9PM–12AM WAT</strong>) and practical assignments (<strong className="text-white">Tue/Thu/Sat</strong>) happen inside this group.
            </p>

            <div className="mt-6">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-full bg-[#25D366] hover:bg-[#20bd5a] px-8 py-4 text-sm sm:text-base font-black text-black shadow-xl shadow-[#25D366]/30 transition-all hover:scale-105"
              >
                <span>💬 Join {sName} WhatsApp Group Now →</span>
              </a>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={async () => {
                  await markWhatsAppOnboarding(true, false);
                  setShowWaModal(false);
                  nav(currentAccount.isFounder || currentAccount.isAdmin ? "/admin" : "/dashboard");
                }}
                className="rounded-full bg-gradient-pink px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-lg cursor-pointer"
              >
                ✓ I've Joined — Done! Go to My Profile →
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissWhatsappReminderForSession();
                  setShowWaModal(false);
                  nav(currentAccount.isFounder || currentAccount.isAdmin ? "/admin" : "/dashboard");
                }}
                className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-xs sm:text-sm font-semibold text-[#b8aecf] hover:text-white cursor-pointer"
              >
                Remind Me Next Time
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const handleBiometricSignIn = async () => {
    setError("");
    setBiometricLoading(true);
    try {
      const res = await authenticateWithBiometrics();
      if (!res.ok) {
        setError(res.error || "Biometric authentication cancelled.");
        setBiometricLoading(false);
        return;
      }
      const userId = res.studentId || getPasskeyUserId();
      if (!userId) {
        setError("No KR8 profile linked to this passkey. Sign in with password first.");
        setBiometricLoading(false);
        return;
      }
      setIdentifier(userId);
      setError("Passkey verified! Please enter your password to complete secure session sign-in.");
    } catch {
      setError("Biometric verification failed.");
    }
    setBiometricLoading(false);
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setUnconfirmedEmail(null);
    setResendConfirmSuccess("");
    setSuspendedAccount(null);
    setSubmitting(true);

    try {
      const result = await signIn(identifier, password);
      if (!result.ok) {
        if (result.code === "EMAIL_NOT_CONFIRMED") {
          setUnconfirmedEmail(result.email || (identifier.includes("@") ? identifier.trim() : null));
        }
        // Check local suspended record if any
        const suspList = getSuspendedAccounts();
        const clean = identifier.trim().toLowerCase();
        const foundSusp = suspList.find(
          (s) =>
            s.id.toLowerCase() === clean ||
            s.email.toLowerCase() === clean ||
            s.phone.replace(/[^0-9]/g, "") === clean.replace(/[^0-9]/g, "")
        );
        if (foundSusp) {
          setSuspendedAccount(foundSusp);
        }
        setError(result.error || "Sign in failed.");
        setSubmitting(false);
        return;
      }

      if (result.needsWhatsappReminder) {
        setShowWaModal(true);
        setSubmitting(false);
        return;
      }

      nav("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    const emailToSend = unconfirmedEmail || (identifier.includes("@") ? identifier.trim() : "");
    if (!emailToSend) return;
    setResendingConfirm(true);
    setResendConfirmSuccess("");
    try {
      const siteOrigin = typeof window !== "undefined" ? window.location.origin : "https://www.kr8digitals.com";
      await supabase.auth.resend({
        type: "signup",
        email: emailToSend,
        options: {
          emailRedirectTo: `${siteOrigin}/auth/confirmed`,
        },
      });
      try {
        const { sendRegistrationConfirmationEmail } = await import("@/lib/welcome.functions");
        await sendRegistrationConfirmationEmail({
          data: {
            email: emailToSend,
            name: "Scholar",
            siteOrigin,
          },
        });
      } catch {}
      setResendConfirmSuccess(
        `✅ Confirmation email resent to ${emailToSend}! Open your inbox (or Spam/Promotions) and click the large Confirm button.`
      );
    } catch (e: any) {
      setResendConfirmSuccess(`⚠️ ${e?.message || "Could not resend confirmation email."}`);
    } finally {
      setResendingConfirm(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setError("");
    const res = await signInWithGoogle();
    if (!res.ok) {
      setError(res.error || "Google sign-in failed.");
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetSentMsg("");
    const cleanEmail = resetIdentifier.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      setError("Please enter your registered email address to receive a password reset link.");
      return;
    }
    setResetBusy(true);
    try {
      const res: any = await resetReqFn({ data: { email: cleanEmail } });
      if (!res.ok) {
        setError(res.message || "Password reset rate limited.");
      } else {
        setResetSentMsg(
          res.message ||
            "If an account exists for that email, a password reset link has been sent. Please check your inbox."
        );
      }
    } catch (err: any) {
      setError(err?.message || "Failed to request password reset.");
    } finally {
      setResetBusy(false);
    }
  };

  const handleAppealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendedAccount) return;
    const res = submitSuspensionAppeal(suspendedAccount.id, appealMessage);
    setAppealFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setAppealMessage("");
    }
  };

  const inputCls =
    "w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder-[#7a6b94] focus:border-pink-400/60 focus:outline-none transition-colors";

  return (
    <div className="section-bg min-h-screen py-12 sm:py-16 px-4">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-pink shadow-lg shadow-pink-500/30">
            <img src="/branding/kr8_logo.png" alt="KR8 Digitals" className="h-9 w-9 object-contain" />
          </div>
          <Pill>Secure Access Portal</Pill>
          <h1 className="font-display mt-3 text-3xl sm:text-4xl font-bold text-white">
            Sign In to <span className="text-gradient">KR8 Digitals</span>
          </h1>
          <p className="mt-2 text-sm text-[#b8aecf]">
            Access your Student Dashboard, Tribe network, or Executive Portal.
          </p>
          <p className="mt-2 text-xs text-[#8a7ba8]">
            Don't have an account yet?{" "}
            <Link
              to="/register"
              className="font-bold text-pink-400 hover:text-pink-300 underline underline-offset-4"
            >
              Create a Free Account →
            </Link>
          </p>
        </div>

        <Card className="mt-8 p-6 sm:p-8 border-pink-500/25 shadow-2xl">
          {/* Sign-In Mode Tabs */}
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-black/40 p-1.5 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode("credentials");
                setError("");
              }}
              className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                mode === "credentials"
                  ? "bg-gradient-pink text-white shadow-md"
                  : "text-[#b8aecf] hover:text-white"
              }`}
            >
              Email / ID 🔑
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("google");
                setError("");
              }}
              className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                mode === "google"
                  ? "bg-gradient-pink text-white shadow-md"
                  : "text-[#b8aecf] hover:text-white"
              }`}
            >
              Google Account 🌐
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError("");
              }}
              className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                mode === "forgot"
                  ? "bg-gradient-pink text-white shadow-md"
                  : "text-[#b8aecf] hover:text-white"
              }`}
            >
              Lost Password 🔄
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/15 p-3.5 text-xs text-red-200 font-medium">
              <div>⚠️ {error}</div>

              {unconfirmedEmail && (
                <div className="mt-3 pt-3 border-t border-red-500/30 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-200">
                    Need a fresh confirmation link for <strong>{unconfirmedEmail}</strong>?
                  </span>
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resendingConfirm}
                    className="rounded-lg bg-gradient-pink px-3.5 py-1.5 text-[11px] font-bold text-white shadow-md hover:opacity-90 transition cursor-pointer"
                  >
                    {resendingConfirm ? "Sending..." : "Resend Confirmation Email →"}
                  </button>
                </div>
              )}

              {resendConfirmSuccess && (
                <div className="mt-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 p-2 text-[11px] text-emerald-200">
                  {resendConfirmSuccess}
                </div>
              )}

              {suspendedAccount && (
                <div className="mt-3 pt-3 border-t border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-300">
                    ⏳ {Math.max(0, Math.ceil((suspendedAccount.AppealDeadlineAt - Date.now()) / (1000 * 60 * 60 * 24)))}{" "}
                    days left in your 30-day appeal window before permanent deletion.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAppealModal(true);
                      setAppealFeedback(null);
                    }}
                    className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-black hover:bg-amber-400 transition"
                  >
                    Submit Appeal →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MODE 1: CREDENTIALS */}
          {mode === "credentials" && (
            <form onSubmit={handleCredentialsSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">
                  Email, Phone Number, or KR8 ID *
                </label>
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. you@email.com, +234..., or KR82026..."
                  className={inputCls}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#cabfe0]">Password *</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-pink-400 hover:text-pink-300"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className={inputCls}
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                  }}
                  className="text-[#a594c7] hover:text-pink-300 underline underline-offset-4"
                >
                  Forgot your password?
                </button>
                <Link to="/register" className="text-pink-400 hover:text-pink-300 font-semibold">
                  Need an account?
                </Link>
              </div>

              <div className="pt-2 space-y-3">
                <GradientButton type="submit" disabled={submitting} className="w-full py-3.5 text-sm">
                  {submitting ? "Signing In..." : "Sign In to My Account →"}
                </GradientButton>

                {/* Biometrics / Passkey Sign-In */}
                {isBiometricSupported() && (
                  <div className="relative pt-2">
                    <div className="flex items-center gap-3 my-2">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-[10px] uppercase tracking-widest text-[#7a6b94] font-semibold">
                        Or Instant Biometrics
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                    <button
                      type="button"
                      disabled={biometricLoading}
                      onClick={handleBiometricSignIn}
                      className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 px-4 text-xs sm:text-sm font-bold text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-base">🫆</span>
                      <span>
                        {biometricLoading
                          ? "Scanning Biometrics..."
                          : canUseBiometrics
                          ? "Sign in with Fingerprint / Face ID"
                          : "Use Device Passkey / Biometrics"}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* MODE 2: GOOGLE SIGN-IN */}
          {mode === "google" && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 text-xs text-blue-100 leading-relaxed">
                <strong className="text-white block mb-1">Google Account Verification:</strong>
                Sign in seamlessly with your Google account. Make sure you use the Google account matching your registered KR8 email address.
              </div>

              <button
                type="button"
                onClick={handleGoogleSubmit}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-white py-3.5 px-5 text-sm font-bold text-gray-900 shadow-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <span className="text-base font-extrabold text-blue-600">G</span>
                <span>Continue with Google →</span>
              </button>
            </div>
          )}

          {/* MODE 3: FORGOT PASSWORD */}
          {mode === "forgot" && (
            <div className="mt-6">
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 p-3.5 text-xs text-[#d7cce8]">
                  Enter your registered email address and we will send a secure password reset link to your inbox.
                </div>

                {resetSentMsg && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3.5 text-xs text-emerald-200">
                    ✅ {resetSentMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">
                    Registered Email Address *
                  </label>
                  <input
                    required
                    type="email"
                    value={resetIdentifier}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls}
                  />
                </div>

                <GradientButton type="submit" disabled={resetBusy} className="w-full py-3.5 text-sm">
                  {resetBusy ? "Sending Reset Link..." : "Send Password Reset Link →"}
                </GradientButton>
              </form>
            </div>
          )}
        </Card>
      </div>

      {/* 30-DAY SUSPENSION APPEAL MODAL */}
      {showAppealModal && suspendedAccount && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setShowAppealModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-amber-500/40 bg-[#140024] p-6 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  30-Day Grace Period Appeal
                </span>
                <h3 className="font-display text-xl font-bold text-white mt-0.5">
                  Appeal Account Suspension
                </h3>
              </div>
              <button
                onClick={() => setShowAppealModal(false)}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-[#b8aecf] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200 space-y-1">
              <p>
                <strong>Account:</strong> {suspendedAccount.name} ({suspendedAccount.id})
              </p>
              <p>
                <strong>Suspension Reason:</strong> {suspendedAccount.reason}
              </p>
              <p className="text-amber-300 pt-1">
                ⚠️ Accounts that do not resolve their suspension within 30 days are permanently deleted.
              </p>
            </div>

            {appealFeedback && (
              <div
                className={`mt-4 rounded-xl border p-3.5 text-xs font-medium ${
                  appealFeedback.ok
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                    : "border-red-500/40 bg-red-500/15 text-red-200"
                }`}
              >
                {appealFeedback.msg}
              </div>
            )}

            {suspendedAccount.appealStatus === "pending" ? (
              <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                <strong>Appeal Pending Review:</strong> Your appeal was submitted and is awaiting review by the KR8 Administration team.
                {suspendedAccount.appealMessage && (
                  <p className="mt-2 italic text-white/80">"{suspendedAccount.appealMessage}"</p>
                )}
              </div>
            ) : (
              <form onSubmit={handleAppealSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">
                    Explain Why Your Account Should Be Restored *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={appealMessage}
                    onChange={(e) => setAppealMessage(e.target.value)}
                    placeholder="Provide context or commitment to KR8 community guidelines..."
                    className={inputCls}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAppealModal(false)}
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-[#b8aecf] hover:text-white"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-pink px-5 py-2.5 text-xs font-bold text-white shadow-lg"
                  >
                    Submit Official Appeal →
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
