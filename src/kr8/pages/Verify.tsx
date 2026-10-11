// @ts-nocheck
import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "../router-shim";
import {
  verifyId,
  getSkillName,
  type Account,
  type CertificateRecord,
} from "../data/store";
import { Pill, Card, GradientButton, Avatar } from "../components/ui";
import Icon from "../components/Icon";
import CertificateDocumentView from "../components/CertificateDocumentView";
import {
  downloadCertificateImage,
  downloadCertificatePdf,
} from "../utils/certificate";
import { useSeo } from "../lib/useSeo";
import { supabase } from "@/integrations/supabase/client";

export default function Verify() {
  useSeo({
    title: "Verify a KR8 ID or Certificate — Official Credential Check | KR8 Digitals",
    description:
      "Instantly verify any KR8 Digitals student ID, graduation certificate, or tribe member credential using our real-time database verification portal.",
    path: "/verify",
  });

  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const initialQuery = params.get("id") || params.get("cert") || params.get("code") || "";
  const initialCertParam = params.get("cert") || "";

  const [id, setId] = useState(initialQuery);
  const [certParam, setCertParam] = useState(initialCertParam);
  const [queried, setQueried] = useState(Boolean(initialQuery));
  const [loading, setLoading] = useState(Boolean(initialQuery));
  const [downloading, setDownloading] = useState(false);

  const [result, setResult] = useState<{
    ok: boolean;
    account?: Account & { skillName?: string };
    certificate?: CertificateRecord;
    certificates?: CertificateRecord[];
    remarks?: any[];
    isWithdrawn?: boolean;
    withdrawalReason?: string;
    withdrawnAt?: number;
  }>({ ok: false });

  const [selectedCert, setSelectedCert] = useState<CertificateRecord | undefined>(undefined);

  const performVerification = useCallback(async (rawQuery: string, rawCert?: string) => {
    const target = (rawCert || rawQuery || "").trim();
    if (!target) {
      setResult({ ok: false });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Primary: Query live server endpoint /api/verify (backed by supabaseAdmin across profiles, certificates, enrollments, verify_remarks)
      const res = await fetch(`/api/verify?code=${encodeURIComponent(target)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && (data.account || data.profile || data.certificate)) {
          const acc = data.account || data.profile;
          const cert = data.certificate || undefined;
          const certs = data.certificates || (cert ? [cert] : []);
          setResult({
            ok: true,
            account: acc,
            certificate: cert,
            certificates: certs,
            remarks: data.remarks || [],
            isWithdrawn: Boolean(data.isWithdrawn),
            withdrawalReason: data.withdrawalReason,
            withdrawnAt: data.withdrawnAt,
          });
          setSelectedCert(cert);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("[Verify] /api/verify fallback:", err);
    }

    // 2. Fallback: Direct Supabase RPCs (verify_certificate_public / get_profile_by_kr8_id)
    try {
      const cleanCode = target.trim().toUpperCase();
      if (cleanCode.startsWith("CERT-")) {
        const { data: certRows } = await supabase.rpc("verify_certificate_public", {
          p_code: cleanCode,
        });
        const row = Array.isArray(certRows) ? certRows[0] : certRows;
        if (row) {
          const mappedCert: CertificateRecord = {
            id: row.certificate_code,
            studentId: row.kr8_id,
            studentName: row.student_name,
            formattedName: row.formatted_name || String(row.student_name || "").toUpperCase(),
            skill: row.skill || "graphic",
            skillName: row.skill_name || getSkillName(row.skill),
            tier: row.tier === "Completion" ? "Completion" : "Professionalism",
            templateUrl: row.template_url || `/certificates/reusable_${String(row.tier || "professionalism").toLowerCase()}.png`,
            achievementText:
              row.achievement_text ||
              "demonstrating excellence and proficiency in turning client requests into client satisfaction.",
            additionalNotes: row.additional_notes || undefined,
            issuedAt: row.issued_at ? new Date(row.issued_at).getTime() : Date.now(),
            status: row.status === "withdrawn" ? "withdrawn" : "active",
            withdrawalReason: row.withdrawal_reason || undefined,
          };
          const mappedAcc: any = {
            id: row.kr8_id,
            type: "student",
            name: row.student_name,
            skill: row.skill || "graphic",
            skillName: row.skill_name || getSkillName(row.skill),
            graduated: row.status !== "withdrawn",
            certTier: mappedCert.tier,
            certRecognition: row.additional_notes,
            points: 250,
            attendanceAccepted: 12,
            submissions: 6,
            referrals: 0,
            year: 2026,
            joined: mappedCert.issuedAt,
            avatar: row.student_avatar || "",
          };
          setResult({
            ok: true,
            account: mappedAcc,
            certificate: mappedCert,
            certificates: [mappedCert],
            isWithdrawn: mappedCert.status === "withdrawn",
            withdrawalReason: mappedCert.withdrawalReason,
          });
          setSelectedCert(mappedCert);
          setLoading(false);
          return;
        }
      } else {
        const { data: profRows } = await supabase.rpc("get_profile_by_kr8_id", {
          p_kr8_id: cleanCode,
        });
        const prof = Array.isArray(profRows) ? profRows[0] : profRows;
        if (prof) {
          const mappedAcc: any = {
            id: prof.kr8_id,
            type: "student",
            name: prof.name,
            skill: prof.skill || "graphic",
            skillName: getSkillName(prof.skill),
            graduated: Boolean(prof.graduated),
            certTier: prof.cert_tier || (prof.graduated ? "Professionalism" : null),
            certRecognition: prof.cert_recognition || undefined,
            verifyRemark: prof.verify_remark || undefined,
            points: Number(prof.points || 0),
            attendanceAccepted: Number(prof.attendance_accepted || 0),
            submissions: Number(prof.submissions || 0),
            referrals: Number(prof.referrals || 0),
            year: prof.cohort_year || 2026,
            joined: prof.created_at ? new Date(prof.created_at).getTime() : Date.now(),
            avatar: prof.avatar || "",
            bio: prof.bio || undefined,
          };
          setResult({
            ok: true,
            account: mappedAcc,
            certificate: undefined,
            certificates: [],
            isWithdrawn: false,
          });
          setSelectedCert(undefined);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // 3. Local store fallback
    const localRes = verifyId(rawQuery, rawCert);
    if (localRes.ok && localRes.account) {
      setResult(localRes);
      setSelectedCert(localRes.certificate);
    } else {
      setResult({ ok: false });
      setSelectedCert(undefined);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(loc.search);
    const q = p.get("id") || p.get("cert") || p.get("code") || "";
    const c = p.get("cert") || "";
    if (q) {
      setId(q);
      setCertParam(c);
      setQueried(true);
      performVerification(q, c);
    }
  }, [loc.search, performVerification]);

  const activeCert = selectedCert || result.certificate;
  const student = result.account;
  const allCerts = result.certificates || [];

  const isCertWithdrawn = activeCert
    ? activeCert.status === "withdrawn"
    : Boolean(result.isWithdrawn);
  const withdrawalReason = activeCert?.withdrawalReason || result.withdrawalReason;
  const withdrawnAt = activeCert?.withdrawnAt || result.withdrawnAt;

  const verifyUrl =
    typeof window !== "undefined" && student
      ? `${window.location.origin}/verify?id=${encodeURIComponent(student.id)}${
          activeCert ? `&cert=${encodeURIComponent(activeCert.id)}` : ""
        }`
      : "";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCertParam("");
    setSelectedCert(undefined);
    setQueried(true);
    performVerification(id.trim());
  };

  const handleDownloadImage = async () => {
    if (!activeCert || isCertWithdrawn) return;
    setDownloading(true);
    try {
      await downloadCertificateImage(student?.name || activeCert.studentName, activeCert, student);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!activeCert || isCertWithdrawn) return;
    setDownloading(true);
    try {
      await downloadCertificatePdf(student?.name || activeCert.studentName, null, activeCert, student);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="section-bg min-h-screen">
      <div className="mx-auto max-w-4xl px-5 py-16">
        <div className="text-center">
          <Pill>Official Credential & Identity Verification</Pill>
          <h1 className="font-display mt-5 text-4xl text-white sm:text-5xl font-bold">
            Verify a <span className="text-gradient">KR8 ID</span> or Certificate
          </h1>
          <p className="mt-3 text-[#b8aecf] max-w-xl mx-auto text-sm sm:text-base">
            Enter a student's KR8 ID, Certificate Reference ID, or scan the QR code on any KR8 Digitals certificate to verify live database credentials.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mt-10 flex flex-col gap-3 sm:flex-row">
          <input
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setCertParam("");
              setSelectedCert(undefined);
            }}
            placeholder="e.g. KR82026... or CERT-KR8-..."
            className="flex-1 rounded-full border border-white/20 bg-white/5 px-6 py-4 font-mono text-sm text-white placeholder-[#7a6b94] focus:border-pink-400 focus:outline-none"
          />
          <GradientButton type="submit" disabled={loading}>
            {loading ? "Verifying Database..." : "Verify Credential →"}
          </GradientButton>
        </form>

        {queried && (
          <div className="mt-10">
            {loading ? (
              <Card className="text-center py-12 border-pink-500/30">
                <div className="mx-auto h-10 w-10 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
                <p className="mt-4 text-sm font-semibold text-white">
                  Checking KR8 Digitals live database...
                </p>
              </Card>
            ) : !result.ok || !student ? (
              <Card className="border-red-400/30 text-center py-10">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-300">
                  <Icon name="close" size={26} />
                </div>
                <h3 className="mt-4 text-xl font-bold text-white">No Record Found</h3>
                <p className="mt-2 text-sm text-[#b8aecf] max-w-md mx-auto">
                  No student, graduate, or certificate matches{" "}
                  <span className="font-mono text-white">{id}</span>. Double-check the ID or certificate reference and try again.
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* 1. OFFICIAL VERIFICATION STATUS BANNER */}
                {isCertWithdrawn ? (
                  <div className="rounded-3xl border-2 border-red-500/60 bg-gradient-to-br from-red-950/80 via-[#220615] to-[#12001c] p-6 sm:p-8 shadow-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400">
                        <Icon name="close" size={28} />
                      </div>
                      <div className="flex-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-red-300">
                          ⚠️ Certificate Status: Withdrawn
                        </span>
                        <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-white">
                          This Certificate Has Been Officially Withdrawn
                        </h2>
                        <p className="mt-1 text-xs sm:text-sm text-red-200/80">
                          Holder: <strong className="text-white">{student.name}</strong> · ID:{" "}
                          <span className="font-mono text-white">{student.id}</span>
                          {activeCert && (
                            <>
                              {" "}
                              · Cert Ref: <span className="font-mono text-white">{activeCert.id}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-red-500/30 bg-black/40 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-red-400">
                        Official Withdrawal Reason (Recorded by KR8 Administration)
                      </p>
                      <p className="mt-1.5 text-sm text-white leading-relaxed">
                        "{withdrawalReason || "Administrative compliance review."}"
                      </p>
                      {withdrawnAt && (
                        <p className="mt-2 text-[11px] text-[#9c8cb9]">
                          Withdrawn on:{" "}
                          {new Date(withdrawnAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Card className="border-pink-400/40 p-6 sm:p-8">
                    <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                      <Avatar src={student.avatar} name={student.name} size={76} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill>
                            {student.type === "founder"
                              ? "✓ Official Verified Founder & CEO"
                              : student.type === "co-founder"
                              ? "✓ Official Verified Co-Founder"
                              : student.type === "tribe"
                              ? "✓ Verified KR8 Tribe Community Member"
                              : activeCert || student.graduated
                              ? "✓ Official Verified Credential"
                              : "✓ Verified KR8 Academy Scholar"}
                          </Pill>
                          {student.type === "founder" && (
                            <span className="rounded-full bg-gradient-to-r from-amber-500 to-pink-500 px-3 py-1 text-xs font-extrabold text-white shadow-md">
                              👑 Founder & CEO
                            </span>
                          )}
                          {student.type === "co-founder" && (
                            <span className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs font-extrabold text-white shadow-md">
                              ⭐ Co-Founder
                            </span>
                          )}
                          {(activeCert || student.graduated) && (
                            <span className="rounded-full bg-gradient-pink px-3 py-1 text-xs font-bold text-white shadow-sm">
                              {activeCert
                                ? `Certificate of ${activeCert.tier}`
                                : student.certTier
                                ? `Certificate of ${student.certTier}`
                                : "Certified Graduate"}
                            </span>
                          )}
                          {!activeCert && !student.graduated && student.type === "student" && (
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                              Active Student in Training
                            </span>
                          )}
                          {student.multiSkillCount && student.multiSkillCount > 1 && (
                            <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-xs font-bold text-amber-300">
                              ⚡ Multi-Skill ({student.multiSkillCount} Tracks)
                            </span>
                          )}
                        </div>
                        <h2 className="font-display mt-3 text-2xl sm:text-3xl font-bold text-white">
                          {activeCert ? activeCert.studentName : student.name}
                        </h2>
                        <p className="font-mono text-xs sm:text-sm text-pink-300 mt-0.5 break-all">
                          KR8 ID: {student.id}
                          {activeCert && (
                            <span className="text-[#a594c7]"> · Cert Ref: {activeCert.id}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-white/10 pt-6 text-sm">
                      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5">
                        <p className="text-[11px] uppercase tracking-wider text-[#8a7ba8]">
                          {student.type === "founder" || student.type === "co-founder"
                            ? "Executive Role"
                            : student.type === "tribe"
                            ? "Membership"
                            : "Skill Track"}
                        </p>
                        <p className="mt-1 font-bold text-white">
                          {student.type === "founder"
                            ? "Founder & CEO"
                            : student.type === "co-founder"
                            ? student.title || "Co-Founder"
                            : student.type === "tribe"
                            ? "KR8 Creative Tribe"
                            : activeCert
                            ? activeCert.skillName
                            : student.skillName || getSkillName(student.skill)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5">
                        <p className="text-[11px] uppercase tracking-wider text-[#8a7ba8]">
                          Credential Status
                        </p>
                        <p className="mt-1 font-bold text-emerald-400">
                          {student.type === "founder" || student.type === "co-founder"
                            ? "Active Leadership"
                            : activeCert || student.graduated
                            ? `Graduated (${activeCert?.tier || student.certTier || "Professionalism"})`
                            : student.type === "tribe"
                            ? "Verified Tribe Member"
                            : "Enrolled · Active Cohort"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5">
                        <p className="text-[11px] uppercase tracking-wider text-[#8a7ba8]">
                          Cohort & XP Score
                        </p>
                        <p className="mt-1 font-bold text-white">
                          {student.year || 2026} Cohort ·{" "}
                          <span className="text-pink-400">{student.points || 0} XP</span>
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5">
                        <p className="text-[11px] uppercase tracking-wider text-[#8a7ba8]">
                          {activeCert ? "Date Issued" : "Date Joined"}
                        </p>
                        <p className="mt-1 font-bold text-white">
                          {new Date(activeCert?.issuedAt || student.joined || Date.now()).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Additional Notes / Recognition / Team Remarks */}
                    {(activeCert?.additionalNotes ||
                      student.certRecognition ||
                      student.verifyRemark ||
                      (result.remarks && result.remarks.length > 0)) && (
                      <div className="mt-5 rounded-2xl border border-pink-400/30 bg-pink-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-pink-300">
                          ⭐ Official Commendation & Remarks from KR8 Team
                        </p>
                        {activeCert?.additionalNotes && (
                          <p className="mt-1 text-sm text-white font-medium">
                            "{activeCert.additionalNotes}"
                          </p>
                        )}
                        {!activeCert?.additionalNotes && student.certRecognition && (
                          <p className="mt-1 text-sm text-white font-medium">
                            "{student.certRecognition}"
                          </p>
                        )}
                        {student.verifyRemark &&
                          student.verifyRemark !== activeCert?.additionalNotes &&
                          student.verifyRemark !== student.certRecognition && (
                            <p className="mt-1 text-sm text-[#e5d4f7]">{student.verifyRemark}</p>
                          )}
                      </div>
                    )}
                  </Card>
                )}

                {/* 2. INTERACTIVE CERTIFICATE PREVIEW & DOWNLOADS */}
                {activeCert && !isCertWithdrawn && (
                  <Card className="p-5 sm:p-8 border-white/15">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400">
                          Official Graduation Document
                        </span>
                        <h3 className="font-display text-xl font-bold text-white mt-0.5">
                          Certificate of {activeCert.tier} — {activeCert.skillName}
                        </h3>
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          disabled={downloading}
                          onClick={handleDownloadImage}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/15 transition cursor-pointer disabled:opacity-50"
                        >
                          <span>{downloading ? "Rendering..." : "Download Image (PNG) ↓"}</span>
                        </button>
                        <button
                          type="button"
                          disabled={downloading}
                          onClick={handleDownloadPdf}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-pink px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-pink-500/20 hover:opacity-95 transition cursor-pointer disabled:opacity-50"
                        >
                          <span>{downloading ? "Preparing PDF..." : "Download PDF →"}</span>
                        </button>
                      </div>
                    </div>

                    <CertificateDocumentView cert={activeCert} verifyUrl={verifyUrl} />
                  </Card>
                )}

                {/* 3. MULTI-CERTIFICATE HISTORY (If student holds multiple certificates) */}
                {allCerts.length > 1 && (
                  <Card className="p-5 sm:p-6">
                    <h4 className="font-bold text-white text-sm uppercase tracking-wider">
                      All Credentials Issued to {student.name} ({allCerts.length})
                    </h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {allCerts.map((c) => {
                        const isSelected = activeCert?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCert(c)}
                            className={`flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                              isSelected
                                ? "border-pink-500 bg-pink-500/15"
                                : "border-white/10 bg-white/[0.03] hover:border-white/25"
                            }`}
                          >
                            <div>
                              <p className="text-xs font-bold text-white">
                                {c.skillName} · {c.tier}
                              </p>
                              <p className="font-mono text-[11px] text-[#a594c7] mt-0.5">{c.id}</p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                c.status === "active"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-red-500/20 text-red-300"
                              }`}
                            >
                              {c.status}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* 4. DYNAMIC CONVERSION CALL-TO-ACTION */}
                <div className="relative overflow-hidden rounded-3xl border border-pink-500/30 bg-gradient-to-br from-[#200536] via-[#120021] to-[#0b0014] p-6 sm:p-9 shadow-2xl">
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-xl">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/20 border border-pink-500/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-pink-300">
                        ⚡ Inspired by {student.name.split(" ")[0]}'s Journey?
                      </span>
                      <h3 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
                        Master{" "}
                        <span className="text-gradient">
                          {activeCert ? activeCert.skillName : getSkillName(student.skill)}
                        </span>{" "}
                        for Free — Or Hire KR8 Digitals to Build for Your Brand.
                      </h3>
                      <p className="mt-2.5 text-xs sm:text-sm text-[#cabfe0] leading-relaxed">
                        KR8 Digitals trains talented creators 100% tuition-free and delivers world-class branding, web engineering, and video production for ambitious businesses.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
                      <Link
                        to="/register"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-pink px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-pink-500/25 hover:scale-[1.02] transition-transform text-center"
                      >
                        <span>Enroll in a Free Track →</span>
                      </Link>
                      <Link
                        to="/agency#hire"
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-xs sm:text-sm font-bold text-white hover:bg-white/10 hover:border-pink-400/40 transition-colors text-center"
                      >
                        <span>Hire KR8 Agency ↗</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
