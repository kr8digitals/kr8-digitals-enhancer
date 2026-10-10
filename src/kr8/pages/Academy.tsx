// Restored rich original Academy UI (pre-generic) + new world-class attendance backend
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import {
  getSkills,
  getSkill,
  getSkillName,
  areAllRegistrationsClosed,
  getTestimonials,
  getTribeWhatsApp,
  getSkillRegistration,
  getSkillWhatsApp,
  getStudents,
  getReferralUrl,
  getFounders,
  getStudentConversations,
  type Account,
  type Skill,
} from "../data/store";
import { getSiteContent, type SiteContent } from "../data/cmsStore";
import { supabase } from "@/integrations/supabase/client";
import AttendanceWidget from "../components/AttendanceWidget";
import ProfileJourney from "../components/ProfileJourney";
import { Pill, GradientButton, GhostButton, SectionHead, Card, Avatar, Check, ImageWithFallback } from "../components/ui";
import { useSeo } from "../lib/useSeo";
import Marquee from "../components/Marquee";
import TestimonialCarousel from "../components/TestimonialCarousel";
import CoachingSection from "../components/CoachingSection";
import Icon from "../components/Icon";
import { downloadCertificatePdf, downloadCertificateImage } from "../utils/certificate";
import CertificateDocumentView from "../components/CertificateDocumentView";
import GraduationShareModal from "../components/GraduationShareModal";

function safeArray<T>(v: any, fallback: T[] = []): T[] {
  return Array.isArray(v) ? v : fallback;
}

export default function Academy() {
  const { student } = useAuth();
  if (student && (student.type === "student" || student.type === "founder" || student.type === "co-founder")) {
    return <Profile student={student} />;
  }
  return <GuestAcademy />;
}

const inputCls = "w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none";

