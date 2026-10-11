// Public identity and certificate verification through privacy-safe Supabase RPCs.
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "../router-shim";
import type { Account, CertificateRecord, CertificateTier } from "../data/store";
import { Pill, GradientButton, Card, Avatar } from "../components/ui";
import { useSeo } from "../lib/useSeo";
import { supabase } from "@/integrations/supabase/client";
import CertificateDocumentView from "../components/CertificateDocumentView";
import { downloadCertificatePdf, downloadCertificateImage } from "../utils/certificate";

type PublicProfile = {
  kr8_id: string;
  name: string;
  skill: string | null;
  graduated: boolean;
  cert_tier: string | null;
  joined: string | null;
  total_points: number;
  points: number;
  attendance_accepted: number;
  submissions: number;
  referrals: number;
  double_skill: boolean;
  graduation_score: number;
  graduation_comment: string | null;
  avatar: string | null;
};

type PublicCertificate = CertificateRecord & {
  certificate_code: string;
  kr8_id: string;
  student_id: string;
  student_name: string;
  skill_name: string | null;
  issued_at: string | null;
  achievement_text: string | null;
  additional_notes: string | null;
  is_valid: boolean;
  verification_status: string;
};

type VerifyResult =
  | { ok: false; error: string }
  | { ok: true; profile: PublicProfile; certificate: PublicCertificate | null };

type PublicCertificateRow = {
  certificate_code: string;
  kr8_id: string;
  student_name: string;
  skill: string;
  skill_name: string | null;
  tier: string;
  status: string;
  issued_at: string | null;
  achievement_text: string | null;
  additional_notes: string | null;
  is_valid: boolean;
};

function mapCertificate(row: PublicCertificateRow): PublicCertificate {
  return {
    id: row.certificate_code,
    studentId: row.kr8_id,
    studentName: row.student_name,
    formattedName: row.student_name,
    skill: row.skill,
    skillName: row.skill_name || row.skill,
    tier: row.tier as CertificateTier,
    templateUrl: "/certificates/reusable_completion.png",
    achievementText: row.achievement_text || "",
    ...(row.additional_notes ? { additionalNotes: row.additional_notes } : {}),
    issuedAt: row.issued_at ? Date.parse(row.issued_at) : Date.now(),
    status: row.status === "active" ? "active" : "withdrawn",
    certificate_code: row.certificate_code,
    kr8_id: row.kr8_id,
    student_id: row.kr8_id,
    student_name: row.student_name,
    skill_name: row.skill_name,
    issued_at: row.issued_at,
    achievement_text: row.achievement_text,
    additional_notes: row.additional_notes,
    is_valid: row.is_valid,
    verification_status: row.status,
  };
}

function profileFromCertificate(certificate: PublicCertificate): PublicProfile {
  return {
    kr8_id: certificate.kr8_id,
    name: certificate.student_name,
    skill: certificate.skill,
    graduated: certificate.is_valid,
    cert_tier: certificate.tier,
    joined: certificate.issued_at,
    total_points: 0,
    points: 0,
    attendance_accepted: 0,
    submissions: 0,
    referrals: 0,
    double_skill: false,
    graduation_score: 0,
    graduation_comment: certificate.additional_notes || certificate.achievement_text,
    avatar: null,
  };
}

function toCertificateStudent(profile: PublicProfile): Account {
  return {
    type: "student",
    id: profile.kr8_id,
    name: profile.name,
    email: "",
    phone: "",
    ...(profile.skill ? { skill: profile.skill } : {}),
    vip: false,
    points: profile.points,
    attendanceAccepted: profile.attendance_accepted,
    submissions: profile.submissions,
    referrals: profile.referrals,
    graduated: profile.graduated,
    certTier: (profile.cert_tier as CertificateTier | null) || null,
    avatar: profile.avatar || "",
    joined: profile.joined ? Date.parse(profile.joined) : Date.now(),
  };
}

