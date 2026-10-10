// Production Register Page - Supabase Auth, server-generated KR8 ID, DB-first skills
import { useState, useEffect } from "react";
import { useSeo } from "../lib/useSeo";
import { Link, Navigate, useNavigate, useSearchParams } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { getSkills, areAllRegistrationsClosed, getSkillRegistration, buildPhone, countryByCode } from "../data/store";
import { Card, GradientButton, Pill } from "../components/ui";
import CountryPhone from "../components/CountryPhone";
import { supabase } from "@/integrations/supabase/client";

type DbSkill = { skill_key: string; name: string; reg_open: boolean; available: boolean; sort_order: number };

export default function RegisterPage() {
  useSeo({ path: "/register", noindex: true });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signUp, loading: authLoading } = useAuth();

  const initialSkill = searchParams.get("skill") || "";
  const initialType = searchParams.get("type") === "tribe" ? "tribe" : "student";
  const initialEmail = searchParams.get("email") || "";
  const initialName = searchParams.get("name") || "";

  const [tab, setTab] = useState<"student" | "tribe">(initialType);
  const allRegistrationsClosed = areAllRegistrationsClosed();

  const [studentForm, setStudentForm] = useState({ name: initialName, email: initialEmail, phone: "", country: "NG", password: "", skill: initialSkill, y: "", m: "", d: "" });
  const [tribeForm, setTribeForm] = useState({ name: initialName, email: initialEmail, phone: "", country: "NG", password: "" });
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dbSkills, setDbSkills] = useState<DbSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Visitors: select only skill_key,name,reg_open,available,sort_order
        const { data, error } = await supabase.from('skill_settings').select('skill_key,name,reg_open,available,sort_order').order('sort_order');
        if (error) throw error;
        if (!cancelled && data) {
          setDbSkills(data as any);
        }
      } catch (e) {
        console.warn('skill_settings load error', e);
        // fallback to hardcoded
      } finally {
        if (!cancelled) setSkillsLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60000); // 60s polling, quota safe
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // Use DB skills if available, else fallback
  const allSkillsSource = dbSkills.length
    ? dbSkills.filter(s=>s.available).map(s=>({ key: s.skill_key, name: s.name, available: s.available, regOpen: s.reg_open }))
    : getSkills().filter(s => s.available).map(s=>({ key: s.key, name: s.name, available: s.available, regOpen: s.regOpen }));
  const openSkills = allSkillsSource.filter((s:any)=>s.regOpen);
  const closedSkills = allSkillsSource.filter((s:any)=>!s.regOpen);
  const skills = openSkills; // Only show skills where reg_open true on register and academy pages

  const allClosedFromDB = dbSkills.length ? dbSkills.filter(s=>s.available).every(s=>!s.reg_open) : false;

  if ((allRegistrationsClosed || allClosedFromDB) && tab === "student" && !skillsLoading) {
    // Instead of redirect, show closed message with list
    // But keep tribe open
  }

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!studentForm.name.trim() || !studentForm.email.trim() || !studentForm.phone.trim() || !studentForm.password) {
      setStatusMsg({ type: "error", text: "Please fill all required fields" });
      return;
    }
    if (studentForm.password.length < 6) {
      setStatusMsg({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }
    if (!studentForm.skill) {
      setStatusMsg({ type: "error", text: "Please select a skill" });
      return;
    }
    // Check reg_open from DB
    const selected = allSkillsSource.find((s:any)=>s.key===studentForm.skill);
    if (selected && !selected.regOpen) {
      setStatusMsg({ type: "error", text: "Registration for this skill is closed" });
      return;
    }
    const skillReg = getSkillRegistration(studentForm.skill);
    if (skillReg === false) {
      setStatusMsg({ type: "error", text: "Registration for this skill is closed" });
      return;
    }

    setLoading(true);
    try {
      const dial = countryByCode(studentForm.country)?.dial || "+234";
      const phone = buildPhone(dial, studentForm.phone);
      const dob = studentForm.y && studentForm.m && studentForm.d ? `${studentForm.y}-${studentForm.m}-${studentForm.d}` : undefined;
      const signUpData: any = { name: studentForm.name.trim(), email: studentForm.email.trim(), phone, password: studentForm.password, country: studentForm.country, skill: studentForm.skill };
      if (dob) signUpData.dob = dob;
      const result = await signUp(signUpData);
      if (result.ok) {
        setStatusMsg({ type: "success", text: `Check your email to confirm - your account is created! KR8 ID: ${(result as any).kr8_id || 'generated'}. Confirmation email sent - check spam too. After confirming, sign in on any device.` });
        setTimeout(() => navigate("/signin?registered=true"), 2500);
      } else {
        const errText = result.error || "Registration failed";
        // If sign-up fails Database error saving new user show Registration for this skill is closed
        if (errText.toLowerCase().includes('database error saving new user') || errText.toLowerCase().includes('database error')) {
          setStatusMsg({ type: "error", text: "Registration for this skill is closed" });
        } else {
          setStatusMsg({ type: "error", text: errText });
        }
      }
    } catch (err: any) {
      const msg = err.message || "Registration failed";
      if (msg.toLowerCase().includes('database error saving new user')) {
        setStatusMsg({ type: "error", text: "Registration for this skill is closed" });
      } else {
        setStatusMsg({ type: "error", text: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!tribeForm.name.trim() || !tribeForm.email.trim() || !tribeForm.phone.trim() || !tribeForm.password) {
      setStatusMsg({ type: "error", text: "Please fill all required fields" });
      return;
    }
    if (tribeForm.password.length < 6) {
      setStatusMsg({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }
    setLoading(true);
    try {
      const dial2 = countryByCode(tribeForm.country)?.dial || "+234";
      const phone = buildPhone(dial2, tribeForm.phone);
      const result = await signUp({ name: tribeForm.name.trim(), email: tribeForm.email.trim(), phone, password: tribeForm.password, country: tribeForm.country, skill: "tribe" });
      if (result.ok) {
        setStatusMsg({ type: "success", text: "Check your email to confirm - tribe account created! Confirmation email sent, check spam too. After confirming, sign in on any device." });
        setTimeout(() => navigate("/signin?registered=true"), 2500);
      } else {
        setStatusMsg({ type: "error", text: result.error || "Registration failed" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Registration failed" });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none";
  const labelCls = "block text-xs font-semibold text-[#cabfe0] mb-1.5";

  return (
    <div className="section-bg min-h-[85vh] py-12 sm:py-16 px-5">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <Pill>Fresh Start - Register From Scratch</Pill>
          <h1 className="font-display mt-4 text-3xl sm:text-4xl font-bold text-white">
            Join <span className="text-gradient">KR8 Digitals</span>
          </h1>
          <p className="mt-3 text-sm text-[#cabfe0] leading-relaxed">
            100% Tuition-Free. Real authentication - sign in from any device, anywhere. Your KR8 ID is generated securely on server.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-[#a594c7]">
            <span>Already have an account?</span>
            <Link to="/signin" className="font-bold text-pink-400 hover:text-pink-300 underline">Sign In here →</Link>
          </div>
        </div>

        {user && (
          <div className="mb-6 rounded-2xl border border-pink-500/40 bg-pink-500/10 p-4 text-center">
            <p className="text-xs sm:text-sm text-pink-200">You are signed in as <span className="font-bold text-white">{user.name}</span> ({user.kr8_id}).</p>
            <Link to="/dashboard" className="mt-2 inline-block text-xs font-bold text-pink-400 underline">Go to Dashboard →</Link>
          </div>
        )}

        {statusMsg && (
          <div className={`mb-6 rounded-xl p-4 text-xs font-semibold ${statusMsg.type === "success" ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : "border border-red-500/40 bg-red-500/15 text-red-200"}`}>
            {statusMsg.type === "success" ? "✓ " : "✕ "}{statusMsg.text}
          </div>
        )}

        <Card className="p-6 sm:p-8">
          <div className="flex rounded-full bg-black/30 p-1 mb-6 border border-white/10">
            <button onClick={() => setTab("student")} className={`flex-1 rounded-full py-2.5 text-xs font-bold transition ${tab === "student" ? "bg-gradient-pink text-white shadow-lg" : "text-[#8a7ba8] hover:text-white"}`}>Student Registration</button>
            <button onClick={() => setTab("tribe")} className={`flex-1 rounded-full py-2.5 text-xs font-bold transition ${tab === "tribe" ? "bg-gradient-pink text-white shadow-lg" : "text-[#8a7ba8] hover:text-white"}`}>Tribe Member</button>
          </div>

          {tab === "student" ? (
            <>
              {allClosedFromDB && openSkills.length===0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">All skill registrations are currently closed. Please check back later or join waitlist.</div>
              ) : null}
              <form onSubmit={handleStudentSubmit} className="space-y-4">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input type="text" required placeholder="Your full name" className={inputCls} value={studentForm.name} onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Email *</label>
                    <input type="email" required placeholder="your@email.com" className={inputCls} value={studentForm.email} onChange={e => setStudentForm({ ...studentForm, email: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Password *</label>
                    <input type="password" required placeholder="At least 6 characters" className={inputCls} value={studentForm.password} onChange={e => setStudentForm({ ...studentForm, password: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Phone *</label>
                  <CountryPhone country={studentForm.country} phone={studentForm.phone} onCountry={(c: string) => setStudentForm({ ...studentForm, country: c })} onPhone={(p: string) => setStudentForm({ ...studentForm, phone: p })} inputClass={inputCls} />
                  <p className="mt-1 text-[11px] text-[#8a7ba8]">Phone verified ownership for co-founders via OTP. Typing a founder number alone never grants admin.</p>
                </div>
                <div>
                  <label className={labelCls}>Skill Track * {skillsLoading ? "(loading...)" : ""}</label>
                  <select required className={inputCls} value={studentForm.skill} onChange={e => setStudentForm({ ...studentForm, skill: e.target.value })}>
                    <option value="">Select a skill</option>
                    {openSkills.map(s => (
                      <option key={s.key} value={s.key} className="bg-black text-white">{s.name}</option>
                    ))}
                  </select>
                  {closedSkills.length>0 && (
                    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
                      <p className="text-[11px] text-[#8a7ba8] font-bold">Registration closed:</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {closedSkills.map(s=>(<span key={s.key} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-[#8a7ba8]">{s.name} - Registration closed</span>))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Date of Birth (Optional)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" placeholder="YYYY" className={inputCls} value={studentForm.y} onChange={e => setStudentForm({ ...studentForm, y: e.target.value })} />
                    <input type="text" placeholder="MM" className={inputCls} value={studentForm.m} onChange={e => setStudentForm({ ...studentForm, m: e.target.value })} />
                    <input type="text" placeholder="DD" className={inputCls} value={studentForm.d} onChange={e => setStudentForm({ ...studentForm, d: e.target.value })} />
                  </div>
                </div>
                <div className="pt-2">
                  <GradientButton type="submit" disabled={loading || authLoading} className="w-full py-3.5 text-sm font-bold disabled:opacity-50">
                    {loading ? "Creating secure account..." : "Create Account & Get KR8 ID →"}
                  </GradientButton>
                  <p className="mt-2 text-[11px] text-[#8a7ba8] text-center">KR8 ID generated on server (e.g., KR82026JC0024GDVFD), unique, secure. Works on any device.</p>
                </div>
              </form>
            </>
          ) : (
            <form onSubmit={handleTribeSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input type="text" required placeholder="Your name" className={inputCls} value={tribeForm.name} onChange={e => setTribeForm({ ...tribeForm, name: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Email *</label>
                  <input type="email" required placeholder="your@email.com" className={inputCls} value={tribeForm.email} onChange={e => setTribeForm({ ...tribeForm, email: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Password *</label>
                  <input type="password" required placeholder="At least 6 chars" className={inputCls} value={tribeForm.password} onChange={e => setTribeForm({ ...tribeForm, password: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Phone *</label>
                <CountryPhone country={tribeForm.country} phone={tribeForm.phone} onCountry={(c: string) => setTribeForm({ ...tribeForm, country: c })} onPhone={(p: string) => setTribeForm({ ...tribeForm, phone: p })} inputClass={inputCls} />
              </div>
              <div className="pt-2">
                <GradientButton type="submit" disabled={loading || authLoading} className="w-full py-3.5 text-sm font-bold disabled:opacity-50">
                  {loading ? "Joining..." : "Join Tribe (Secure, Cross-Device) →"}
                </GradientButton>
              </div>
            </form>
          )}
        </Card>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center">
          <p className="text-xs text-[#8a7ba8] leading-relaxed"><strong className="text-white">Security:</strong> Founder role granted only after email verification. Phone numbers alone never grant admin - requires OTP verification or founder promotion.</p>
        </div>
      </div>
    </div>
  );
}
