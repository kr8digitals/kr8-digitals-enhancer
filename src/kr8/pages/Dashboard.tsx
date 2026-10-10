// Dashboard - DB as source of truth, works on any device, no localStorage crashes
import { useState, useEffect } from "react";
import { useSeo } from "../lib/useSeo";
import { Link } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { getSkill, CONTACT, getReferralUrl } from "../data/store";
import { fetchCertificates, type DbCertificate } from "../data/dbStore";
import LiveFeed from "../components/LiveFeed";
import LeaderboardList from "../components/LeaderboardList";
import { Pill, Card } from "../components/ui";
import Icon from "../components/Icon";
import { lazy, Suspense } from "react";
const CertificateDocumentView = lazy(() => import("../components/CertificateDocumentView"));
import { downloadCertificatePdf } from "../utils/certificate";
import AnnouncementCard from "../components/AnnouncementCard";
import GraduationShareModal from "../components/GraduationShareModal";
import { supabase } from "@/integrations/supabase/client";

const actions = [
  { icon: "book" as const, label: "Program", title: "Continue Learning", desc: "Pick up your skill track where you left off.", to: "/academy" },
  { icon: "check" as const, label: "Attendance", title: "Mark Attendance", desc: "Submit class, assignment or hangout proof.", to: "/academy" },
  { icon: "user" as const, label: "Profile", title: "View My Profile", desc: "Portfolio, activity, badges & referrals.", to: "/academy" },
  { icon: "briefcase" as const, label: "Opportunities", title: "Browse Opportunities", desc: "Real client work from KR8 Agency.", to: "/agency" },
  { icon: "bot" as const, label: "Mentor", title: "Chat on KR8 AI", desc: "Unlimited access to your creative mentor.", to: "/ai" },
  { icon: "fingerprint" as const, label: "Security", title: "Settings & Biometrics", desc: "Manage Touch ID / Fingerprint, password and privacy.", to: "/settings" },
];

