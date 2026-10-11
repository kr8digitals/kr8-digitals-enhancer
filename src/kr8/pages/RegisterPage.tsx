import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { getSkills, getSkillRegistration } from "../data/store";
import { getSkillSettingsAsync, onSkillsUpdate, type SkillSetting } from "../data/skillsStore";
import { Pill, Card, GradientButton, GhostButton } from "../components/ui";
import CountryPhone from "../components/CountryPhone";
import { useSeo } from "../lib/useSeo";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = Array.from({ length: 85 }, (_, i) => new Date().getFullYear() - 5 - i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function RegisterPage() {
  useSeo({
    title: "Register — Join KR8 Digitals Academy or Tribe (100% Free)",
    description:
      "Create your official KR8 Digitals student or tribe member account. Learn digital skills completely free and claim your verifiable KR8 ID.",
    path: "/register",
  });

  const nav = useNavigate();
  const location = useLocation();
  const { student: currentAccount, signUp } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get("mode") === "tribe" ? "tribe" : "student";
  const preselectedSkill = searchParams.get("skill") || "";

  const [tab, setTab] = useState<"student" | "tribe">(initialTab);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [dbSkills, setDbSkills] = useState<SkillSetting[]>([]);
  const fallbackSkills = getSkills().filter((s) => s.available);

  useEffect(() => {
    getSkillSettingsAsync(false).then((rows) => {
      if (rows && rows.length > 0) setDbSkills(rows.filter((r) => r.available));
    });
    return onSkillsUpdate(() => {
      getSkillSettingsAsync(false).then((rows) => {
        if (rows && rows.length > 0) setDbSkills(rows.filter((r) => r.available));
      });
    });
  }, []);

  const availableSkills =
    dbSkills.length > 0
      ? dbSkills.map((s) => ({
          key: s.skill_key,
          name: s.name,
          regOpen: s.reg_open,
        }))
      : fallbackSkills.map((s) => ({
          key: s.key,
          name: s.name,
          regOpen: getSkillRegistration(s.key),
        }));

  const defaultOpenSkill =
    (preselectedSkill && availableSkills.find((s) => s.key === preselectedSkill && s.regOpen)?.key) ||
    availableSkills.find((s) => s.regOpen)?.key ||
    availableSkills[0]?.key ||
    "graphic";

  // Student form state
  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
    country: "NG",
    phone: "",
    skill: defaultOpenSkill,
    year: "2002",
    month: "Jan",
    day: "1",
    password: "",
  });

  // Tribe form state
  const [tribeForm, setTribeForm] = useState({
    name: "",
    email: "",
    country: "NG",
    phone: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  // Sync default skill if DB skills load
  useEffect(() => {
    if (availableSkills.length > 0) {
      const currentValid = availableSkills.find((s) => s.key === studentForm.skill && s.regOpen);
      if (!currentValid) {
        const nextOpen = availableSkills.find((s) => s.regOpen);
        if (nextOpen) {
          setStudentForm((prev) => ({ ...prev, skill: nextOpen.key }));
        }
      }
    }
  }, [dbSkills.length]);

  if (currentAccount) {
    return (
      <div className="section-bg min-h-[80vh] py-16 px-4">
        <div className="mx-auto max-w-xl text-center">
          <Card className="p-8 sm:p-10 border-pink-500/30">
            <Pill>Signed In</Pill>
            <h1 className="font-display mt-4 text-2xl sm:text-3xl font-bold text-white">
              You are already signed in as {currentAccount.name}
            </h1>
            <p className="mt-2 text-sm text-[#b8aecf]">
              KR8 ID: <span className="font-mono text-pink-300 font-bold">{currentAccount.id}</span>
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <GradientButton to="/dashboard">Go to Dashboard →</GradientButton>
              <GhostButton to="/academy">Open Academy Profile</GhostButton>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!studentForm.phone || studentForm.phone.replace(/[^0-9]/g, "").length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    if (studentForm.password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const dob = `${studentForm.year}-${String(MONTHS.indexOf(studentForm.month) + 1).padStart(2, "0")}-${String(
        studentForm.day
      ).padStart(2, "0")}`;

      const res = await signUp({
        name: studentForm.name,
        email: studentForm.email,
        phone: studentForm.phone,
        country: studentForm.country,
        skill: studentForm.skill,
        dob,
        password: studentForm.password,
        mode: "student",
      });

      if (!res.ok) {
        setError(res.error || "Registration failed.");
        setSubmitting(false);
        return;
      }

      const selectedSkillObj = availableSkills.find((s) => s.key === studentForm.skill);
      const skillName = selectedSkillObj?.name || studentForm.skill;

      nav(
        `/register/check-email?email=${encodeURIComponent(
          studentForm.email.trim().toLowerCase()
        )}&name=${encodeURIComponent(studentForm.name.trim())}&skill=${encodeURIComponent(
          studentForm.skill
        )}&skillName=${encodeURIComponent(skillName)}&mode=student`
      );
    } catch (err: any) {
      setError(err?.message || "Registration failed. Please try again.");
      setSubmitting(false);
    }
  };

  const handleTribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!tribeForm.phone || tribeForm.phone.replace(/[^0-9]/g, "").length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    if (tribeForm.password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await signUp({
        name: tribeForm.name,
        email: tribeForm.email,
        phone: tribeForm.phone,
        country: tribeForm.country,
        skill: "graphic",
        password: tribeForm.password,
        mode: "tribe",
      });

      if (!res.ok) {
        setError(res.error || "Registration failed.");
        setSubmitting(false);
        return;
      }

      nav(
        `/register/check-email?email=${encodeURIComponent(
          tribeForm.email.trim().toLowerCase()
        )}&name=${encodeURIComponent(
          tribeForm.name.trim()
        )}&skill=tribe&skillName=${encodeURIComponent("KR8 Creative Tribe")}&mode=tribe`
      );
    } catch (err: any) {
      setError(err?.message || "Registration failed. Please try again.");
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder-[#7a6b94] focus:border-pink-400/60 focus:outline-none transition-colors";

  return (
    <div className="section-bg min-h-screen py-12 sm:py-16 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-pink shadow-lg shadow-pink-500/30">
            <img src="/branding/kr8_logo.png" alt="KR8 Digitals" className="h-9 w-9 object-contain" />
          </div>
          <Pill>Official Registration</Pill>
          <h1 className="font-display mt-3 text-3xl sm:text-5xl font-bold text-white">
            Create Your <span className="text-gradient">KR8 Account</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#b8aecf] max-w-lg mx-auto">
            100% Tuition-Free. Intensive cohorts, verifiable graduation certificates, and lifetime access to our creative network.
          </p>
          <p className="mt-3 text-xs text-[#8a7ba8]">
            Already have an account?{" "}
            <Link to="/signin" className="font-bold text-pink-400 hover:text-pink-300 underline underline-offset-4">
              Sign In here →
            </Link>
          </p>
        </div>

        <Card className="mt-8 p-6 sm:p-9 border-pink-500/25 shadow-2xl">
          {/* Tab Selector */}
          <div className="flex gap-2 rounded-2xl bg-black/40 p-1.5 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setTab("student");
                setError("");
              }}
              className={`flex-1 rounded-xl py-3 text-xs sm:text-sm font-bold transition-all ${
                tab === "student"
                  ? "bg-gradient-pink text-white shadow-lg shadow-pink-500/20"
                  : "text-[#b8aecf] hover:text-white"
              }`}
            >
              Academy Student (Full Cohort)
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("tribe");
                setError("");
              }}
              className={`flex-1 rounded-xl py-3 text-xs sm:text-sm font-bold transition-all ${
                tab === "tribe"
                  ? "bg-gradient-pink text-white shadow-lg shadow-pink-500/20"
                  : "text-[#b8aecf] hover:text-white"
              }`}
            >
              Tribe Member (Community Only)
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/15 p-3.5 text-xs text-red-200 font-medium">
              ⚠️ {error}
            </div>
          )}

          {tab === "student" ? (
            <form onSubmit={handleStudentSubmit} className="mt-6 space-y-4">
              <div className="rounded-xl border border-pink-500/20 bg-pink-500/[0.06] p-3.5 text-xs text-[#d7cce8]">
                <strong className="text-white">Academy Track:</strong> Master one high-income digital skill at a time. Upon graduation, your KR8 ID unlocks additional skill tracks.
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Full Legal Name *</label>
                <input
                  required
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  placeholder="Enter your full name (printed on certificate)"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Real Email Address *</label>
                <input
                  required
                  type="email"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  placeholder="you@example.com"
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-[#8a7ba8]">
                  Used for email confirmation, account recovery, and linked sign-in methods (including Google).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Country & Phone Number *</label>
                <CountryPhone
                  country={studentForm.country}
                  onCountry={(country) => setStudentForm((prev) => ({ ...prev, country }))}
                  onChange={(phone) => setStudentForm((prev) => ({ ...prev, phone }))}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#cabfe0]">Create Password *</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-pink-400 hover:text-pink-300"
                  >
                    {showPassword ? "Hide password" : "Show password"}
                  </button>
                </div>
                <input
                  required
                  minLength={6}
                  type={showPassword ? "text" : "password"}
                  value={studentForm.password}
                  onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Select Your Skill Focus *</label>
                <select
                  value={studentForm.skill}
                  onChange={(e) => setStudentForm({ ...studentForm, skill: e.target.value })}
                  className={inputCls}
                >
                  {availableSkills.map((s) => (
                    <option key={s.key} value={s.key} disabled={!s.regOpen} className="bg-[#140022] text-white">
                      {s.name} {s.regOpen ? "(Cohort Open)" : "(Registration Closed)"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">
                  Date of Birth (All ages welcome) *
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <select
                    value={studentForm.year}
                    onChange={(e) => setStudentForm({ ...studentForm, year: e.target.value })}
                    className={inputCls}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y} className="bg-[#140022]">
                        {y}
                      </option>
                    ))}
                  </select>
                  <select
                    value={studentForm.month}
                    onChange={(e) => setStudentForm({ ...studentForm, month: e.target.value })}
                    className={inputCls}
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m} className="bg-[#140022]">
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={studentForm.day}
                    onChange={(e) => setStudentForm({ ...studentForm, day: e.target.value })}
                    className={inputCls}
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d} className="bg-[#140022]">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <GradientButton type="submit" disabled={submitting} className="w-full py-4 text-sm sm:text-base">
                  {submitting
                    ? "Creating Your Account..."
                    : "Complete Registration & Generate KR8 ID →"}
                </GradientButton>
              </div>
            </form>
          ) : (
            <form onSubmit={handleTribeSubmit} className="mt-6 space-y-4">
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-3.5 text-xs text-[#d7cce8]">
                <strong className="text-white">Tribe Membership:</strong> Connect with 2,400+ African creators, attend Mindset Shift Sundays, join monthly hangouts, and transition to a full Academy Student whenever you're ready!
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Full Name *</label>
                <input
                  required
                  value={tribeForm.name}
                  onChange={(e) => setTribeForm({ ...tribeForm, name: e.target.value })}
                  placeholder="Enter your full name"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Email Address *</label>
                <input
                  required
                  type="email"
                  value={tribeForm.email}
                  onChange={(e) => setTribeForm({ ...tribeForm, email: e.target.value })}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cabfe0] mb-1.5">Country & Phone Number *</label>
                <CountryPhone
                  country={tribeForm.country}
                  onCountry={(country) => setTribeForm((prev) => ({ ...prev, country }))}
                  onChange={(phone) => setTribeForm((prev) => ({ ...prev, phone }))}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#cabfe0]">Create Password *</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-pink-400 hover:text-pink-300"
                  >
                    {showPassword ? "Hide password" : "Show password"}
                  </button>
                </div>
                <input
                  required
                  minLength={6}
                  type={showPassword ? "text" : "password"}
                  value={tribeForm.password}
                  onChange={(e) => setTribeForm({ ...tribeForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className={inputCls}
                />
              </div>

              <div className="pt-2">
                <GradientButton type="submit" disabled={submitting} className="w-full py-4 text-sm sm:text-base">
                  {submitting ? "Creating Your Account..." : "Join the Tribe Family (100% Free) →"}
                </GradientButton>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
