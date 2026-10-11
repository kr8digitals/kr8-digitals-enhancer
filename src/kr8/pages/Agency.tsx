// Production Agency - Grouped portfolio, live desktop previews, extensible, admin-controlled
import { useEffect, useState } from "react";
import { Link } from "../router-shim";
import { PORTFOLIO, AGENCY_SERVICES as SERVICES, getTestimonials } from "../data/store";
import { Card, Pill, GradientButton } from "../components/ui";
import { useSeo } from "../lib/useSeo";
import { supabase } from "@/integrations/supabase/client";

type PortfolioItem = any;

const GROUPS = ["All", "Website Development", "Complete Branding", "Brand Design", "Video Editing", "Web Engineering"];

export default function Agency() {
  useSeo({ path: "/agency", title: "KR8 Digitals Agency — Websites, Branding, Video" });
  const [activeGroup, setActiveGroup] = useState("All");
  const [dbPortfolio, setDbPortfolio] = useState<PortfolioItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('agency_portfolio')
          .select('*')
          .order('sort', { ascending: true });
        if (error) throw error;
        if (data?.length) setDbPortfolio(data);
      } catch (error) {
        console.warn('Unable to load the agency portfolio from Supabase', error);
      }
    };
    load();
  }, []);

  const source = dbPortfolio.length ? dbPortfolio.map((p: any) => {
    const fallback: any = PORTFOLIO.find((item) =>
      item.title.toLowerCase() === String(p.title || "").toLowerCase() ||
      item.client.toLowerCase() === String(p.client || "").toLowerCase(),
    );
    const candidatePreview = p.live_url || p.preview_url || p.link;
    const previewUrl =
      typeof candidatePreview === "string" && /^https?:\/\//i.test(candidatePreview)
        ? candidatePreview
        : fallback?.previewUrl;

    return {
      id: p.id,
      title: p.title,
      service: p.category || p.service || fallback?.service || "Website Development",
      client: p.client || p.title,
      description: p.description || fallback?.description,
      link: p.link || p.live_url || fallback?.link,
      img: p.image_url || p.img || fallback?.img,
      domain: p.domain || fallback?.domain,
      previewUrl,
      placeholder: false,
    };
  }) : PORTFOLIO;

  const filtered = activeGroup === "All" ? source : source.filter((p:any)=> (p.service||'').toLowerCase().includes(activeGroup.toLowerCase()) || (activeGroup==="Complete Branding" && (p.service||'').includes('Branding')));

  return (
    <div className="section-bg min-h-screen py-12 px-5">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10">
          <Pill>KR8 Digitals Agency · Live Previews · Extensible</Pill>
          <h1 className="font-display mt-4 text-4xl sm:text-6xl font-black text-white leading-tight">
            We Build <span className="text-gradient">Brands That Win</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#cabfe0] max-w-2xl mx-auto">
            Websites that convert, branding that sticks, video that sells — from AfriSTEM to Prime STEM, Chi-Tom, Consistency Drill, City Fashion. Every preview is live desktop view of homepage.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {GROUPS.map(g => (
            <button key={g} onClick={() => setActiveGroup(g)} className={`rounded-full px-4 py-2 text-xs font-bold border transition ${activeGroup===g ? "bg-gradient-pink text-white border-pink-500/50 shadow-lg" : "bg-white/[0.04] text-[#8a7ba8] border-white/10 hover:text-white hover:border-white/20"}`}>{g}</button>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p:any) => (
            <Card key={p.id} className="overflow-hidden p-0 group">
              <div className="relative aspect-[16/10] overflow-hidden bg-black/40 border-b border-white/10">
                {p.previewUrl ? (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-7 bg-[#1a1a1f] border-b border-white/10 flex items-center gap-1.5 px-3 z-10">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500/70"></span>
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70"></span>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70"></span>
                      <span className="ml-2 text-[10px] text-white/50 truncate">{p.domain || p.previewUrl}</span>
                    </div>
                    <iframe src={p.previewUrl} title={p.title} className="absolute inset-0 top-7 w-full h-[calc(100%-28px)] border-0 bg-white" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" />
                    <button onClick={() => setPreviewUrl(p.previewUrl)} className="absolute inset-0 bg-black/0 hover:bg-black/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="rounded-full bg-white text-black px-4 py-2 text-xs font-bold shadow-xl">Live Preview ↗</span>
                    </button>
                  </>
                ) : (
                  <img src={p.img || "/portfolio/afristem_hero.jpg"} alt={p.title} className="h-full w-full object-cover group-hover:scale-105 transition duration-700" />
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-full bg-pink-500/15 border border-pink-500/20 px-2.5 py-0.5 text-[10px] font-bold text-pink-300">{p.service}</span>
                  {p.domain && <span className="text-[10px] text-[#6a5b82]">{p.domain}</span>}
                </div>
                <h3 className="font-bold text-white text-sm">{p.title}</h3>
                <p className="text-[11px] text-[#8a7ba8] mt-1">{p.client}</p>
                <p className="text-xs text-[#cabfe0] mt-2 line-clamp-3">{p.description}</p>
                <div className="mt-4 flex gap-2">
                  {p.link && p.link !== "/agency" && <a href={p.link} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/15">Visit Site →</a>}
                  <button onClick={() => p.previewUrl && setPreviewUrl(p.previewUrl)} className="rounded-full bg-gradient-pink px-3 py-1.5 text-[11px] font-bold text-white">Desktop Preview</button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-16">
          <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-white mb-8">Services — <span className="text-gradient">Everything You Need</span></h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {SERVICES.map((s:any) => (
              <Card key={s.key} className="p-5">
                <h3 className="font-bold text-white text-sm">{s.name}</h3>
                <p className="text-xs text-[#8a7ba8] mt-1">{s.desc || s.description}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center">
          <GradientButton to="/register" className="px-8 py-3.5 text-sm font-bold shadow-xl shadow-pink-500/25">Start Your Project — Free Consultation →</GradientButton>
          <p className="mt-3 text-[11px] text-[#6a5b82]">Extensible: admin can add more projects from dashboard → portfolio table, live preview auto works with any https URL</p>
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur">
          <div className="relative w-full max-w-6xl h-[85vh] rounded-2xl overflow-hidden border border-white/15 bg-[#0d0015] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#1a1a1f]">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500"></span><span className="h-3 w-3 rounded-full bg-amber-400"></span><span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                <span className="ml-3 text-xs text-white/60">{previewUrl}</span>
              </div>
              <div className="flex items-center gap-2">
                <a href={previewUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white text-black px-3 py-1 text-[11px] font-bold">Open in New Tab ↗</a>
                <button onClick={() => setPreviewUrl(null)} className="rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] font-bold text-white">Close ✕</button>
              </div>
            </div>
            <iframe src={previewUrl} className="w-full h-[calc(100%-44px)] border-0 bg-white" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
          </div>
        </div>
      )}
    </div>
  );
}