export default function Dashboard() {
  useSeo({ path: "/dashboard", noindex: true });
  const { student, user } = useAuth();
  const [shareCert, setShareCert] = useState<DbCertificate | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [certs, setCerts] = useState<DbCertificate[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [liveInfo, setLiveInfo] = useState<{ isLive: boolean; title?: string; hostName?: string } | null>(null);

  const currentUser = student || user;

  useEffect(() => {
    if (!currentUser?.id) return;
    let mounted = true;

    async function load() {
      try {
        // Fetch certificates from DB (source of truth)
        try {
          const dbCerts = await fetchCertificates(true);
          if (mounted) {
            const mine = dbCerts.filter(c => c.kr8_id === currentUser!.kr8_id || c.student_id === currentUser!.id);
            setCerts(mine);
          }
        } catch (e) {
          console.warn('Dashboard certs error', e);
        }

        // Fetch leaderboard rank from public RPC - fast, cached
        try {
          const { data: leaderboard } = await supabase.rpc('get_leaderboard', { p_limit: 500 });
          if (mounted && leaderboard) {
            const idx = (leaderboard as any[]).findIndex((p: any) => p.kr8_id === currentUser!.kr8_id || p.user_id === currentUser!.id);
            if (idx >= 0) setRank(idx + 1);
          }
        } catch (e) {
          console.warn('Dashboard rank error', e);
        }

        // Announcements from DB - table may not exist, handle gracefully
        try {
          const { data: anns, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(10);
          if (!error && mounted && anns) setAnnouncements(anns);
        } catch (e) {
          console.warn('Dashboard announcements error (table may not exist)', e);
          if (mounted) setAnnouncements([]);
        }

        // Live rooms from DB
        try {
          const { data: liveRooms, error } = await supabase.from('live_rooms').select('id,title,host_name,is_live').eq('is_live', true).limit(1).maybeSingle();
          if (!error && liveRooms && mounted) {
            setLiveInfo({ isLive: true, title: liveRooms.title, hostName: liveRooms.host_name });
          } else if (mounted) {
            setLiveInfo({ isLive: false });
          }
        } catch (e) {
          console.warn('Dashboard live error', e);
          if (mounted) setLiveInfo({ isLive: false });
        }
      } catch (e) {
        console.warn('Dashboard load error', e);
      }
    }

    load();

    // Realtime certificates - safe channel
    let certChannel: any = null;
    let profileChannel: any = null;
    try {
      certChannel = supabase.channel(`dashboard-certs-${currentUser.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'certificates', filter: `student_id=eq.${currentUser.id}` }, () => {
          load();
        })
        .subscribe();

      profileChannel = supabase.channel(`dashboard-profile-${currentUser.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` }, () => {
          load();
        })
        .subscribe();
    } catch (e) {
      console.warn('Dashboard realtime error', e);
    }

    return () => {
      mounted = false;
      try {
        if (certChannel) supabase.removeChannel(certChannel);
        if (profileChannel) supabase.removeChannel(profileChannel);
      } catch {}
    };
  }, [currentUser?.id, currentUser?.kr8_id]);

  if (!currentUser) {
    return (
      <div className="section-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-[#cabfe0]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const isFounder = currentUser.isFounder || currentUser.type === "founder";
  const isCoFounder = currentUser.isCoFounder || currentUser.type === "co-founder";
  let skill: any = null;
  try {
    skill = getSkill(currentUser.skill || '');
  } catch (e) {
    console.warn('getSkill error', e);
    skill = null;
  }
  const first = (currentUser.name || 'Student').split(" ")[0];
  const primaryCert = certs.find(c => c.status === 'active') || certs[0] || null;

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(currentUser.kr8_id || currentUser.id);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      }
    } catch {}
  };

  const executiveActions = [
    { icon: "lock" as const, label: "Administration", title: "Admin Portal", desc: "Manage students, certifications, tracks, and settings.", to: "/admin" },
    { icon: "calendar" as const, label: "Attendance", title: "Review Submissions", desc: "Open manual review queue for all tracks.", to: "/attendance-review" },
    { icon: "user" as const, label: "Profile", title: "Leadership Profile", desc: "View and edit your executive profile and portfolio.", to: "/academy" },
    { icon: "briefcase" as const, label: "Opportunities", title: "Agency Projects", desc: "Browse real client work shipped by graduate teams.", to: "/agency" },
    { icon: "bot" as const, label: "Creative AI", title: "KR8 AI Mentor", desc: "Access the creative mentor and AI workspace.", to: "/ai" },
    { icon: "fingerprint" as const, label: "Security", title: "Settings & Biometrics", desc: "Manage Touch ID / Fingerprint, password and privacy.", to: "/settings" },
  ];

  const currentActions = (isFounder || isCoFounder) ? executiveActions : actions;

  // Convert DbCertificate to legacy format for CertificateDocumentView compatibility
  const toLegacyCert = (c: DbCertificate) => ({
    id: c.id,
    code: c.certificate_code,
    certificate_code: c.certificate_code,
    studentId: c.student_id,
    kr8_id: c.kr8_id,
    studentName: c.student_name,
    formattedName: c.formatted_name || c.student_name?.toUpperCase(),
    skill: c.skill,
    skillName: c.skill_name,
    tier: c.tier as any,
    templateUrl: c.template_url,
    achievementText: c.achievement_text,
    additionalNotes: c.additional_notes,
    issuedAt: c.issued_at ? new Date(c.issued_at).getTime() : Date.now(),
    status: c.status as any,
  });

  let referralUrl = "";
  try {
    referralUrl = getReferralUrl(currentUser.kr8_id || currentUser.id);
  } catch {
    referralUrl = `https://www.kr8digitals.com/academy?ref=${encodeURIComponent(currentUser.kr8_id || currentUser.id)}`;
  }

  return (
    <div className="section-bg min-h-screen">
      <div className="mx-auto max-w-7xl px-5 py-12">
        {liveInfo?.isLive && (
          <div className="mb-8 overflow-hidden rounded-3xl border-2 border-red-500/70 bg-gradient-to-r from-red-600/25 via-pink-600/20 to-purple-800/30 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-3.5 w-3.5 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-red-400">🔴 WE'RE LIVE RIGHT NOW</span>
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">🌐 Open Stage</span>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-white mt-0.5">{liveInfo.title || "Live Session"}</h4>
                  <p className="text-xs text-[#cabfe0]">Hosted by {liveInfo.hostName || "KR8 Team"} · Live now</p>
                </div>
              </div>
              <Link
                to="/live"
                className="rounded-xl bg-gradient-pink px-5 py-2.5 text-xs font-bold text-white shadow-xl shadow-pink-500/30 hover:scale-105 active:scale-95 transition-all shrink-0"
              >
                Join Live Stream Stage →
              </Link>
            </div>
          </div>
        )}

        <div className="rise-in">
          <Pill className="inline-flex items-center gap-2">
            <span>
              {isFounder
                ? "KR8 Founder & CEO"
                : isCoFounder
                ? "KR8 Co-Founder"
                : currentUser.graduated
                ? `🎓 Certified Graduate · ${skill?.name ?? "Design"}`
                : currentUser.type === "tribe"
                ? "Tribe Member"
                : skill?.name ?? "Student"}
            </span>
            <span className="text-white/20">·</span>
            <button
              onClick={handleCopyId}
              type="button"
              title="Click to copy your KR8 ID"
              className="inline-flex items-center gap-1 font-mono text-pink-300 hover:text-white transition-colors"
            >
              <span>{currentUser.kr8_id || currentUser.id}</span>
              <span className="text-[10px] opacity-75">{copiedId ? "✓ Copied!" : "📋"}</span>
            </button>
          </Pill>
          <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
            {isFounder ? (
              <>Welcome back, <span className="text-gradient">Founder Timfire</span> 👑</>
            ) : isCoFounder ? (
              <>Welcome back, <span className="text-gradient">Co-Founder {first}</span> ⭐</>
            ) : (
              <>Welcome back, <span className="text-gradient">{first}</span> 👋</>
            )}
          </h1>

          {(currentUser.graduated || certs.length > 0) && !isFounder && !isCoFounder && (
            <div className="mt-6 overflow-hidden rounded-3xl border-2 border-green-500/50 bg-gradient-to-br from-green-950/40 via-[#0e1f13] to-purple-950/30 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
              <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
                <div className="flex-1 space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/15 px-3.5 py-1 text-xs font-bold text-green-300">
                    <span>🎓</span> OFFICIAL KR8 CERTIFIED GRADUATE - DB Verified
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                    Certificate of {currentUser.cert_tier || primaryCert?.tier || "Completion"} Earned!
                  </h3>
                  <p className="text-sm leading-relaxed text-[#d4c6e6] max-w-2xl">
                    Congratulations, <strong className="text-white">{currentUser.name}</strong>! You have successfully graduated from <strong className="text-white">{skill?.name || primaryCert?.skill_name || "Professional Track"}</strong> at KR8 Digitals. Your official credential is stored in DB, verifiable on any device.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      to="/academy"
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-pink px-6 py-2.5 text-xs font-bold text-white shadow-xl glow-pink-sm hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      <Icon name="certificate" size={14} /> Open Full Credential in Profile →
                    </Link>
                    {primaryCert && (
                      <button
                        onClick={() => {
                          try {
                            const legacy = toLegacyCert(primaryCert);
                            // @ts-ignore
                            downloadCertificatePdf(currentUser.name, null, legacy, { id: currentUser.kr8_id, name: currentUser.name });
                          } catch (e) {
                            console.warn('Download PDF error', e);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-5 py-2.5 text-xs font-bold text-pink-300 hover:bg-pink-500/20 transition-colors"
                      >
                        <Icon name="certificate" size={14} /> Download PDF
                      </button>
                    )}
                    {primaryCert && (
                      <button
                        onClick={() => setShareCert(primaryCert)}
                        className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-5 py-2.5 text-xs font-bold text-purple-300 hover:bg-purple-500/20 transition-colors"
                      >
                        <Icon name="share" size={14} /> Share Graduation Card →
                      </button>
                    )}
                    <Link
                      to={`/verify?id=${encodeURIComponent(currentUser.kr8_id || currentUser.id)}${primaryCert ? `&cert=${encodeURIComponent(primaryCert.certificate_code)}` : ''}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                    >
                      Public QR Verification Page ↗
                    </Link>
                  </div>
                  {primaryCert && (
                    <p className="text-[11px] text-[#8a7ba8] mt-2 font-mono">Code: {primaryCert.certificate_code} · Status: {primaryCert.status} · {primaryCert.email_sent_at ? `Emailed ${new Date(primaryCert.email_sent_at).toLocaleDateString()}` : 'Email pending'}</p>
                  )}
                </div>

                {primaryCert && (
                  <div className="w-full sm:w-80 shrink-0">
                    <Suspense fallback={<div className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />}>
                      <CertificateDocumentView
                        cert={toLegacyCert(primaryCert) as any}
                        student={{ id: currentUser.kr8_id, name: currentUser.name } as any}
                        maxHeight="220px"
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>
          )}

          {isFounder ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-pink-400/40 bg-gradient-to-r from-pink-500/15 via-[#1a0030] to-purple-600/15 p-4 shadow-xl">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>👑</span> Founder & CEO Executive Authority Active - Secure DB Role
                </p>
                <p className="text-xs text-[#cabfe0] mt-1">
                  You have full, unrestricted access via user_roles table. DB is source of truth.
                </p>
              </div>
              <Link
                to="/admin"
                className="rounded-full bg-gradient-pink px-5 py-2 text-xs font-bold text-white glow-pink-sm hover:scale-[1.02] transition-transform"
              >
                Open Admin Dashboard →
              </Link>
            </div>
          ) : isCoFounder ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-pink-400/40 bg-gradient-to-r from-pink-500/15 via-[#1a0030] to-purple-600/15 p-4 shadow-xl">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>⭐</span> Co-Founder Executive Access Active
                </p>
                <p className="text-xs text-[#cabfe0] mt-1">
                  You hold executive authority via secure roles. DB-first.
                </p>
              </div>
              <Link
                to="/admin"
                className="rounded-full bg-gradient-pink px-5 py-2 text-xs font-bold text-white glow-pink-sm hover:scale-[1.02] transition-transform"
              >
                Open Admin Dashboard →
              </Link>
            </div>
          ) : currentUser.isAdmin ? (
            <Link to="/admin" className="mt-4 block max-w-xl rounded-2xl border border-pink-400/30 bg-pink-500/5 px-4 py-3 text-sm leading-relaxed text-pink-100 hover:border-pink-300">
              You are recognized as staff ({currentUser.title || currentUser.roles?.[0]?.role}). Click here to open admin. Rights from user_roles table.
            </Link>
          ) : null}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { n: currentUser.attendance_accepted ?? 0, l: isFounder || isCoFounder ? "Attendance Sessions" : "Attendance Accepted" },
            { n: currentUser.submissions ?? 0, l: isFounder || isCoFounder ? "Assignments Reviewed" : "Assignments Submitted" },
            { n: isFounder ? "👑 Founder" : isCoFounder ? "⭐ Co-Founder" : currentUser.graduated ? "🎓 Certified" : rank ? `#${rank}` : "Student", l: "Leadership Status" },
            { n: currentUser.points ?? 0, l: "Points" },
            { n: currentUser.referrals ?? 0, l: "Referrals" },
          ].map((s) => (
            <Card key={s.l} className="!p-5 text-center">
              <div className="font-display text-3xl text-gradient">{s.n}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[#8a7ba8]">{s.l}</div>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {currentActions.map((a) => (
            <Link key={a.title} to={a.to} className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-pink-400/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-pink text-white"><Icon name={a.icon} size={22} /></div>
              <p className="text-[11px] uppercase tracking-wider text-pink-400">{a.label}</p>
              <h3 className="mt-1 text-lg font-bold text-white">{a.title}</h3>
              <p className="mt-2 text-sm text-[#b8aecf]">{a.desc}</p>
              <p className="mt-4 text-sm font-semibold text-pink-400 group-hover:translate-x-1">Go →</p>
            </Link>
          ))}
        </div>

        {currentUser.graduated && primaryCert && (
          <div className="mt-8 rounded-3xl border border-pink-500/40 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-blue-500/20 p-6 backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl shadow-pink-500/10">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-pink flex items-center justify-center text-white shrink-0 shadow-lg shadow-pink-500/30">
                <Icon name="certificate" size={24} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-300">Milestone Unlocked 🎓 DB Stored</span>
                <h3 className="text-lg font-bold text-white">Congratulations on Graduating!</h3>
                <p className="text-xs text-[#d1c4e9]">
                  Your verified Certificate {primaryCert.certificate_code} is active. Share anywhere!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setShareCert(primaryCert)}
                className="rounded-full bg-gradient-pink px-4 py-2 text-xs font-bold text-white shadow-md shadow-pink-500/30 hover:opacity-90 flex items-center gap-1.5"
              >
                <Icon name="share" size={14} /> Share Milestone
              </button>
              <Link
                to="/academy"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
              >
                View Certificate →
              </Link>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-pink-400 font-bold">Referral Program</p>
              <h3 className="mt-1 text-lg font-bold text-white">Your Personal KR8 Referral Link</h3>
              <p className="mt-1 text-xs text-[#b8aecf]">Share this link to invite fellow creatives and earn XP points.</p>
              <a href={referralUrl} className="mt-2 inline-block break-all rounded-lg bg-black/40 px-3 py-1.5 font-mono text-xs text-pink-300 underline underline-offset-2">
                {referralUrl}
              </a>
            </div>
            {currentUser.graduated && (
              <div className="sm:self-center shrink-0">
                <Link to="/academy" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-pink px-4 py-2 text-xs font-bold text-white glow-pink-sm">
                  <Icon name="certificate" size={14} /> View My Certificate →
                </Link>
              </div>
            )}
          </Card>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-display text-2xl font-bold text-white">Live in the Community</h2>
            <div className="mt-6"><LiveFeed /></div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Your Rank</h2>
            <div className="mt-6"><LeaderboardList limit={6} /></div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="font-display text-2xl font-bold text-white">Announcements</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {announcements.length > 0 ? announcements.map((a: any) => (
              <AnnouncementCard key={a.id} announcement={a} />
            )) : (
              <p className="text-xs text-[#8a7ba8]">No announcements yet. Check back soon.</p>
            )}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-[#8a7ba8]">
          Need help? Reach the team on WhatsApp: {CONTACT.phone} · DB-first, works on any device
        </p>

        {shareCert && (
          <GraduationShareModal
            isOpen={true}
            onClose={() => setShareCert(null)}
            cert={toLegacyCert(shareCert) as any}
            student={{ id: currentUser.kr8_id, name: currentUser.name } as any}
          />
        )}
      </div>
    </div>
  );
}
