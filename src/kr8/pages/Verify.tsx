// Secure Verify Page - uses /api/verify with RPCs, no direct RLS-blocked queries
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "../router-shim";
import { getSkill } from "../data/store";
import { Pill, GradientButton, Card, Avatar } from "../components/ui";
import Icon from "../components/Icon";
import { useSeo } from "../lib/useSeo";
import CertificateDocumentView from "../components/CertificateDocumentView";
import { downloadCertificatePdf, downloadCertificateImage } from "../utils/certificate";
import { supabase } from "@/integrations/supabase/client";

type VerificationResult = {
  ok: boolean;
  account?: any;
  certificate?: any;
  certificates?: any[];
  isWithdrawn?: boolean;
  withdrawalReason?: string;
  withdrawnAt?: number;
  type?: 'certificate' | 'in_training' | 'graduated';
  message?: string;
};

const CODE_REGEX = /^[A-Za-z0-9_-]{6,64}$/;

export default function Verify() {
  useSeo({
    title: "Verify Student Credentials | KR8 Digitals Verification Portal",
    description: "Public verification portal for KR8 Digitals: check any student's official ID or certificate, standing status, and verifiable QR credentials in real time. Works on any device.",
    path: "/verify",
  });
  const [searchParams] = useSearchParams();
  const [id, setId] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState<any[]>([]);

  useEffect(() => {
    const queryId = searchParams.get("id")?.trim() || "";
    const queryCert = searchParams.get("cert")?.trim() || "";
    const code = queryCert || queryId;
    if (code) {
      setId(code);
      lookup(code);
    }
  }, [searchParams]);

  useEffect(() => {
    if (result?.ok && result.account) {
      const studentName = result.account.name;
      const certTier = result.certificate?.tier || "Completion";
      const skillName = result.certificate?.skill_name || result.certificate?.skillName || (result.account.skill ? getSkill(result.account.skill)?.name : "Creative Track");
      document.title = `Verified: Certificate of ${certTier} — ${studentName} | KR8 Digitals`;
    } else {
      document.title = "Verify Student Credentials | KR8 Digitals Verification Portal";
    }
  }, [result]);

  const lookup = async (searchQuery?: string) => {
    const target = (searchQuery || id).trim();
    if (!target) return;
    if (!CODE_REGEX.test(target)) {
      setSearched(true);
      setResult({ ok: false } as any);
      return;
    }
    setSearched(true);
    setLoading(true);

    try {
      // Use /api/verify which uses secure RPCs verify_certificate_public and get_profile_by_kr8_id
      // No direct certificates/profiles query from browser (RLS blocks anon)
      const res = await fetch(`/api/verify?code=${encodeURIComponent(target)}`);
      const json = await res.json();

      if (json.valid) {
        if (json.certificate) {
          const cert = json.certificate;
          const certRecord = {
            id: cert.certificate_code,
            studentId: cert.kr8_id,
            studentName: cert.student_name,
            formattedName: cert.student_name?.toUpperCase(),
            skill: cert.skill,
            skillName: cert.skill_name || cert.skill,
            tier: cert.tier,
            templateUrl: null,
            achievementText: cert.achievement_text,
            additionalNotes: cert.additional_notes,
            issuedAt: cert.issued_at ? new Date(cert.issued_at).getTime() : Date.now(),
            status: cert.status,
          };

          // If profile also returned or need to fetch via same API for profile
          let account: any = null;
          if (json.profile) {
            account = {
              id: json.profile.kr8_id,
              kr8_id: json.profile.kr8_id,
              name: json.profile.name,
              skill: json.profile.skill,
              avatar: null,
              graduated: json.profile.graduated,
              certTier: json.profile.cert_tier,
              type: 'student',
            };
          } else {
            // Try to get profile via same API using kr8_id from cert
            try {
              const profileRes = await fetch(`/api/verify?code=${encodeURIComponent(cert.kr8_id)}`);
              const profileJson = await profileRes.json();
              if (profileJson.valid && profileJson.profile) {
                account = {
                  id: profileJson.profile.kr8_id,
                  kr8_id: profileJson.profile.kr8_id,
                  name: profileJson.profile.name,
                  skill: profileJson.profile.skill,
                  avatar: null,
                  graduated: profileJson.profile.graduated,
                  certTier: profileJson.profile.cert_tier,
                  type: 'student',
                };
              } else {
                account = {
                  id: cert.kr8_id,
                  kr8_id: cert.kr8_id,
                  name: cert.student_name,
                  skill: cert.skill,
                  avatar: null,
                  graduated: true,
                  certTier: cert.tier,
                  type: 'student',
                };
              }
            } catch {
              account = {
                id: cert.kr8_id,
                kr8_id: cert.kr8_id,
                name: cert.student_name,
                skill: cert.skill,
                avatar: null,
                graduated: true,
                certTier: cert.tier,
                type: 'student',
              };
            }
          }

          setResult({
            ok: true,
            account,
            certificate: certRecord,
            certificates: [certRecord],
            type: 'certificate',
          });
        } else if (json.profile) {
          const profile = json.profile;
          const account = {
            id: profile.kr8_id,
            kr8_id: profile.kr8_id,
            name: profile.name,
            skill: profile.skill,
            avatar: null,
            graduated: profile.graduated,
            certTier: profile.cert_tier,
            joined: profile.joined ? new Date(profile.joined).getTime() : Date.now(),
            type: 'student',
          };

          setResult({
            ok: true,
            account,
            type: json.type || (profile.graduated ? 'graduated' : 'in_training'),
            message: json.message,
          });
        } else {
          setResult({ ok: false } as any);
        }
      } else {
        setResult({ ok: false } as any);
      }

      // Fetch verify_remarks for this target (student or certificate) visible_public
      try {
        const { data: rem } = await supabase.from('verify_remarks').select('id,remark,target_type,target_id,visible_public,created_at').eq('visible_public', true).or(`target_id.eq.${target},target_id.eq.${target.toUpperCase()}`).limit(10);
        if (rem) setRemarks(rem);
        else setRemarks([]);
      } catch { setRemarks([]); }
    } catch (err) {
      console.error('Verify error:', err);
      setResult({ ok: false } as any);
    } finally {
      setLoading(false);
    }
  };

  const activeCert = result?.certificate;
  const isWithdrawn = result?.isWithdrawn || activeCert?.status === "withdrawn";
  const skill = result?.account ? getSkill(activeCert?.skill || result.account.skill) : null;
  const allCerts = result?.certificates || [];
  const isInTraining = result?.type === 'in_training';

  return (
    <div className="section-bg min-h-screen">
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500/25 via-purple-500/15 to-transparent p-2 border border-pink-500/40 shadow-2xl shadow-pink-500/30">
              <img src="/branding/kr8_logo.png" alt="KR8 Digitals Logo" className="h-full w-full object-contain" />
            </div>
          </div>
          <Pill>Official KR8 Verification Portal - Works Anywhere</Pill>
          <h1 className="font-display mt-5 text-4xl text-white sm:text-5xl">
            Confirm a <span className="text-gradient">KR8 Identity.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[#b8aecf]">
            Paste any student ID or scan an issued certificate QR code to confirm official credentials. Verified from database on any device.
          </p>
        </div>

        <Card className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="e.g. KR82026KT0001GDVFD or CERT-KR8-..."
              className="flex-1 rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#6f6390] focus:border-pink-400/60 focus:outline-none"
            />
            <GradientButton onClick={() => lookup()} disabled={loading}>
              {loading ? "Verifying..." : "Verify →"}
            </GradientButton>
          </div>
          <p className="mt-3 text-[11px] text-[#8a7ba8] text-center">
            ✓ Database-verified via secure RPC · Works on phone, laptop, private window · No login required
          </p>
        </Card>

        {searched && result && (
          <div className="mt-6">
            {!result.ok || !result.account ? (
              <Card className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                  <Icon name="alert" size={24} />
                </div>
                <h3 className="text-lg font-bold text-white">This credential could not be verified</h3>
                <p className="mt-2 text-sm text-[#b8aecf]">
                  No active student profile or certificate record matches <strong className="text-white font-mono">{id}</strong>.
                </p>
                <p className="mt-3 text-[11px] text-[#8a7ba8]">Verification uses secure RPCs and works on any device. Code must be 6-64 alphanumeric, dash or underscore.</p>
              </Card>
            ) : isInTraining ? (
              <Card className="border-blue-500/30 bg-blue-950/20">
                <div className="mb-4 rounded-xl border border-blue-500/40 bg-blue-500/10 p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
                      <Icon name="book" size={18} />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-blue-300">✓ Verified KR8 Academy Scholar - In Training</h4>
                      <p className="text-xs text-[#b8aecf]">Currently enrolled, not yet graduated. Public details shown.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Avatar src={result.account.avatar} name={result.account.name} size={64} />
                  <div>
                    <h3 className="text-xl font-bold text-white">{result.account.name}</h3>
                    <p className="font-mono text-xs text-pink-400">{result.account.kr8_id}</p>
                  </div>
                  <span className="ml-auto rounded-full bg-blue-500/20 border border-blue-500/40 px-3 py-1 text-xs font-bold text-blue-300">In Training</span>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl p-4 bg-black/20">
                    <p className="text-[11px] uppercase tracking-wider text-[#8a7ba8]">Discipline</p>
                    <p className="mt-1 text-sm font-semibold text-white">{skill?.name ?? result.account.skill ?? "Creative Track"}</p>
                  </div>
                  <div className="rounded-2xl p-4 border border-blue-500/30 bg-blue-500/10">
                    <p className="text-[11px] uppercase tracking-wider text-[#8a7ba8]">Standing</p>
                    <p className="mt-1 text-sm font-semibold text-blue-300">In Training · Active Student</p>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className={isWithdrawn ? "border-amber-500/50 bg-amber-950/20" : ""}>
                {isWithdrawn ? (
                  <div className="mb-6 rounded-2xl border-2 border-amber-500/60 bg-amber-500/15 p-5">
                    <h4 className="text-base font-bold text-amber-200">⚠️ Certificate Withdrawn</h4>
                    <p className="text-xs text-amber-300/80">Reference: {activeCert?.id || id}</p>
                  </div>
                ) : activeCert ? (
                  <div className="mb-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-300">
                        <Icon name="check" size={18} />
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-green-300">✓ Official Verified Credential - Database Confirmed</h4>
                        <p className="text-xs text-[#b8aecf]">Certificate of {activeCert.tier} in {activeCert.skillName} · Valid & In Good Standing</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-4">
                    <h4 className="text-sm font-bold text-green-300">✓ Verified KR8 Academy Scholar</h4>
                    <p className="text-xs text-[#b8aecf]">Active academic record · Database verified</p>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <Avatar src={result.account.avatar} name={result.account.name} size={64} />
                  <div>
                    <h3 className="text-xl font-bold text-white">{result.account.name}</h3>
                    <p className="font-mono text-xs text-pink-400">{result.account.kr8_id}</p>
                    {activeCert?.formattedName && (
                      <p className="text-[11px] font-semibold text-[#8a7ba8] mt-0.5">
                        Certificate Name: <span className="font-mono text-white">{activeCert.formattedName}</span>
                      </p>
                    )}
                  </div>
                  <span className="ml-auto rounded-full bg-green-500/20 border border-green-500/40 px-3 py-1 text-xs font-bold text-green-300">✓ DB Verified</span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <Info label="Certified Discipline" value={activeCert?.skillName ?? skill?.name ?? result.account.skill ?? "Creative Track"} />
                  <Info label="Certificate Type" value={activeCert ? `Certificate of ${activeCert.tier}` : result.account.graduated ? `Certificate of ${result.account.certTier ?? "Completion"}` : "In Training"} />
                  <Info label="Standing Status" value={isWithdrawn ? "Withdrawn ✕" : activeCert ? "Active & Valid ✓" : result.account.graduated ? "Certified ✓" : "Active Student"} highlight={!isWithdrawn} />
                </div>

                {activeCert && !isWithdrawn && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 text-xs space-y-2 text-[#cabfe0]">
                    <div>
                      <span className="font-semibold text-white">Achievement:</span>
                      <p className="mt-0.5 italic text-[#e8ddf5]">"{activeCert.achievementText}"</p>
                    </div>
                    {activeCert.additionalNotes && (
                      <div className="border-t border-white/10 pt-2">
                        <span className="font-semibold text-pink-300">Recognition:</span> <span className="text-white">{activeCert.additionalNotes}</span>
                      </div>
                    )}
                    <div className="border-t border-white/10 pt-2 flex justify-between text-[11px] text-[#8a7ba8]">
                      <span>Ref: <code className="text-pink-400">{activeCert.id}</code></span>
                      <span>Issued: {new Date(activeCert.issuedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-4">
                      <CertificateDocumentView cert={activeCert} student={result.account} maxHeight="350px" />
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => downloadCertificatePdf(result.account?.name || activeCert.studentName, null, activeCert, result.account)} className="text-xs font-bold text-pink-300 hover:text-white underline">Download PDF →</button>
                        <button onClick={() => downloadCertificateImage(result.account?.name || activeCert.studentName, activeCert, result.account)} className="text-xs font-bold text-purple-300 hover:text-white underline">Download PNG ↓</button>
                      </div>
                    </div>
                  </div>
                )}

                {remarks.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h4 className="text-xs font-bold text-white">Remarks from KR8 Team</h4>
                    {remarks.map((r: any) => (
                      <div key={r.id} className="rounded-xl border border-pink-500/20 bg-pink-500/10 p-3">
                        <p className="text-xs text-white">{r.remark}</p>
                        <p className="text-[10px] text-pink-300/70 mt-1">{r.target_type} · {new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${highlight ? "border border-green-500/30 bg-green-500/10" : "bg-black/20"}`}>
      <p className="text-[11px] uppercase tracking-wider text-[#8a7ba8]">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${highlight ? "text-green-300" : "text-white"}`}>{value}</p>
    </div>
  );
}