export default function Verify() {
  useSeo({ path: "/verify", title: "Verify KR8 ID & Certificate — KR8 Digitals" });
  const [searchParams] = useSearchParams();
  const initial = searchParams.get("id") || searchParams.get("kr8_id") || searchParams.get("cert") || "";
  const [query, setQuery] = useState(initial);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCert, setShowCert] = useState(false);

  useEffect(() => {
    if (initial) void handleVerify(initial);
  }, []);

  const handleVerify = async (raw?: string) => {
    const lookup = (raw || query).trim();
    if (!lookup) return;
    setLoading(true);
    setResult(null);
    setShowCert(false);

    try {
      const normalizedLookup = lookup.toUpperCase();
      const { data: certificateRows, error: certificateError } = await supabase.rpc(
        "verify_certificate_public",
        { cert_code: normalizedLookup },
      );
      if (certificateError) throw certificateError;

      const certificateRow = (certificateRows?.[0] || null) as PublicCertificateRow | null;
      const certificate = certificateRow ? mapCertificate(certificateRow) : null;
      const profileLookup = certificate?.kr8_id || normalizedLookup;
      const { data: profileRows, error: profileError } = await supabase.rpc(
        "get_public_profile_verification",
        { lookup_id: profileLookup },
      );
      if (profileError) throw profileError;

      const profile = ((profileRows?.[0] || null) as PublicProfile | null)
        || (certificate ? profileFromCertificate(certificate) : null);

      if (!profile && !certificate) {
        setResult({ ok: false, error: `No public record found for "${lookup}". Enter an exact KR8 ID or certificate code.` });
      } else if (profile) {
        setResult({ ok: true, profile, certificate });
      } else {
        setResult({ ok: false, error: "The certificate was found, but its public profile is unavailable." });
      }
    } catch (error) {
      console.error("Public verification failed:", error);
      setResult({ ok: false, error: "Verification is temporarily unavailable. Please try again shortly." });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleVerify();
  };

  return (
    <div className="section-bg min-h-[90vh] py-12 px-5">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-8">
          <Pill>Live Database Verification · Privacy-Safe</Pill>
          <h1 className="font-display mt-4 text-3xl sm:text-5xl font-black text-white">Verify <span className="text-gradient">KR8 Identity</span></h1>
          <p className="mt-3 text-sm text-[#cabfe0]">Enter a KR8 ID or certificate code. Verification uses public-safe database functions and never exposes contact details.</p>
        </div>

        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input type="text" placeholder="e.g. KR82026KT0001GDVFD or CERT-XXXX" className="flex-1 rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none" value={query} onChange={event => setQuery(event.target.value)} />
            <GradientButton type="submit" disabled={loading} className="px-6 py-3 text-sm font-bold disabled:opacity-50">{loading ? "Verifying..." : "Verify →"}</GradientButton>
          </form>

          {result && !result.ok && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
              <p className="font-bold">✕ Not Found</p>
              <p className="mt-1 text-xs opacity-80">{result.error}</p>
              <p className="mt-3 text-[11px] text-red-300">Check the ID or certificate code and try again. Public verification does not accept email addresses.</p>
            </div>
          )}

          {result?.ok && (
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-6">
                <div className="flex items-start gap-4">
                  <Avatar {...(result.profile.avatar ? { src: result.profile.avatar } : {})} name={result.profile.name} size={56} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white flex flex-wrap items-center gap-2">
                      ✓ Verified — {result.profile.name}
                      <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">PUBLIC RECORD</span>
                    </h3>
                    <p className="text-xs text-[#cabfe0] mt-1">KR8 ID <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">{result.profile.kr8_id}</span> • Skill: <span className="font-bold text-white">{result.profile.skill || "—"}</span></p>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="rounded-xl bg-black/30 border border-white/10 p-2.5"><p className="text-[#8a7ba8]">Status</p><p className="font-bold text-white capitalize">{result.profile.graduated ? "graduated" : "active"}</p></div>
                      <div className="rounded-xl bg-black/30 border border-white/10 p-2.5"><p className="text-[#8a7ba8]">Points</p><p className="font-bold text-white">{result.profile.total_points || result.profile.points} XP</p></div>
                      <div className="rounded-xl bg-black/30 border border-white/10 p-2.5"><p className="text-[#8a7ba8]">Attendance</p><p className="font-bold text-white">{result.profile.attendance_accepted}</p></div>
                      <div className="rounded-xl bg-black/30 border border-white/10 p-2.5"><p className="text-[#8a7ba8]">Tier</p><p className="font-bold text-white capitalize">{result.certificate?.tier || result.profile.cert_tier || "—"}</p></div>
                    </div>
                    {result.profile.double_skill && <p className="mt-2 text-xs text-amber-200">🎯 Double Skill achievement (+50 bonus)</p>}
                    {result.certificate && (
                      <div className="mt-3 rounded-xl bg-white/[0.04] border border-white/10 p-3">
                        <p className="text-[11px] font-bold text-white">Certificate {result.certificate.certificate_code}</p>
                        <p className="text-[11px] text-[#8a7ba8] mt-1">
                          {result.certificate.is_valid ? "Valid and active" : `Status: ${result.certificate.verification_status}`}
                          {result.certificate.issued_at ? ` • Issued: ${new Date(result.certificate.issued_at).toLocaleDateString()}` : ""}
                          {result.certificate.achievement_text || result.certificate.additional_notes || result.profile.graduation_comment
                            ? ` • ${result.certificate.achievement_text || result.certificate.additional_notes || result.profile.graduation_comment}`
                            : ""}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {result.certificate && !result.certificate.is_valid && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
                  This certificate is {result.certificate.verification_status}. Certificate previews and downloads are disabled for inactive records.
                </div>
              )}

              {result.certificate?.is_valid && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-white">Graduation Certificate</h4>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => setShowCert(!showCert)} className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/10">{showCert ? "Hide" : "View Certificate"}</button>
                      <button
                        type="button"
                        onClick={() => void downloadCertificatePdf(
                          result.profile.name || result.certificate!.student_name || "Creator",
                          null,
                          result.certificate!,
                          toCertificateStudent(result.profile),
                        )}
                        className="rounded-full bg-gradient-pink px-3 py-1.5 text-[11px] font-bold text-white"
                      >
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadCertificateImage(
                          result.profile.name || result.certificate!.student_name || "Creator",
                          result.certificate!,
                          toCertificateStudent(result.profile),
                        )}
                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white"
                      >
                        Image
                      </button>
                    </div>
                  </div>
                  {showCert && (
                    <div className="mt-4">
                      <CertificateDocumentView cert={result.certificate!} student={toCertificateStudent(result.profile)} />
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-center gap-3">
                <Link to="/leaderboard" className="text-xs text-pink-400 hover:text-pink-300 underline">Check Leaderboard Ranking →</Link>
                <Link to="/" className="text-xs text-[#8a7ba8] hover:text-white underline">Home</Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
