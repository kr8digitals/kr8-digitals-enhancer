import { useState, useEffect } from "react";
import { resolveCertificateImageUrl } from "../utils/certificate";
import Icon from "./Icon";

interface CertificateDocumentViewProps {
  cert: any;
  student?: any;
  className?: string;
  maxHeight?: string;
  onLoaded?: (imageUrl: string) => void;
}

export default function CertificateDocumentView({
  cert,
  student,
  className = "",
  maxHeight = "400px",
  onLoaded,
}: CertificateDocumentViewProps) {
  const [imageUrl, setImageUrl] = useState<string>(() => {
    try {
      if (cert?.certificateImageUrl && cert.certificateImageUrl.startsWith("data:image/")) {
        return cert.certificateImageUrl;
      }
      if (cert?.certificate_image_url && cert.certificate_image_url.startsWith("data:image/")) {
        return cert.certificate_image_url;
      }
    } catch {}
    return "";
  });
  const [loading, setLoading] = useState(!imageUrl);

  useEffect(() => {
    let active = true;
    if (!cert) {
      setLoading(false);
      return;
    }

    const certImg = cert.certificateImageUrl || cert.certificate_image_url;
    if (certImg && certImg.startsWith("data:image/")) {
      setImageUrl(certImg);
      setLoading(false);
      onLoaded?.(certImg);
      return;
    }

    setLoading(true);
    try {
      const safeCert = {
        id: cert.id || cert.certificate_code || "cert",
        studentId: cert.studentId || cert.student_id || cert.kr8_id || "",
        studentName: cert.studentName || cert.student_name || "Student",
        formattedName: cert.formattedName || cert.formatted_name || cert.student_name || "STUDENT",
        skill: cert.skill || "graphic",
        skillName: cert.skillName || cert.skill_name || cert.skill || "Graphic Design",
        tier: cert.tier || "Completion",
        templateUrl: cert.templateUrl || cert.template_url,
        achievementText: cert.achievementText || cert.achievement_text,
        additionalNotes: cert.additionalNotes || cert.additional_notes,
        certificateImageUrl: certImg,
      };
      resolveCertificateImageUrl(safeCert as any, student)
        .then((url) => {
          if (!active) return;
          setImageUrl(url);
          setLoading(false);
          onLoaded?.(url);
        })
        .catch((err) => {
          console.warn("Failed to resolve certificate image:", err);
          if (!active) return;
          setImageUrl(safeCert.templateUrl || "/certificates/reusable_completion.png");
          setLoading(false);
        });
    } catch (e) {
      console.warn("CertificateDocumentView exception", e);
      if (active) {
        setImageUrl("/certificates/reusable_completion.png");
        setLoading(false);
      }
    }

    return () => {
      active = false;
    };
  }, [cert?.id, cert?.certificate_code, cert?.certificateImageUrl, cert?.certificate_image_url, cert?.tier, cert?.skill, student?.id]);

  if (!cert) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-black/40 p-6 text-center ${className}`}>
        <p className="text-xs text-[#8a7ba8]">No certificate data</p>
      </div>
    );
  }

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-white/15 bg-black shadow-xl ${className}`}>
      {loading ? (
        <div className="flex min-h-[260px] w-full flex-col items-center justify-center bg-black/60 p-6 text-center space-y-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
          <p className="text-xs text-[#cabfe0] font-medium">
            Rendering Official KR8 Certificate Document...
          </p>
          <p className="text-[10px] text-[#8a7ba8]">
            Applying Encode Sans Bold typography & dynamic QR verification
          </p>
        </div>
      ) : (
        <img
          src={imageUrl || "/certificates/reusable_completion.png"}
          alt={`Official Certificate of ${cert.formattedName || cert.formatted_name || cert.studentName || cert.student_name || "Student"}`}
          className="w-full object-contain transition-opacity duration-300"
          style={{ maxHeight }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "/certificates/reusable_completion.png";
          }}
        />
      )}

      <div className="p-2.5 bg-black/90 text-center border-t border-white/10 flex items-center justify-between px-4">
        <span className="text-[11px] text-green-300 font-semibold flex items-center gap-1">
          <Icon name="check" size={12} /> Includes verifiable QR code
        </span>
        <span className="text-[11px] font-mono text-pink-400">
          {cert.id || cert.certificate_code || ""}
        </span>
      </div>
    </div>
  );
}