function GuestAcademy() {
  useSeo({
    title: "Academy — Free Digital Skills Training | KR8 Digitals",
    description: "Intensive, practical tuition-free tracks in graphic design, video editing, web development, front-end development and more — taught by senior practitioners who ship client work. Claim your verifiable KR8 ID.",
    path: "/academy",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "KR8 Digitals Academy Tracks",
      itemListElement: safeArray(getSkills(), []).filter((s) => (s as any).available).map((s: any, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Course",
          name: s.name,
          description: s.snippet,
          url: "https://www.kr8digitals.com/academy",
          provider: { "@type": "Organization", name: "KR8 Digitals", url: "https://www.kr8digitals.com" },
        },
      })),
    },
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [curriculum, setCurriculum] = useState<Skill | null>(null);
  const [cms, setCms] = useState<SiteContent>(() => {
    try { return getSiteContent(); } catch { return {} as any; }
  });
  const [skillsLive, setSkillsLive] = useState(() => safeArray(getSkills(), []));
  const foundersSafe = safeArray(getFounders(), []);

  useEffect(() => {
    const syncCms = () => { try { setCms(getSiteContent()); } catch {} };
    const syncSkills = () => setSkillsLive(safeArray(getSkills(), []));
    window.addEventListener("kr8:cms-updated", syncCms);
    window.addEventListener("kr8:skills-updated", syncSkills);
    window.addEventListener("storage", syncCms);
    window.addEventListener("storage", syncSkills);
    // Also poll skill_settings from Supabase for real open/closed
    const fetchSkills = async () => {
      try {
        const { data } = await supabase.from('skill_settings').select('skill_key,name,reg_open,available,sort_order').order('sort_order');
        if (data) {
          // Merge into skillsLive via siteSettingsStore? For now keep local but update regOpen
          setSkillsLive(prev => prev.map(p => {
            const db = data.find((d: any) => d.skill_key === p.key);
            if (db) return { ...p, regOpen: db.reg_open, available: db.available };
            return p;
          }));
        }
      } catch {}
    };
    fetchSkills();
    const iv = setInterval(fetchSkills, 60000);
    return () => {
      clearInterval(iv);
      window.removeEventListener("kr8:cms-updated", syncCms);
      window.removeEventListener("kr8:skills-updated", syncSkills);
      window.removeEventListener("storage", syncCms);
      window.removeEventListener("storage", syncSkills);
    };
  }, []);

  const skillsSafe = safeArray(skillsLive, []).filter((s: any) => s.available);
  const testimonialsSafe = safeArray(getTestimonials(), []);

  return (
    <div>
      <section className="section-bg relative overflow-hidden py-12 sm:py-16">
        <div className="absolute inset-0 bg-gradient-to-b from-pink-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-5">
          <div className="max-w-3xl">
            <Pill>{cms.academy?.eyebrow || "KR8 Digitals Academy · 100% Tuition-Free"}</Pill>
            <h1 className="font-display mt-4 text-4xl sm:text-5xl font-bold leading-tight text-white">
              {cms.academy?.headline ? cms.academy.headline : <>Master High-Income <span className="text-gradient">Digital Skills</span> Free.</>}
            </h1>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#cabfe0]">
              {cms.academy?.description || "Intensive, practical tuition-free tracks in graphic design, video editing, web development, front-end development and more — taught by senior practitioners who ship client work daily. Claim your verifiable KR8 ID in 60 seconds."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="flex items-center gap-2 text-xs text-[#b8aecf]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">✓</span><span>Zero Tuition Forever</span></span>
              <span className="flex items-center gap-2 text-xs text-[#b8aecf]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">✓</span><span>Live feedback daily</span></span>
              <span className="flex items-center gap-2 text-xs text-[#b8aecf]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">✓</span><span>Verifiable QR ID</span></span>
              <span className="flex items-center gap-2 text-xs text-[#b8aecf]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">✓</span><span>Agency pipeline</span></span>
            </div>
            <div className="mt-7 flex flex-wrap gap-3.5">
              {areAllRegistrationsClosed() ? (
                <GradientButton to="/waitlist" className="shadow-xl shadow-pink-500/25">Admissions Paused — Join Waitlist 📲</GradientButton>
              ) : (
                <GradientButton to="/register" className="shadow-xl shadow-pink-500/25">Claim Free KR8 ID — Join Cohort →</GradientButton>
              )}
              <GhostButton to="/verify">Verify Graduate Proof</GhostButton>
            </div>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {skillsSafe.map((s: any) => {
              const founderKey = s.key === "graphic" ? "stevenson" : s.key === "video" ? "daniel" : s.key === "web" ? "timfire" : "";
              const instructor = founderKey ? foundersSafe.find((founder: any) => founder.key === founderKey) : null;
              const displayInstructor = instructor ? { name: instructor.name, photo: instructor.photo, bio: instructor.bio } : s.instructor;
              return (
                <Card key={s.key} className="flex flex-col group hover:border-pink-500/40 hover:shadow-xl hover:shadow-pink-500/10 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-pink-300 group-hover:scale-110 transition-transform"><Icon name={s.icon as any} size={25} /></span>
                    <span className="rounded-full bg-pink-500/10 px-3 py-1 font-mono text-[11px] text-pink-400">{s.suffix}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">{s.name}</h3>
                  <p className="mt-2 flex-1 text-sm text-[#b8aecf] leading-relaxed">{s.snippet}</p>
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-black/20 p-3 border border-white/5">
                    {displayInstructor ? (
                      <>
                        <InstructorPhoto src={displayInstructor.photo} name={displayInstructor.name} />
                        <div><p className="text-xs text-[#8a7ba8]">Instructor</p><p className="text-sm font-semibold text-white">{displayInstructor.name}</p><p className="text-[11px] text-[#6a5b82] line-clamp-1">{displayInstructor.bio}</p></div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-pink flex items-center justify-center text-white font-bold text-xs">KR8</div>
                        <div><p className="text-xs text-[#8a7ba8]">Instructor</p><p className="text-sm font-semibold text-white">KR8 Senior Team</p></div>
                      </div>
                    )}
                  </div>
                  <p className={`mt-3 text-xs font-semibold ${getSkillRegistration(s.key) ? "text-green-400" : "text-yellow-300"}`}>{getSkillRegistration(s.key) ? "● Registration open" : "● Registration closed"}</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => setCurriculum(s)} className="flex-1 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white hover:border-pink-400/60 hover:bg-white/5 transition">View Curriculum</button>
                    <button onClick={() => navigate(`/register?skill=${s.key}`)} disabled={!getSkillRegistration(s.key)} className="flex-1 rounded-full bg-gradient-pink px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40 shadow-md shadow-pink-500/20 hover:scale-[1.02] transition">Register</button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <Marquee items={["100% Tuition-Free", "Verifiable KR8 Identity", "Zero Gatekeeping", "Live Industry Feedback", "Proof Over Paper", "From Learners to Earners", "Graduate-Powered Agency"]} />

      <section className="section-bg py-16">
        <div className="mx-auto max-w-3xl px-5">
          <div className="text-center flex flex-wrap justify-center gap-3">
            <GradientButton to="/register">Register as Student →</GradientButton>
            <GhostButton to="/signin">Sign In to Existing Account →</GhostButton>
          </div>
          <p className="mt-4 text-center text-xs text-[#8a7ba8]">Secure Supabase Auth - works on any device. No localStorage accounts. WhatsApp link sent via notification + email via Resend.</p>
        </div>
      </section>

      <section className="section-bg py-20 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead label="Verified Proof · 100% Free Training" title="From Learners to" highlight="Earners." sub="Real African youth who started with zero experience, completed our free cohorts, and are now landing high-paying design and video roles across the world." center />
          <div className="mt-12"><TestimonialCarousel items={testimonialsSafe} /></div>
        </div>
      </section>

      <CoachingSection />

      {curriculum && (
        <CurriculumModal skill={curriculum} onClose={() => setCurriculum(null)} onRegister={() => { const skillKey = curriculum.key; setCurriculum(null); navigate(`/register?skill=${skillKey}`); }} />
      )}
    </div>
  );
}

function InstructorPhoto({ src, name }: { src: string; name: string }) {
  return <ImageWithFallback src={src} alt={name} className="h-14 w-14 shrink-0 rounded-2xl object-cover object-top ring-2 ring-pink-400/40 shadow-md" fallbackClassName="h-14 w-14 shrink-0 rounded-2xl border border-pink-400/40" />;
}

function CurriculumModal({ skill, onClose, onRegister }: { skill: Skill; onClose: () => void; onRegister: () => void }) {
  const curriculumSafe = safeArray((skill as any).curriculum, []);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#160026] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><span className="text-3xl">{(skill as any).icon}</span><h3 className="font-display mt-2 text-3xl text-white">{skill.name}</h3>{(skill as any).instructor && <p className="mt-1 text-sm text-pink-400">Instructor: {(skill as any).instructor.name}</p>}</div>
          <button onClick={onClose} className="text-xl text-[#b8aecf] hover:text-white">✕</button>
        </div>
        <p className="mt-3 text-sm text-[#b8aecf] leading-relaxed">{(skill as any).snippet}</p>
        <div className="mt-6 space-y-4">
          {curriculumSafe.length > 0 ? curriculumSafe.map((w: any) => (
            <div key={w.week} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-pink-400">{w.week}</p>
              <h4 className="mt-1 font-bold text-white">{w.title}</h4>
              <ul className="mt-3 space-y-2">{safeArray(w.points, []).map((p: string) => <Check key={p}>{p}</Check>)}</ul>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-8 text-center"><span className="text-3xl">📋</span><h4 className="text-base font-bold text-white mt-2">Curriculum Under Final Review</h4><p className="text-xs text-[#a594c7] mt-1.5 max-w-sm mx-auto leading-relaxed">The detailed weekly syllabus for {skill.name} is being finalized and will be uploaded shortly by {(skill as any).instructor?.name || "the instructional lead"}. You can register now to secure your spot.</p></div>
          )}
        </div>
        <div className="mt-6 rounded-2xl bg-pink-500/10 border border-pink-500/20 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-pink-400">Certification criteria</p><p className="mt-1 text-sm text-[#cabfe0]">{(skill as any).criteria}</p></div>
        <div className="mt-6"><GradientButton onClick={onRegister} className="w-full shadow-lg shadow-pink-500/20">Register for {skill.name} →</GradientButton></div>
      </div>
    </div>
  );
}

/* ============ Student profile — rich original + new journey + attendance ============ */
function Profile({ student }: { student: Account }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => {
    try { return searchParams.get("registered") === "true" || sessionStorage.getItem("kr8_just_registered") === student.id; } catch { return false; }
  });
  const [tab, setTab] = useState<"posts" | "portfolio" | "activity" | "about">("posts");
  const [profile, setProfile] = useState(student);
  const [copiedId, setCopiedId] = useState(false);
  const { signOut, addNotification } = useAuth();
  const skill = getSkill(profile.skill);
  const rankedSafe = safeArray(getStudents(), []).filter((account: any) => !(account as any).isPlaceholder).sort((a: any, b: any) => b.points - a.points);
  const rank = rankedSafe.findIndex((s: any) => s.id === profile.id) + 1;
  const testimonialsSafe = safeArray(getTestimonials(), []);
  const studentTestimonial = testimonialsSafe.find((t: any) => t.kr8Id && t.kr8Id.toLowerCase() === profile.id.toLowerCase());

  useEffect(() => {
    setProfile(student);
  }, [student]);

  const handleCopyId = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(profile.id);
      else { const textarea = document.createElement("textarea"); textarea.value = profile.id; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); document.body.removeChild(textarea); }
      setCopiedId(true); addNotification(`KR8 ID copied: ${profile.id}`); setTimeout(() => setCopiedId(false), 2000);
    } catch { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
  };

  const handleDownload = () => {
    if ((profile as any).certificateUrl) downloadCertificatePdf(profile.name, (profile as any).certificateUrl);
    else downloadCertificate(profile, skill?.name ?? "KR8 Digitals");
  };

  return (
    <div className="section-bg min-h-screen">
      <div className="relative h-52 overflow-hidden sm:h-64">
        <img src={(profile as any).coverPhoto || "https://images.pexels.com/photos/3866398/pexels-photo-3866398.jpeg?auto=compress&cs=tinysrgb&w=1400"} alt="cover" className="h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0015] to-transparent" />
      </div>

      <div className="mx-auto max-w-6xl px-5">
        <div className="relative z-10 -mt-16 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <div className="relative rounded-full ring-4 ring-[#0d0015]"><Avatar src={profile.avatar} name={profile.name} size={110} /></div>
          <div className="flex-1 pb-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl text-white">{profile.name}</h1>
              {profile.type === "founder" ? <span className="rounded-full bg-gradient-pink px-3.5 py-1 text-xs font-bold uppercase text-white">👑 KR8 Founder & CEO</span> : profile.type === "co-founder" ? <span className="rounded-full bg-gradient-pink px-3.5 py-1 text-xs font-bold uppercase text-white">⭐ KR8 Co-Founder</span> : (profile as any).vip && <span className="rounded-full bg-gradient-pink px-3 py-1 text-xs font-bold text-white">VIP</span>}
              {(profile as any).graduated && profile.type === "student" && <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-pink px-3.5 py-1 text-xs font-bold text-white">🎓 KR8 Certified Graduate · {(profile as any).certTier}</span>}
              {(profile as any).admin && <Link to="/admin" className="rounded-full border border-pink-400/50 bg-pink-500/10 px-3 py-1 text-xs font-bold capitalize text-pink-200">Open Admin</Link>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-pink-300 bg-pink-500/10 border border-pink-500/25 px-2.5 py-0.5 rounded-lg select-all">{profile.id}</span>
              <button type="button" onClick={handleCopyId} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white">{copiedId ? <span className="text-emerald-400 font-bold">✓ Copied!</span> : <><Icon name="paperclip" size={12} className="text-[#cabfe0]" /><span className="text-xs text-[#cabfe0]">Copy ID</span></>}</button>
            </div>
            <span className="mt-2 inline-block rounded-full bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-400">{profile.type === "founder" ? "Founder & CEO" : profile.type === "co-founder" ? "Co-Founder" : skill?.name}</span>
          </div>
          <div className="flex flex-col sm:items-end gap-3 pb-2">
            <div className="flex gap-6"><div className="text-center"><div className="font-display text-2xl text-gradient">#{rank || 1}</div><div className="text-[10px] uppercase text-[#8a7ba8]">Rank</div></div><div className="text-center"><div className="font-display text-2xl text-gradient">{profile.points}</div><div className="text-[10px] uppercase text-[#8a7ba8]">Points</div></div><div className="text-center"><div className="font-display text-2xl text-gradient">{(profile as any).referrals}</div><div className="text-[10px] uppercase text-[#8a7ba8]">Referrals</div></div></div>
            <div className="flex items-center gap-2 pt-1 flex-wrap"><Link to="/settings" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white"><Icon name="cog" size={13} /><span>Settings</span></Link><button onClick={() => { signOut(); navigate("/"); }} className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-semibold text-rose-300">Sign Out</button></div>
          </div>
        </div>

        {showWelcomeBanner && (
          <div className="mt-6 overflow-hidden rounded-3xl border-2 border-pink-500/50 bg-gradient-to-r from-pink-950/60 via-[#180829] to-purple-950/60 p-6 sm:p-8 shadow-2xl relative">
            <button onClick={() => { setShowWelcomeBanner(false); try { sessionStorage.removeItem("kr8_just_registered"); } catch {} }} className="absolute top-4 right-4 rounded-full border border-white/20 bg-black/40 p-2 text-xs text-[#cabfe0]">✕</button>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-3"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-pink text-white text-2xl">🎉</span><div><span className="rounded-full bg-pink-500/20 border border-pink-500/30 px-3 py-0.5 text-xs font-bold text-pink-300">Welcome to KR8 Digitals Academy!</span><h2 className="text-xl sm:text-2xl font-bold text-white mt-1">Congratulations, {profile.name}!</h2></div></div><p className="text-xs sm:text-sm text-[#cabfe0] max-w-2xl">Your tuition-free seat is locked for <strong className="text-white">{skill?.name}</strong>. Your verifiable Student ID:</p><div className="flex flex-wrap items-center gap-3 pt-1"><span className="font-mono text-base sm:text-lg font-bold text-pink-300 bg-pink-500/20 border border-pink-500/40 px-3.5 py-1 rounded-xl select-all">{profile.id}</span><button onClick={handleCopyId} className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white">Copy ID</button></div></div>
              <div className="flex flex-col gap-2.5 w-full md:w-auto shrink-0">{skill && <a href={getSkillWhatsApp(skill.key)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-xs font-bold text-white">📲 Join {skill.name} WhatsApp Group →</a>}<a href={getTribeWhatsApp()} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-pink-500/40 bg-pink-500/10 px-5 py-2.5 text-xs font-semibold text-pink-200">🌐 Join Tribe Community →</a></div>
            </div>
          </div>
        )}

        {(profile as any).type === "founder" ? (
          <div className="mt-6 rounded-3xl border border-pink-400/50 bg-gradient-to-r from-pink-500/20 via-[#1a0030] to-purple-600/20 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-pink text-white text-3xl">👑</div><div><span className="rounded-full bg-pink-500/30 border border-pink-400/40 px-3 py-1 text-xs font-bold text-pink-200 uppercase">Executive Leadership</span><h2 className="mt-1 font-display text-2xl text-white">Founder & CEO — Kenneth Timothy Iziogo</h2><p className="mt-1 text-sm text-[#cabfe0]">Full system authority across KR8 Academy, Tribe, Agency.</p></div></div><Link to="/admin" className="rounded-full bg-gradient-pink px-5 py-2.5 text-xs font-bold text-white">Open Admin Portal →</Link></div></div>
        ) : (profile as any).type === "co-founder" ? (
          <div className="mt-6 rounded-3xl border border-pink-400/50 bg-gradient-to-r from-pink-500/20 via-[#1a0030] to-purple-600/20 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-pink text-white text-3xl">⭐</div><div><span className="rounded-full bg-pink-500/30 border border-pink-400/40 px-3 py-1 text-xs font-bold text-pink-200 uppercase">Executive Leadership</span><h2 className="mt-1 font-display text-2xl text-white">KR8 Co-Founder — {profile.name}</h2></div></div><Link to="/admin" className="rounded-full bg-gradient-pink px-5 py-2.5 text-xs font-bold text-white">Open Admin Portal →</Link></div></div>
        ) : (profile as any).graduated && (
          <div className="mt-6 rounded-3xl border border-green-500/40 bg-gradient-to-r from-green-500/15 via-[#1a0030] to-pink-500/15 p-6"><div className="flex flex-wrap items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-pink text-white text-2xl">🎓</div><div className="flex-1"><span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-300 uppercase">Official Certified Graduate</span><h2 className="mt-1 font-display text-2xl text-white">Congratulations, {profile.name}!</h2><p className="mt-1 text-sm text-[#cabfe0]">You completed <strong className="text-white">{skill?.name}</strong> and earned <strong className="text-white">Certificate of {(profile as any).certTier ?? "Completion"}</strong>.</p></div></div></div>
        )}

        {studentTestimonial && (
          <div className="mt-6 rounded-3xl border border-pink-500/40 bg-gradient-to-r from-pink-950/40 via-[#180829] to-purple-950/40 p-6"><div className="flex flex-col md:flex-row gap-6 items-center"><div className="relative w-full max-w-[180px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-white/20"><video src={(studentTestimonial as any).video} poster={(studentTestimonial as any).img} controls playsInline className="h-full w-full object-cover" /></div><div className="space-y-3 flex-1"><span className="rounded-full bg-pink-500/20 border border-pink-500/40 px-3 py-1 text-xs font-bold text-pink-300">⭐ Featured Story</span><h3 className="text-xl font-bold text-white">Your Official Student Journey</h3><p className="text-sm italic text-[#cabfe0]">"{(studentTestimonial as any).caption}"</p></div></div></div>
        )}

        <div className="mt-8 flex gap-1 overflow-x-auto border-b border-white/10">
          {(["posts", "portfolio", "activity", "about"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap px-5 py-3 text-sm font-semibold capitalize ${tab === t ? "border-b-2 border-pink-400 text-white" : "text-[#b8aecf] hover:text-white"}`}>{t === "portfolio" ? "Portfolio / Submissions" : t}</button>
          ))}
        </div>

        <div className="grid gap-8 py-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <ProfileJourney student={profile} />
            {tab === "posts" && (
              (profile as any).type === "founder" || (profile as any).type === "co-founder" ? (
                <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-white text-lg">Executive Attendance Management</h3><p className="mt-1 text-sm text-[#b8aecf]">Student attendance proofs with date/topic/time pending approval. Dashboard updates only after approval. Mindset/Hangout auto-marked via live.</p></div><Link to="/admin" className="rounded-full bg-gradient-pink px-4 py-2 text-xs font-bold text-white">Open Admin Review →</Link></div></Card>
              ) : (<div id="attendance"><AttendanceWidget student={profile} /></div>)
            )}
            {tab === "portfolio" && <PortfolioManager profile={profile} />}
            {tab === "activity" && (
              <Card><h3 className="font-bold text-white">Activity</h3><ul className="mt-4 space-y-3"><Check>{(profile as any).attendanceAccepted} attendance accepted</Check><Check>{(profile as any).submissions} assignments submitted</Check><Check>{(profile as any).referrals} referrals</Check><Check>{skill?.name} skill track badge</Check>{(profile as any).graduated && <Check>Certified Graduate: Certificate of {(profile as any).certTier} in {skill?.name ?? "Skill"}</Check>}</ul></Card>
            )}
            {tab === "about" && (
              <Card><h3 className="font-bold text-white">About</h3><p className="mt-3 text-sm leading-relaxed text-[#b8aecf]">{profile.name} joined KR8 Digitals in {(profile as any).year} to train in {skill?.name}.</p><textarea value={(profile as any).bio ?? ""} placeholder="Add your personal bio..." rows={4} className="mt-4 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white" disabled /><div className="mt-4 flex flex-wrap gap-2">{["Design", "Community", "Growth", skill?.name ?? ""].map((t) => <span key={t} className="rounded-full bg-white/5 px-3 py-1 text-xs text-[#cabfe0]">{t}</span>)}</div><a href={getReferralUrl(profile.id)} className="mt-5 block break-all rounded-xl bg-black/30 p-3 text-xs text-pink-300 underline">Referral link: {getReferralUrl(profile.id)}</a></Card>
            )}
          </div>

          <div className="space-y-6">
            <Card><h3 className="flex items-center gap-2 font-bold text-white"><Icon name="certificate" size={18} /> Official Credential</h3>
              {(profile as any).type === "founder" ? <div className="mt-3"><p className="text-sm font-semibold text-white">KR8 Founder & CEO Credential</p><p className="text-xs text-[#8a7ba8]">KR8 Digitals Executive Board</p></div> : (profile as any).type === "co-founder" ? <div className="mt-3"><p className="text-sm font-semibold text-white">KR8 Co-Founder Credential</p><p className="text-xs text-[#8a7ba8]">KR8 Digitals Executive Board</p></div> : <StudentCertificateSection profile={profile} onDownload={handleDownload} />}
            </Card>
            <Card><h3 className="flex items-center gap-2 font-bold text-white"><Icon name="bot" size={18} /> KR8 AI</h3><p className="mt-2 text-sm text-[#b8aecf]">Your always-on creative mentor.</p><div className="mt-4"><GhostButton to="/ai" className="w-full">Open KR8 AI →</GhostButton></div></Card>
            <ConnectionsCard profile={profile} />
          </div>
        </div>
      </div>
    </div>
  );
}

function downloadCertificate(profile: Account, skillName: string) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!popup) return;
  const safeName = profile.name.replace(/[<>]/g, "");
  const safeId = profile.id.replace(/[<>]/g, "");
  popup.document.write(`<!doctype html><html><head><title>KR8 Certificate - ${safeName}</title><style>body{margin:0;background:#f7f0fb;font-family:Arial,sans-serif;color:#20002f}.certificate{box-sizing:border-box;width:calc(100vw - 64px);min-height:620px;margin:32px;padding:64px;border:12px solid #7a1fa8;background:#fff;text-align:center}.brand{font-weight:800;letter-spacing:.03em;color:#7a1fa8;font-size:30px;margin-bottom:34px}.eyebrow{letter-spacing:.25em;text-transform:uppercase;color:#7a1fa8;font-weight:700;font-size:12px}.title{font-size:42px;letter-spacing:.04em;text-transform:uppercase;color:#7a1fa8;margin:20px 0}.name{font-size:34px;font-weight:700;margin:18px 0}.meta{font-size:16px;line-height:1.8}.id{font-family:monospace;color:#7a1fa8;font-weight:700}.footer{margin-top:46px;font-size:13px;color:#695b73}@media print{body{background:white}.certificate{width:100%;margin:0;min-height:100vh}}</style></head><body><div class="certificate"><div class="brand"><span>KR8</span> Digitals</div><div class="eyebrow">KR8 Digitals · Certificate of ${(profile as any).certTier ?? "Completion"}</div><div class="title">Certificate of ${(profile as any).certTier ?? "Completion"}</div><div class="name">${safeName}</div><div class="meta\">has successfully completed the <strong>${skillName}</strong> training programme.<br/>KR8 Identity: <span class="id">${safeId}</span><br/>Issued by KR8 Digitals · ${new Date().getFullYear()}</div><div class="footer">Verify this certificate at the KR8 Digitals Verify page.</div></div><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

function PortfolioManager({ profile }: { profile: Account }) {
  const portfolio = safeArray((profile as any).portfolio, []);
  if (portfolio.length === 0) {
    return <Card className="text-center"><Icon name="briefcase" size={26} className="mx-auto text-pink-300" /><h3 className="mt-3 font-bold text-white">Nothing yet — upload your work</h3><p className="mt-2 text-sm text-[#b8aecf]">Add work via your dashboard submissions. Portfolio is student-populated only.</p></Card>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {portfolio.map((p: any) => (
        <Card key={p.id} className="overflow-hidden p-0"><img src={p.imageUrl || p.image} alt={p.title} className="h-40 w-full object-cover" /><div className="p-4"><h4 className="font-bold text-white">{p.title}</h4><p className="text-xs text-[#8a7ba8]">{p.description}</p></div></Card>
      ))}
    </div>
  );
}

function ConnectionsCard({ profile }: { profile: Account }) {
  const [convs, setConvs] = useState(() => {
    try { return safeArray(getStudentConversations(profile.id), []); } catch { return []; }
  });
  useEffect(() => {
    const sync = () => { try { setConvs(safeArray(getStudentConversations(profile.id), [])); } catch {} };
    window.addEventListener("kr8:conversations-updated", sync);
    return () => window.removeEventListener("kr8:conversations-updated", sync);
  }, [profile.id]);
  const convCount = safeArray(convs, []).length;
  const followingCount = safeArray((profile as any).following, []).length;
  const followersCount = safeArray((profile as any).followers, []).length;
  const unreadTotal = safeArray(convs, []).reduce((acc: number, c: any) => acc + (c.unread || 0), 0);
  return (
    <Card>
      <h3 className="font-bold text-white">Connections</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/messages" className="inline-flex items-center gap-2 rounded-xl bg-gradient-pink px-5 py-2.5 text-sm font-bold text-white">Messages {unreadTotal > 0 && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-pink-600">{unreadTotal}</span>}</Link>
        <span className="text-xs text-[#8a7ba8]">{convCount} conversations · {followingCount} following · {followersCount} followers</span>
      </div>
    </Card>
  );
}

function StudentCertificateSection({ profile, onDownload }: { profile: Account; onDownload: () => void; }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareModalCert, setShareModalCert] = useState<any>(null);
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('certificates').select('*').eq('user_id', profile.id).eq('status', 'active').order('issued_at', { ascending: false });
        if (data) setCerts(data);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [profile.id]);

  if (loading) return <p className="mt-2 text-sm text-[#8a7ba8]">Loading certificates...</p>;

  if (certs.length === 0) {
    return (
      <div className="mt-3">
        {profile.graduated && (profile as any).certificateUrl ? (
          <div className="space-y-3"><p className="text-sm font-semibold text-white">Certificate of {(profile as any).certTier ?? "Completion"}</p><div className="rounded-xl overflow-hidden border border-white/15 bg-black"><img src={(profile as any).certificateUrl} alt="Certificate" className="w-full object-contain" /></div><GradientButton onClick={onDownload} className="w-full flex items-center justify-center gap-2"><Icon name="certificate" size={15} /> Download Certificate (PDF) →</GradientButton></div>
        ) : (<p className="mt-2 text-sm text-[#8a7ba8]">You don't have an issued certificate yet — complete your coursework and live attendance to earn one.</p>)}
      </div>
    );
  }

  const activeCert = certs[0];

  const handleCopyLink = () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/verify?id=${encodeURIComponent(profile.id)}&cert=${encodeURIComponent(activeCert.id)}`;
    try { navigator.clipboard.writeText(url); } catch {}
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="mt-3 space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2"><div><div className="flex items-center gap-2"><span className="font-bold text-white text-base">Certificate of {activeCert.tier}</span><span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/30">Active & Valid ✓</span></div><p className="text-xs text-[#8a7ba8] mt-0.5">{activeCert.skill_name} · Issued on {new Date(activeCert.issued_at).toLocaleDateString()}</p></div></div>
        <CertificateDocumentView cert={activeCert} student={profile} maxHeight="380px" />
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <GradientButton onClick={() => downloadCertificatePdf(profile.name, null, activeCert, profile)} className="w-full flex items-center justify-center gap-2"><Icon name="certificate" size={15} /> Download PDF →</GradientButton>
            <button type="button" onClick={() => downloadCertificateImage(profile.name, activeCert, profile)} className="w-full flex items-center justify-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 py-2.5 text-xs font-bold text-pink-300">Download Image (PNG) ↓</button>
          </div>
          <button type="button" onClick={() => setShareModalCert(activeCert)} className="w-full flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 py-2.5 text-xs font-bold text-white">Share on Social Media →</button>
          <div className="rounded-2xl border border-pink-400/30 bg-pink-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between"><p className="text-xs font-bold text-white">Shareable Verification Reference</p><span className="text-[10px] text-pink-300 font-mono">Live QR Target</span></div>
            <p className="text-[11px] leading-relaxed text-[#b8aecf]">Employers can verify your certificate status instantly:</p>
            <div className="flex items-center gap-2"><input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/verify?id=${encodeURIComponent(profile.id)}&cert=${encodeURIComponent(activeCert.id)}`} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[11px] text-pink-300" /><button onClick={handleCopyLink} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white">{copiedLink ? "Copied! ✓" : "Copy Link"}</button></div>
          </div>
        </div>
      </div>
      {shareModalCert && <GraduationShareModal isOpen={true} onClose={() => setShareModalCert(null)} cert={shareModalCert} student={profile} />}
    </div>
  );
}
