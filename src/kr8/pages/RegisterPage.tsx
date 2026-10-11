// Production Register Page - Yesterday's rich design + new celebration flow + WhatsApp onboarding
import { useState, useEffect } from "react";
import { useSeo } from "../lib/useSeo";
import { Link, Navigate, useNavigate, useSearchParams } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { getSkills, areAllRegistrationsClosed, getSkillRegistration, buildPhone, countryByCode } from "../data/store";
import { Card, GradientButton, Pill } from "../components/ui";
import CountryPhone from "../components/CountryPhone";
import { supabase } from "@/integrations/supabase/client";

type DbSkill = { skill_key: string; name: string; reg_open: boolean; available: boolean; sort_order: number; whatsapp_url?: string };

export default function RegisterPage() {
  useSeo({ path: "/register", noindex: true });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signUp } = useAuth();

  const initialSkill = searchParams.get("skill") || "";
  const initialType = searchParams.get("type") === "tribe" ? "tribe" : "student";
  const initialEmail = searchParams.get("email") || "";
  const initialName = searchParams.get("name") || "";

  const [tab, setTab] = useState<"student" | "tribe">(initialType);
  const [studentForm, setStudentForm] = useState({ name: initialName, email: initialEmail, phone: "", country: "NG", password: "", skill: initialSkill, y: "", m: "", d: "" });
  const [tribeForm, setTribeForm] = useState({ name: initialName, email: initialEmail, phone: "", country: "NG", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dbSkills, setDbSkills] = useState<DbSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase.from('skill_settings').select('skill_key,name,reg_open,available,sort_order,whatsapp_url').order('sort_order');
        if (!cancelled && data) setDbSkills(data as any);
      } catch {}
      setSkillsLoading(false);
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  useEffect(() => {
    if (initialSkill) setStudentForm(prev => ({ ...prev, skill: initialSkill }));
  }, [initialSkill]);

  const allSkillsSource = dbSkills.length ? dbSkills.map(s => ({ key: s.skill_key, name: s.name, regOpen: s.reg_open, available: s.available, whatsapp: s.whatsapp_url })) : getSkills().map((s:any)=>({ key: s.key, name: s.name, regOpen: s.regOpen, available: s.available, whatsapp: s.whatsapp }));
  const openSkills = allSkillsSource.filter(s => s.regOpen && s.available);
  const allClosedFromDB = dbSkills.length ? dbSkills.every(s => !s.reg_open) : areAllRegistrationsClosed();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  const inputCls = "w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none";
  const labelCls = "block text-xs font-semibold text-[#cabfe0] mb-1.5";

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setStatusMsg(null);
    if (!studentForm.name.trim() || !studentForm.email.trim() || !studentForm.phone.trim() || !studentForm.password || !studentForm.skill || !studentForm.y || !studentForm.m || !studentForm.d) {
      setError("Please fill in every field, including full name, email, phone, password, skill, and birth date.");
      return;
    }
    if (studentForm.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    const selected = allSkillsSource.find((s:any)=>s.key===studentForm.skill);
    if (selected && !selected.regOpen) { setError("Registration for this skill is closed"); return; }
    if (getSkillRegistration(studentForm.skill) === false) { setError("Registration for this skill is closed"); return; }

    setLoading(true);
    try {
      const dial = countryByCode(studentForm.country)?.dial || "+234";
      const phone = buildPhone(dial, studentForm.phone);
      const dob = `${studentForm.y}-${studentForm.m}-${studentForm.d}`;
      const res = await signUp({ name: studentForm.name.trim(), email: studentForm.email.trim(), phone, password: studentForm.password, country: studentForm.country, skill: studentForm.skill, dob } as any);
      if (res.ok) {
        navigate(`/register/check-email?email=${encodeURIComponent(studentForm.email.trim())}&name=${encodeURIComponent(studentForm.name.trim())}&skill=${encodeURIComponent(studentForm.skill)}`);
      } else {
        const errText = (res as any).error || "Registration failed";
        if (errText.toLowerCase().includes('database error')) setError("Registration for this skill is closed");
        else setError(errText);
      }
    } catch (err: any) {
      const msg = err.message || "Registration failed";
      if (msg.toLowerCase().includes('database error')) setError("Registration for this skill is closed");
      else setError(msg);
    } finally { setLoading(false); }
  };

  const handleTribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setStatusMsg(null);
    if (!tribeForm.name.trim() || !tribeForm.email.trim() || !tribeForm.phone.trim() || !tribeForm.password) { setError("Please fill in full name, email, phone, password"); return; }
    if (tribeForm.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const dial = countryByCode(tribeForm.country)?.dial || "+234";
      const phone = buildPhone(dial, tribeForm.phone);
      const res = await signUp({ name: tribeForm.name.trim(), email: tribeForm.email.trim(), phone, password: tribeForm.password, country: tribeForm.country, skill: "tribe" } as any);
      if (res.ok) {
        navigate(`/register/check-email?email=${encodeURIComponent(tribeForm.email.trim())}&name=${encodeURIComponent(tribeForm.name.trim())}&skill=tribe`);
      } else setError((res as any).error || "Registration failed");
    } catch (err: any) { setError(err.message || "Registration failed"); } finally { setLoading(false); }
  };

  if (allClosedFromDB && tab === "student" && openSkills.length===0 && !skillsLoading) {
    return <Navigate to="/waitlist" replace />;
  }

  return (
    <div className="section-bg min-h-[85vh] py-12 sm:py-16 px-5">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500/25 via-purple-500/15 to-transparent p-2 border border-pink-500/40 shadow-2xl shadow-pink-500/30">
              <img src="/branding/kr8_logo.png" alt="KR8 Digitals Logo" className="h-full w-full object-contain filter drop-shadow" />
            </div>
          </div>
          <Pill>Official Registration · Yesterday's Design Restored</Pill>
          <h1 className="font-display mt-4 text-3xl sm:text-5xl font-bold text-white">
            Create Your <span className="text-gradient">KR8 Account</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#cabfe0]">
            100% Tuition-Free. Intensive cohorts, verifiable graduation certificates, and lifetime access to our creative network. <span className="text-pink-300 font-semibold">Secure Supabase Auth — works on any device.</span>
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-[#a594c7]">
            <span>Already have an account?</span>
            <Link to="/signin" className="font-bold text-pink-400 hover:text-pink-300 underline">Sign In here →</Link>
          </div>
        </div>

        {user && (
          <div className="mb-6 rounded-2xl border border-pink-500/40 bg-pink-500/10 p-4 text-center">
            <p className="text-xs sm:text-sm text-pink-200">You are currently signed in as <span className="font-bold text-white">{user.name}</span> ({user.kr8_id}).</p>
            <Link to="/dashboard" className="mt-2 inline-block text-xs font-bold text-pink-400 underline">Go to Dashboard →</Link>
          </div>
        )}

        {statusMsg && (
          <div className={`mb-6 rounded-xl p-4 text-xs font-semibold ${statusMsg.type === "success" ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : "border border-red-500/40 bg-red-500/15 text-red-200"}`}>
            {statusMsg.type === "success" ? "✓ " : "✕ "}{statusMsg.text}
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/15 p-4 text-xs font-semibold text-red-200">✕ {error}</div>
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
                    <input type="email" required placeholder="you@example.com" className={inputCls} value={studentForm.email} onChange={e => setStudentForm({ ...studentForm, email: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Password *</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required placeholder="••••••••" className={`${inputCls} pr-12`} value={studentForm.password} onChange={e => setStudentForm({ ...studentForm, password: e.target.value })} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3 text-xs text-[#8a7ba8] hover:text-white">{showPassword ? "Hide" : "Show"}</button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Phone *</label>
                  <CountryPhone country={studentForm.country} phone={studentForm.phone} onCountry={c => setStudentForm({ ...studentForm, country: c })} onPhone={p => setStudentForm({ ...studentForm, phone: p })} inputClass={inputCls} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Year *</label>
                    <select required value={studentForm.y} onChange={e => setStudentForm({ ...studentForm, y: e.target.value })} className={inputCls}>
                      <option value="">Year</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Month *</label>
                    <select required value={studentForm.m} onChange={e => setStudentForm({ ...studentForm, m: e.target.value })} className={inputCls}>
                      <option value="">Month</option>
                      {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Day *</label>
                    <select required value={studentForm.d} onChange={e => setStudentForm({ ...studentForm, d: e.target.value })} className={inputCls}>
                      <option value="">Day</option>
                      {days.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Choose Skill Track *</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {openSkills.map((s:any) => (
                      <button type="button" key={s.key} onClick={() => setStudentForm({ ...studentForm, skill: s.key })} className={`rounded-xl border px-4 py-3 text-left text-xs font-semibold transition ${studentForm.skill===s.key ? "border-pink-500/60 bg-pink-500/10 text-white" : "border-white/10 bg-black/20 text-[#8a7ba8] hover:border-white/20 hover:text-white"}`}>
                        <span className="block font-bold">{s.name}</span>
                        <span className="text-[10px] text-[#6a5b82]">● Registration open</span>
                      </button>
                    ))}
                  </div>
                </div>
                <GradientButton type="submit" disabled={loading} className="w-full py-3.5 shadow-xl shadow-pink-500/25 text-sm font-bold disabled:opacity-50">
                  {loading ? "Creating Account..." : "Claim Free KR8 ID — Continue →"}
                </GradientButton>
                <p className="text-[11px] text-center text-[#6a5b82]">By registering, you agree to our Terms and Privacy. KR8 ID generated securely on server. Confirmation email sent instantly.</p>
              </form>
            </>
          ) : (
            <form onSubmit={handleTribeSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input type="text" required placeholder="Your full name" className={inputCls} value={tribeForm.name} onChange={e => setTribeForm({ ...tribeForm, name: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Email *</label>
                  <input type="email" required placeholder="you@example.com" className={inputCls} value={tribeForm.email} onChange={e => setTribeForm({ ...tribeForm, email: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Password *</label>
                  <input type={showPassword ? "text" : "password"} required placeholder="••••••••" className={inputCls} value={tribeForm.password} onChange={e => setTribeForm({ ...tribeForm, password: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Phone *</label>
                <CountryPhone country={tribeForm.country} phone={tribeForm.phone} onCountry={c => setTribeForm({ ...tribeForm, country: c })} onPhone={p => setTribeForm({ ...tribeForm, phone: p })} inputClass={inputCls} />
              </div>
              <GradientButton type="submit" disabled={loading} className="w-full py-3.5 shadow-xl shadow-pink-500/25 text-sm font-bold disabled:opacity-50">
                {loading ? "Creating..." : "Join Tribe Free →"}
              </GradientButton>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
