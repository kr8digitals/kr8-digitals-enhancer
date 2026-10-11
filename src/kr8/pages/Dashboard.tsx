// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate, Link } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import {
  getSkillName,
  getSkills,
  normalizeSkillWhatsAppUrl,
  OFFICIAL_WHATSAPP_LINKS,
  type CertificateRecord,
} from "../data/store";
import { Pill, Card, GradientButton, GhostButton, Avatar } from "../components/ui";
import Icon from "../components/Icon";
import { useSeo } from "../lib/useSeo";
import CertificateDocumentView from "../components/CertificateDocumentView";
import {
  downloadCertificateImage,
  downloadCertificatePdf,
} from "../utils/certificate";
import { useServerFn } from "@tanstack/react-start";
import * as pubFns from "@/lib/public-data.functions";

export default function Dashboard() {
  useSeo({ path: "/dashboard", noindex: true });
  const {
    student,
    loading,
    signOut,
    whatsappReminderPending,
    markWhatsAppOnboarding,
    dismissWhatsappReminderForSession,
  } = useAuth();
  const nav = useNavigate();
  const getCredentialsFn = useServerFn(pubFns.getStudentCredentials);

  const [shareCopied, setShareCopied] = useState(false);
  const [downloadingCert, setDownloadingCert] = useState(false);
  const [dbCerts, setDbCerts] = useState<CertificateRecord[]>([]);

  useEffect(() => {
    if (!student) return;
    let active = true;
    (async () => {
      try {
        const res: any = await getCredentialsFn({
          data: {
            userId: student.userId || student.authId,
            kr8Id: student.kr8_id || student.id,
            email: student.email,
          },
        });
        if (!active) return;
        if (res?.certificates && res.certificates.length > 0) {
          const mapped: CertificateRecord[] = res.certificates.map((c: any) => ({
            id: c.certificate_code || c.id,
            studentId: c.kr8_id || student.id,
            studentName: c.student_name || student.name,
            formattedName: c.formatted_name || String(c.student_name || student.name).toUpperCase(),
            skill: c.skill || student.skill || "graphic",
            skillName: c.skill_name || getSkillName(c.skill || student.skill),
            tier: c.tier === "Completion" ? "Completion" : "Professionalism",
            templateUrl:
              c.template_url ||
              `/certificates/reusable_${String(c.tier || "professionalism").toLowerCase()}.png`,
            achievementText:
              c.achievement_text ||
              "demonstrating excellence and proficiency in turning client requests into client satisfaction.",
            additionalNotes: c.additional_notes || undefined,
            issuedAt: c.issued_at ? new Date(c.issued_at).getTime() : Date.now(),
            status: c.status === "withdrawn" ? "withdrawn" : "active",
            withdrawalReason: c.withdrawal_reason || undefined,
          }));
          setDbCerts(mapped);
        }
      } catch (err) {
        console.warn("[Dashboard] credentials fetch warning:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [student?.userId, student?.id]);

  if (loading) {
    return (
      <div className="section-bg min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="section-bg min-h-screen py-20">
        <div className="mx-auto max-w-lg px-5 text-center">
          <Card className="p-8 border-pink-500/30">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-pink text-white mb-4">
              <Icon name="user" size={26} />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">Not Signed In</h1>
            <p className="mt-2 text-sm text-[#b8aecf]">
              Please sign in via the Academy or Tribe page to access your personal KR8 Dashboard.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <GradientButton to="/signin">Sign In to Portal →</GradientButton>
              <GhostButton to="/register">Register Free</GhostButton>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const isExecutive =
    student.isFounder ||
    student.isCoFounder ||
    student.type === "founder" ||
    student.type === "co-founder";
  const isStaff = isExecutive || student.isAdmin || student.isCoach;
  const isTribe = student.type === "tribe";
  const allSkills = getSkills();

  const activeCert =
    dbCerts.find((c) => c.status === "active") ||
    (student.graduated
      ? ({
          id: `CERT-KR8-${student.id}-${(student.skill || "KR8").toUpperCase()}`,
          studentId: student.id,
          studentName: student.name,
          formattedName: student.name.toUpperCase(),
          skill: student.skill || "graphic",
          skillName: getSkillName(student.skill),
          tier: student.certTier || "Professionalism",
          templateUrl: `/certificates/reusable_${(
            student.certTier || "professionalism"
          ).toLowerCase()}.png`,
          achievementText:
            "demonstrating excellence and proficiency in turning client requests into client satisfaction.",
          additionalNotes: student.certRecognition,
          issuedAt: student.joined || Date.now(),
          status: "active",
        } as CertificateRecord)
      : undefined);

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify?id=${encodeURIComponent(student.id)}${
          activeCert ? `&cert=${encodeURIComponent(activeCert.id)}` : ""
        }`
      : `https://www.kr8digitals.com/verify?id=${encodeURIComponent(student.id)}`;

  const handleCopyVerifyLink = () => {
    navigator.clipboard?.writeText(verifyUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const handleDownloadCertPdf = async () => {
    if (!activeCert) return;
    setDownloadingCert(true);
    try {
      await downloadCertificatePdf(student.name, null, activeCert, student);
    } finally {
      setDownloadingCert(false);
    }
  };

  const handleDownloadCertPng = async () => {
    if (!activeCert) return;
    setDownloadingCert(true);
    try {
      await downloadCertificateImage(student.name, activeCert, student);
    } finally {
      setDownloadingCert(false);
    }
  };

  const shareText = encodeURIComponent(
    `🎓 Excited to share that I have officially graduated in ${getSkillName(
      student.skill
    )} from KR8 Digitals! Verify my official credential here: ${verifyUrl}`
  );

  const studentWaLink = normalizeSkillWhatsAppUrl(student.skill || "graphic");
  const studentSkillDisplay = getSkillName(student.skill || "graphic");

  return (
    <div className="section-bg min-h-screen py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-5 space-y-8">
        {/* WHATSAPP ONBOARDING REMINDER BANNER (If student skipped joining WhatsApp group) */}
        {(whatsappReminderPending || (!student.whatsappJoined && !isExecutive && !student.graduated)) && (
          <div className="rounded-3xl border-2 border-[#25D366] bg-gradient-to-r from-[#25D366]/20 via-emerald-950/70 to-[#120022] p-5 sm:p-7 shadow-2xl shadow-[#25D366]/15">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-black">
                  📲 Action Needed · Join Your Class Group
                </span>
                <h3 className="font-display text-xl sm:text-2xl font-black text-white">
                  Join Your Official {studentSkillDisplay} WhatsApp Learning Group!
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
                  Don't miss live class links (<strong className="text-white">Mon/Wed/Fri 9PM–12AM WAT</strong>) and practical assignments (<strong className="text-white">Tue/Thu/Sat</strong>). Join your learning group now, then click <strong className="text-white">"I've Joined — Done"</strong>!
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <a
                  href={studentWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#20bd5a] px-6 py-3 text-xs sm:text-sm font-black text-black shadow-lg shadow-[#25D366]/30 transition-transform hover:scale-105"
                >
                  <span>💬 Join {studentSkillDisplay} WhatsApp →</span>
                </a>
                <button
                  type="button"
                  onClick={() => markWhatsAppOnboarding(true, false)}
                  className="rounded-full bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-3 text-xs font-bold text-white cursor-pointer"
                >
                  ✓ I've Joined — Done
                </button>
                <button
                  type="button"
                  onClick={dismissWhatsappReminderForSession}
                  className="rounded-full border border-white/10 px-3 py-2 text-[11px] text-[#a594c7] hover:text-white cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Header Card */}
        <div className="relative overflow-hidden rounded-3xl border border-pink-500/30 bg-gradient-to-br from-[#1d0533] via-[#120021] to-[#0d0017] p-6 sm:p-8 shadow-2xl">
          {student.coverPhoto && (
            <div
              className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
              style={{ backgroundImage: `url(${student.coverPhoto})` }}
            />
          )}
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <Avatar src={student.avatar} name={student.name} size={84} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>
                    {student.isFounder
                      ? "👑 Founder & CEO"
                      : student.isCoFounder
                      ? "⭐ Co-Founder"
                      : isTribe
                      ? "Tribe Member"
                      : "Academy Student"}
                  </Pill>
                  {(student.graduated || activeCert) && (
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
                      🎓 Certified Graduate ({activeCert?.tier || student.certTier || "Professionalism"})
                    </span>
                  )}
                  {isStaff && (
                    <span className="rounded-full bg-gradient-pink px-3 py-1 text-xs font-bold text-white">
                      ⚡ {student.title || "Admin Staff"}
                    </span>
                  )}
                </div>
                <h1 className="font-display mt-2 text-2xl sm:text-4xl font-bold text-white">
                  {student.name}
                </h1>
                <p className="font-mono text-xs sm:text-sm text-pink-300 mt-1">
                  ID: {student.id} · {student.email}
                </p>
                {student.bio && (
                  <p className="mt-2 max-w-xl text-xs sm:text-sm text-[#cabfe0]">{student.bio}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {isStaff && (
                <GradientButton to="/admin">
                  <Icon name="cog" size={16} />
                  <span>Admin Dashboard</span>
                </GradientButton>
              )}
              <GhostButton to="/academy">
                <Icon name="user" size={16} />
                <span>Full Profile & Coursework</span>
              </GhostButton>
              <GhostButton to="/settings">
                <Icon name="cog" size={16} />
                <span>Settings</span>
              </GhostButton>
              <button
                onClick={() => {
                  signOut();
                  nav("/");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-xs font-bold text-red-300 hover:bg-red-500/20 transition cursor-pointer"
              >
                <Icon name="logout" size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stat Metrics Row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-5 text-center border-pink-500/20">
            <div className="font-display text-3xl font-bold text-gradient">{student.points || 0}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#8a7ba8]">
              Total XP Points
            </div>
          </Card>
          <Card className="p-5 text-center border-white/10">
            <div className="font-display text-3xl font-bold text-white">
              {student.attendanceAccepted || 0}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#8a7ba8]">
              Classes Attended
            </div>
          </Card>
          <Card className="p-5 text-center border-white/10">
            <div className="font-display text-3xl font-bold text-white">
              {student.submissions || 0}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#8a7ba8]">
              Projects Submitted
            </div>
          </Card>
          <Card className="p-5 text-center border-white/10">
            <div className="font-display text-3xl font-bold text-white">
              {student.referrals || 0}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#8a7ba8]">
              Referrals
            </div>
          </Card>
        </div>

        {/* GRADUATED STUDENT HERO CERTIFICATE SECTION */}
        {(student.graduated || activeCert) && activeCert && (
          <Card className="border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-[#150426] to-[#0d0017] p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-white/10 pb-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                  <span>🎓 Official Graduated Credential</span>
                </div>
                <h2 className="font-display mt-3 text-2xl sm:text-3xl font-bold text-white">
                  Congratulations, {student.name.split(" ")[0]}! Your Certificate is Live & Verified.
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-[#cabfe0] max-w-2xl">
                  You have earned the{" "}
                  <strong className="text-white">Certificate of {activeCert.tier}</strong> in{" "}
                  <strong className="text-pink-300">{activeCert.skillName}</strong>. Download your print-ready certificate or share your official verification link with employers and clients.
                </p>
                {activeCert.additionalNotes && (
                  <p className="mt-2 inline-block rounded-xl border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-200">
                    ⭐ Recognition: "{activeCert.additionalNotes}"
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={downloadingCert}
                  onClick={handleDownloadCertPdf}
                  className="rounded-xl bg-gradient-pink px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-pink-500/25 hover:scale-[1.02] transition cursor-pointer disabled:opacity-50"
                >
                  {downloadingCert ? "Preparing PDF..." : "Download Official PDF ↓"}
                </button>
                <button
                  type="button"
                  disabled={downloadingCert}
                  onClick={handleDownloadCertPng}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs sm:text-sm font-bold text-white hover:bg-white/15 transition cursor-pointer disabled:opacity-50"
                >
                  Download PNG ↓
                </button>
                <Link
                  to={`/verify?id=${encodeURIComponent(student.id)}&cert=${encodeURIComponent(
                    activeCert.id
                  )}`}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs sm:text-sm font-bold text-emerald-300 hover:bg-emerald-500/20 transition"
                >
                  Open Public Verify Page ↗
                </Link>
              </div>
            </div>

            {/* Social Share & Direct Verification Link Bar */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9c8cb9]">
                  Public Employer & Client Verification Link
                </p>
                <p className="font-mono text-xs text-pink-300 truncate mt-0.5">{verifyUrl}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyVerifyLink}
                  className="rounded-xl border border-pink-500/40 bg-pink-500/15 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-pink-500/25 transition cursor-pointer"
                >
                  {shareCopied ? "✓ Link Copied!" : "Copy Verify Link"}
                </button>
                <a
                  href={`https://wa.me/?text=${shareText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition"
                >
                  Share on WhatsApp
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                    verifyUrl
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-blue-500/30 bg-blue-500/15 px-3.5 py-2 text-xs font-bold text-blue-300 hover:bg-blue-500/25 transition"
                >
                  Share on LinkedIn
                </a>
              </div>
            </div>

            {/* Certificate Preview */}
            <div className="mt-6">
              <CertificateDocumentView cert={activeCert} verifyUrl={verifyUrl} />
            </div>
          </Card>
        )}

        {/* Quick Actions & Track Status */}
        <div className="grid gap-6 lg:grid-cols-2">
          {isExecutive ? (
            <Card className="p-6 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-pink-500/5 to-transparent">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  👑 Executive Authority
                </span>
                <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-0.5 text-[11px] font-bold text-amber-300">
                  Full Platform Control
                </span>
              </div>
              <h3 className="font-display mt-3 text-xl font-bold text-white">
                {student.isFounder
                  ? "Founder & CEO — All Creative & Tech Tracks"
                  : `${student.title || "Co-Founder"} — Executive Leadership`}
              </h3>
              <p className="mt-2 text-xs text-[#cabfe0] leading-relaxed">
                As {student.isFounder ? "Founder & CEO" : "Co-Founder"}, your profile holds permanent verification across all KR8 Digitals tracks ({allSkills.length} active tracks), Live Broadcast Stage hosting, Certificate Issuance, and Ultimate Admin authority.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <GradientButton to="/admin" className="text-xs px-5 py-2.5">
                  Open Admin Control Center →
                </GradientButton>
                <GhostButton to="/live" className="text-xs px-5 py-2.5">
                  Broadcast Live Stage
                </GhostButton>
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-pink-400">
                  Current Track
                </span>
                <span className="rounded-full bg-white/10 px-3 py-0.5 text-[11px] text-[#cabfe0]">
                  Cohort {student.year || 2026}
                </span>
              </div>
              <h3 className="font-display mt-3 text-xl font-bold text-white">
                {isTribe ? "KR8 Creative Tribe Community" : getSkillName(student.skill)}
              </h3>
              <p className="mt-2 text-xs text-[#b8aecf] leading-relaxed">
                {isTribe
                  ? "You are a registered member of the KR8 Tribe. You can upgrade and enroll in a full 8-week Academy skill track anytime from the Academy page!"
                  : "Attend Mon/Wed/Fri 9PM–12AM WAT live classes, submit your Tue/Thu/Sat assignments, and complete your Week 8 capstone project to earn your verifiable KR8 Graduation Certificate."}
              </p>

              {/* Official WhatsApp Learning Group Link */}
              <div className="mt-4 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 p-3.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-emerald-300">
                    Official {isTribe ? "Tribe" : getSkillName(student.skill)} WhatsApp Group
                  </p>
                  <p className="text-[10px] text-[#cabfe0]">
                    Live class links, drills & mentor announcements
                  </p>
                </div>
                <a
                  href={isTribe ? OFFICIAL_WHATSAPP_LINKS.tribe : studentWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => markWhatsAppOnboarding(true, false)}
                  className="rounded-full bg-[#25D366] px-4 py-1.5 text-xs font-black text-black hover:bg-[#20bd5a] transition"
                >
                  Open WhatsApp Group ↗
                </a>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <GradientButton to="/academy" className="text-xs px-5 py-2.5">
                  {isTribe ? "Enroll in an Academy Skill →" : "Open My Classroom & Curriculum →"}
                </GradientButton>
                <GhostButton
                  to={`/verify?id=${encodeURIComponent(student.id)}`}
                  className="text-xs px-5 py-2.5"
                >
                  Verify My KR8 ID
                </GhostButton>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Platform Shortcuts
            </span>
            <h3 className="font-display mt-3 text-xl font-bold text-white">
              Quick Navigation
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <Link
                to="/live"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white hover:border-pink-500/40 transition"
              >
                <Icon name="video" size={16} className="text-pink-400" />
                <span>Live Broadcast Stage</span>
              </Link>
              <Link
                to="/leaderboard"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white hover:border-pink-500/40 transition"
              >
                <Icon name="trophy" size={16} className="text-pink-400" />
                <span>XP Leaderboard</span>
              </Link>
              <Link
                to="/messages"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white hover:border-pink-500/40 transition"
              >
                <Icon name="message" size={16} className="text-pink-400" />
                <span>Direct Messages</span>
              </Link>
              <Link
                to="/settings"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white hover:border-pink-500/40 transition"
              >
                <Icon name="cog" size={16} className="text-pink-400" />
                <span>Account Settings</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
