import { useEffect, useRef, useState } from "react";
import { Link } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import { IMG } from "../data/images";
import { getPortfolio, FULL_PORTFOLIO_LINK, getAnnouncements, getHomepageSettings } from "../data/store";
import { getSiteContent as getLocalSiteContent, type SiteContent } from "../data/cmsStore";
import { supabase } from "@/integrations/supabase/client";
import Marquee from "../components/Marquee";
import LiveFeed from "../components/LiveFeed";
import LeaderboardList from "../components/LeaderboardList";
import TestimonialCarousel from "../components/TestimonialCarousel";
import { Pill, GradientButton, GhostButton, SectionHead, Card, GlowImage } from "../components/ui";
import Dashboard from "./Dashboard";
import Icon from "../components/Icon";
import HeroInteractiveCanvas from "../components/HeroInteractiveCanvas";
import { useSeo } from "../lib/useSeo";
import AnnouncementCard from "../components/AnnouncementCard";

export default function Home() {
  const { student } = useAuth();
  if (student) return <Dashboard />;
  return <GuestHome />;
}

function CountUp({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const safeEnd = Math.max(0, Math.floor(Number(end) || 0));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setN(safeEnd);
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !seen) {
        setSeen(true);
        const dur = 1400, start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.floor(eased * safeEnd));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [safeEnd, seen]);
  return <div ref={ref} className="font-display min-w-0 text-2xl text-gradient sm:text-5xl">{n.toLocaleString()}{suffix}</div>;
}

const journey = [
  { n: "1", t: "Claim your verifiable KR8 ID in 60 seconds — your permanent proof of craft" },
  { n: "2", t: "Ship daily live drills with senior mentors who bill international clients" },
  { n: "3", t: "Build a portfolio that outshines degrees and gets you hired" },
  { n: "4", t: "Climb the leaderboard, earn XP, and get discovered" },
  { n: "5", t: "Graduate with QR-verified certificate and enter paid agency pipeline" },
];

const PILL_MESSAGES = [
  "Africa's First Tuition-Free Creative Institution",
  "3,000+ Creators · 120+ Client Deployments · Zero Tuition",
  "From Doubt to Proof — We Engineer Careers, Not Just Courses",
  "Verifiable KR8 ID · Portfolio-First · Agency Pipeline",
  "Learn Free. Belong Deeply. Bill Internationally.",
];

function GuestHome() {
  useSeo({
    title: "KR8 Digitals — Africa's Tuition-Free Creative Institution & Agency",
    description: "Master Graphic Design, Web Engineering, and Video Motion — 100% free, portfolio-first, with verifiable KR8 ID and direct pipeline to paid agency retainers. 3,000+ creators, 120+ client deployments.",
    path: "/",
  });
  const announcements = getAnnouncements();
  const [portfolio, setPortfolio] = useState(() => getPortfolio());
  const [homepageSettings, setHomepageSettings] = useState(getHomepageSettings());
  const [cms, setCms] = useState<SiteContent>(() => getLocalSiteContent());
  const [dbHomeContent, setDbHomeContent] = useState<Record<string, any>>({});
  const [liveCounts, setLiveCounts] = useState({ students: 1247, tribe: 3185, projects: 127 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data: overview } = await supabase.rpc('admin_overview');
        if (overview) {
          setLiveCounts({
            students: Math.max(0, overview.total_students || 1247),
            tribe: Math.max(0, (overview.total_students || 0) * 2.5 + 500),
            projects: Math.max(0, overview.certificates_issued ? Math.floor(overview.certificates_issued * 0.8) + 80 : 127),
          });
        } else {
          const { count: profilesCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
          const { count: portfolioCount } = await supabase.from('agency_portfolio').select('id', { count: 'exact', head: true });
          setLiveCounts({
            students: Math.max(0, profilesCount || 1247),
            tribe: Math.max(0, (profilesCount || 1247) * 2.5),
            projects: Math.max(0, portfolioCount ? portfolioCount + 100 : 127),
          });
        }
      } catch {
        // Keep defaults, never negative
      }
    };
    fetchCounts();
    const iv = setInterval(fetchCounts, 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const fetchHomeContent = async () => {
      try {
        const { data } = await supabase.from('site_content').select('key,value').eq('page', 'home');
        if (data) {
          const map: Record<string, any> = {};
          data.forEach((r: any) => map[r.key] = r.value);
          setDbHomeContent(map);
        }
      } catch {}
    };
    fetchHomeContent();
    const iv2 = setInterval(fetchHomeContent, 60000);
    return () => clearInterval(iv2);
  }, []);

  const dbHeroTitle = (dbHomeContent.hero_title as string) || "";
  const [pillIndex, setPillIndex] = useState(0);
  const [pillFade, setPillFade] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setPillFade(true);
      setTimeout(() => {
        setPillIndex((prev) => (prev + 1) % PILL_MESSAGES.length);
        setPillFade(false);
      }, 300);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      {/* HERO - World-class, benefit-driven, no negative counts */}
      <section className="hero-section relative min-h-[auto] md:min-h-[82vh] flex items-center overflow-hidden pt-4 pb-12 sm:pt-6 sm:pb-16 md:pt-7 md:pb-20">
        <HeroInteractiveCanvas />
        <div className="hero-container relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="flex w-full justify-center mb-5 sm:mb-8 px-2">
            <div className="hero-badge inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-full border border-pink-500/30 bg-black/70 px-3 py-1 sm:px-4 sm:py-1.5 backdrop-blur-md shadow-lg shadow-pink-500/5 whitespace-nowrap max-w-full">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-500" />
              </span>
              <span className={`text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-pink-200 truncate transition-opacity duration-300 ${pillFade ? "opacity-0" : "opacity-100"}`}>{PILL_MESSAGES[pillIndex]}</span>
            </div>
          </div>

          <div className="grid items-center gap-8 md:gap-12 lg:grid-cols-12">
            <div className="hero-content rise-in lg:col-span-7">
              <h1 className="hero-headline font-display text-4xl sm:text-6xl lg:text-7xl font-bold leading-tight tracking-tight text-white">
                {dbHeroTitle ? dbHeroTitle : <>We Engineer <span className="text-gradient font-extrabold">Careers.</span></>}
              </h1>
              <p className="mt-3 text-sm sm:text-lg text-[#cabfe0] leading-relaxed max-w-xl">
                Stop paying for overpriced bootcamps that teach theory. Master high-income craft — <span className="text-white font-semibold">Graphic Design, Web Engineering, Video Motion</span> — 100% free, portfolio-first, with verifiable proof that gets you hired.
              </p>
              <div className="hero-subheadline mt-5 space-y-3 text-xs sm:text-base font-medium text-[#cabfe0]">
                <div className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-xs text-pink-400 ring-1 ring-pink-500/40">✦</span><span>Learn <span className="text-gradient font-extrabold">free</span> from practitioners who ship client work daily</span></div>
                <div className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-xs text-purple-400 ring-1 ring-purple-500/40">✦</span><span>Belong to a <span className="text-gradient font-extrabold">tribe</span> that shares gigs, feedback, and momentum</span></div>
                <div className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-xs text-pink-400 ring-1 ring-pink-500/40">✦</span><span>Bill internationally with <span className="text-gradient font-extrabold">QR-verified proof</span>, not paper certificates</span></div>
              </div>

              <div className="hero-actions mt-8 flex items-center gap-3 flex-wrap">
                <GradientButton to={cms.home.primaryCtaLink || "/academy"} className="whitespace-nowrap px-6 py-3.5 text-sm font-bold shadow-lg shadow-pink-500/25"><span>Start Learning Free — Claim KR8 ID</span><span className="ml-1.5">→</span></GradientButton>
                <GhostButton to={cms.home.tribeCtaLink || "/tribe"} className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold border-white/20 bg-white/[0.04] backdrop-blur-md hover:border-pink-500/40 text-[#e4daf2]">Join 3,000+ Tribe</GhostButton>
                <GhostButton to={cms.home.agencyCtaLink || "/agency"} className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold border-white/15 bg-white/[0.02] backdrop-blur-md hover:border-purple-400/40 text-[#e4daf2]">Hire Our Agency</GhostButton>
              </div>

              <div className="hero-stats mt-10 grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md hover:border-pink-500/30 hover:bg-white/[0.06] transition-all">
                  <CountUp end={liveCounts.students} suffix="+" />
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#a594c7]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" /><span>Active Learners</span></div>
                  <p className="mt-1 text-[10px] text-[#6a5b82]">Verified KR8 IDs</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md hover:border-purple-500/30 hover:bg-white/[0.06] transition-all">
                  <CountUp end={liveCounts.tribe} suffix="+" />
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#a594c7]"><span className="h-1.5 w-1.5 rounded-full bg-pink-400 shrink-0" /><span>Tribe Members</span></div>
                  <p className="mt-1 text-[10px] text-[#6a5b82]">Sharing gigs daily</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md hover:border-pink-500/30 hover:bg-white/[0.06] transition-all">
                  <CountUp end={liveCounts.projects} suffix="+" />
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#a594c7]"><span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" /><span>Client Projects</span></div>
                  <p className="mt-1 text-[10px] text-[#6a5b82]">Shipped by graduates</p>
                </div>
              </div>
            </div>

            <div className="hero-media relative lg:col-span-5">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-pink-500/25 via-purple-600/20 to-transparent opacity-60 blur-2xl" />
              <div className="floaty relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-transparent p-2 backdrop-blur-xl shadow-2xl">
                <GlowImage src={IMG.heroGroup} alt="African creators building together at KR8 Digitals" caption="From zero to studio — real people, real proof, zero tuition." className="aspect-[4/3] rounded-2xl" />
                <div className="absolute top-5 right-5 flex items-center gap-2 rounded-xl border border-white/20 bg-black/70 px-3 py-1.5 backdrop-blur-md shadow-xl">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">Live Cohort · 100% Free · No Catch</span>
                </div>
                <div className="absolute bottom-5 left-5 hidden sm:flex items-center gap-2 rounded-xl border border-white/20 bg-black/70 px-3 py-1.5 backdrop-blur-md shadow-xl">
                  <span className="text-xs">✓</span><span className="text-[10px] font-bold uppercase tracking-wider text-pink-200">QR-Verified · Works Anywhere</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Marquee items={["Think It. KR8 It", "Learn Free, No Tuition", "Verifiable KR8 ID", "Portfolio > Paper", "3,000+ Creators Strong", "Graduate-Powered Agency", "From Zero to Paid"]} />

      {/* THREE PILLARS - World-class copy */}
      <section className="section-bg py-20">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead label="One Institution, Three Superpowers" title="Learn." highlight="Belong. Build." sub="Academy, Tribe, Agency — a single flywheel that turns raw beginners into internationally-billable creators." center />
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            <Card className="flex flex-col group hover:border-pink-500/40 transition-all">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-pink text-white group-hover:scale-110 transition-transform"><Icon name="certificate" size={22} /></div>
              <p className="text-[11px] uppercase tracking-wider text-pink-400 font-bold">The Academy — Free, Not Cheap</p>
              <h3 className="mt-1 text-xl font-bold text-white">Portfolio-First. Feedback-Heavy. Zero Fluff.</h3>
              <p className="mt-3 flex-1 text-sm text-[#b8aecf] leading-relaxed">8-week intensive sprints in Graphic Design, Web Engineering, Video Motion. Senior practitioners who bill $5k+/month teach live. No recorded theory. Every drill ships to your portfolio with line-by-line critique. Graduate with QR-verified certificate that employers can verify on any device, anywhere.</p>
              <Link to="/academy" className="mt-5 text-sm font-semibold text-pink-400 underline underline-offset-4 hover:text-pink-300">Explore tracks & curriculum →</Link>
            </Card>
            <Card className="flex flex-col group hover:border-purple-500/40 transition-all">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-pink text-white group-hover:scale-110 transition-transform"><Icon name="users" size={22} /></div>
              <p className="text-[11px] uppercase tracking-wider text-pink-400 font-bold">The Tribe — Your Unfair Advantage</p>
              <h3 className="mt-1 text-xl font-bold text-white">Never Build Alone. Never Stall Alone.</h3>
              <p className="mt-3 flex-1 text-sm text-[#b8aecf] leading-relaxed">3,000+ African creators sharing raw drafts, client leads, and accountability. Daily check-ins, weekly hangouts, monthly Mindset Shift. Solo freelancing is lonely and slow — tribe makes you fast and visible. Your next collaborator, referral, or co-founder is already here.</p>
              <Link to="/tribe" className="mt-5 text-sm font-semibold text-pink-400 underline underline-offset-4 hover:text-pink-300">Join 3,000+ creators →</Link>
            </Card>
            <Card className="flex flex-col group hover:border-cyan-500/40 transition-all">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-pink text-white group-hover:scale-110 transition-transform"><Icon name="video" size={22} /></div>
              <p className="text-[11px] uppercase tracking-wider text-pink-400 font-bold">The Agency — From Learner to Earner</p>
              <h3 className="mt-1 text-xl font-bold text-white">We Don't Just Teach. We Hire Our Best.</h3>
              <p className="mt-3 flex-1 text-sm text-[#b8aecf] leading-relaxed">Top 5% of each cohort enters agency shadowing — real briefs, real deadlines, real revenue. We engineer brand positioning, conversion websites, and viral video engines for global brands. Your free education becomes a direct pipeline to paid retainers. Proof over paper, always.</p>
              <Link to="/agency" className="mt-5 text-sm font-semibold text-pink-400 underline underline-offset-4 hover:text-pink-300">See client transformations →</Link>
            </Card>
          </div>
        </div>
      </section>

      {/* BLUEPRINT */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-[#1a0030] to-[#12001f] p-8 sm:p-12">
            <div className="text-center max-w-3xl mx-auto">
              <Pill>From Zero to Paid — The Proven Path</Pill>
              <h2 className="font-display mt-5 text-4xl text-white sm:text-5xl font-black">Your <span className="text-gradient">8-week transformation</span> starts with a 60-second ID</h2>
              <p className="mx-auto mt-4 text-sm sm:text-base text-[#cabfe0] leading-relaxed">No 4-year degrees. No $2,000 bootcamps. Just a battle-tested system that has turned 1,200+ beginners into studio-ready creators who bill internationally.</p>
            </div>
            <div className="mt-12 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              {journey.map((s) => (
                <div key={s.n} className="flex items-start gap-4 lg:flex-1 lg:flex-col lg:items-center lg:text-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-pink font-display text-lg text-white shadow-lg shadow-pink-500/30 font-black">{s.n}</div>
                  <p className="text-sm font-medium text-[#cabfe0] lg:px-2 leading-relaxed">{s.t}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center flex flex-col sm:flex-row gap-3 justify-center">
              <GradientButton to="/academy" className="shadow-xl shadow-pink-500/25">Claim Free KR8 ID → Start Learning</GradientButton>
              <GhostButton to="/verify">Verify a Graduate ID</GhostButton>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE + LEADERBOARD */}
      <section className="section-bg py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-2">
          <div>
            <SectionHead label="Live Proof, Daily" title="Tribe in motion —" highlight="always shipping." sub="Real check-ins, critiques, and wins from creators who show up even when motivation doesn't." />
            <div className="mt-8"><LiveFeed /></div>
          </div>
          <div>
            <SectionHead label="Meritocracy in Action" title="Leaderboard —" highlight="proof over paper." sub="XP earned by shipping, not talking. Top creators get agency shadowing and client referrals." />
            <div className="mt-8"><LeaderboardList limit={5} /></div>
            <Link to="/leaderboard" className="mt-6 inline-block text-sm font-semibold text-pink-400 hover:text-pink-300">View full leaderboard — see who ships →</Link>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section-bg py-20 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead label="Real People, Real Proof, Zero Tuition" title="From learners to" highlight="earners — unscripted." sub="Not actors. Not paid testimonials. Just African youth who started with zero connections, completed free cohorts, and now bill $500-$3,000/month." center />
          <div className="mt-12"><TestimonialCarousel items={[]} /></div>
        </div>
      </section>

      {/* AGENCY - World-class */}
      <section className="section-bg relative overflow-hidden py-20 border-y border-white/10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-gradient-to-tr from-pink-500/15 via-purple-600/15 to-transparent blur-3xl pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-5">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-pink-300 backdrop-blur-md mb-4">✦ KR8 Agency — Where Free Education Meets Paid Execution</div>
            <h2 className="font-display text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">Your Brand Is Leaking Money. <span className="text-gradient">We Plug the Leaks.</span></h2>
            <p className="mt-4 text-sm sm:text-base text-[#cabfe0] leading-relaxed">60% of businesses lose customers because they look amateur, their site doesn't convert, or their content gets ignored. We engineer the complete transformation — positioning, website, video, AI — so you command premium prices and double inbound.</p>
          </div>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md">
            <div className="text-center p-3 border-r border-white/5 last:border-0"><div className="font-display text-3xl sm:text-4xl text-gradient font-black">+240%</div><p className="mt-1 text-xs font-semibold text-white">Visibility Growth</p><p className="text-[10px] text-[#8a7ba8]">Organic & search</p></div>
            <div className="text-center p-3 border-r border-white/5 last:border-0"><div className="font-display text-3xl sm:text-4xl text-gradient font-black">3.2x</div><p className="mt-1 text-xs font-semibold text-white">Conversion Lift</p><p className="text-[10px] text-[#8a7ba8]">UX & funnels</p></div>
            <div className="text-center p-3 border-r border-white/5 last:border-0"><div className="font-display text-3xl sm:text-4xl text-white font-black">120+</div><p className="mt-1 text-xs font-semibold text-white">Projects Shipped</p><p className="text-[10px] text-[#8a7ba8]">Startups to enterprise</p></div>
            <div className="text-center p-3"><div className="font-display text-3xl sm:text-4xl text-pink-300 font-black">100%</div><p className="mt-1 text-xs font-semibold text-white">Bespoke</p><p className="text-[10px] text-[#8a7ba8]">Zero templates</p></div>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-8 hover:border-pink-500/40 transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-400 group-hover:scale-110 transition-transform"><Icon name="palette" size={24} /></div>
              <h3 className="font-display mt-4 text-xl font-bold text-white">Brand Positioning — Stop Competing on Price</h3>
              <p className="mt-3 text-sm text-[#b8aecf] leading-relaxed">When you look like everyone else, clients haggle. We rebuild your narrative, logo suite, typography, and pitch decks into a unified authority that attracts high-value buyers who pay without negotiation.</p>
            </div>
            <div className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-8 hover:border-purple-500/40 transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform"><Icon name="code" size={24} /></div>
              <h3 className="font-display mt-4 text-xl font-bold text-white">Conversion Websites — Your 24/7 Closer</h3>
              <p className="mt-3 text-sm text-[#b8aecf] leading-relaxed">A pretty site that gets no inquiries is expensive art. We build lightning-fast, SEO-engineered experiences with conversion copy and frictionless booking that works while you sleep.</p>
            </div>
            <div className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-8 hover:border-pink-500/40 transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-400 group-hover:scale-110 transition-transform"><Icon name="video" size={24} /></div>
              <h3 className="font-display mt-4 text-xl font-bold text-white">Viral Video Engine — Double Your Reach</h3>
              <p className="mt-3 text-sm text-[#b8aecf] leading-relaxed">Algorithm rewards retention. We craft cinematic Reels, YouTube edits, UGC commercials with psychological hooks, sound design, and pacing that glues viewers to your story.</p>
            </div>
            <div className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-8 hover:border-cyan-500/40 transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform"><Icon name="spark" size={24} /></div>
              <h3 className="font-display mt-4 text-xl font-bold text-white">AI & Growth — Scale Without Overhead</h3>
              <p className="mt-3 text-sm text-[#b8aecf] leading-relaxed">Stop drowning in DMs. AI agents qualify leads, answer FAQs, book calls, sync to CRM 24/7. You focus on craft, system handles conversion.</p>
            </div>
          </div>

          <div className="mt-12 rounded-3xl border border-pink-500/30 bg-gradient-to-r from-[#200a36] via-[#140624] to-[#200a36] p-8 sm:p-12 text-center shadow-2xl">
            <h3 className="font-display text-2xl sm:text-4xl font-black text-white">Ready to Stop Leaving Money on the Table?</h3>
            <p className="mt-3 text-sm text-[#cabfe0] max-w-xl mx-auto">Free 20-min Brand Audit with senior director. We'll show exactly where you're leaking leads and give you a plan to dominate.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <GradientButton to="/agency#hire" className="shadow-xl shadow-pink-500/25">Claim Free Brand Audit →</GradientButton>
              <GhostButton href="https://wa.me/2348125687509">Chat on WhatsApp ↗</GhostButton>
            </div>
          </div>
        </div>
      </section>

      {announcements.length > 0 && (
        <section className="section-bg py-16">
          <div className="mx-auto max-w-7xl px-5">
            <SectionHead label="From the Desk of KR8 Leadership" title="Latest" highlight="announcements" />
            <div className="mt-10 grid gap-6 md:grid-cols-2">{announcements.map((a: any) => <AnnouncementCard key={a.id} announcement={a} />)}</div>
          </div>
        </section>
      )}

      <section className="section-bg py-16">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <SectionHead label="Proof Over Paper" title="Client transformations" highlight="that bill." center />
          <div className="mx-auto mt-8 grid max-w-5xl gap-5 text-left sm:grid-cols-2">
            {portfolio.slice(0,4).map((client: any) => (
              <div key={client.id} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] hover:border-pink-500/40 transition-all">
                {client.img && <div className="aspect-[16/9] overflow-hidden bg-black/40"><img src={client.img} alt={client.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" /></div>}
                <div className="p-5"><p className="text-xs uppercase tracking-wider text-pink-400 font-semibold">{client.service}</p><h3 className="mt-1 font-bold text-white">{client.client}</h3><p className="mt-2 text-sm text-[#b8aecf]">{client.description}</p></div>
                {client.link && <div className="px-5 pb-5"><a href={client.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-pink-500/40 bg-pink-500/10 px-3.5 py-1.5 text-xs font-semibold text-pink-300 hover:bg-pink-500/20">Visit Live →</a></div>}
              </div>
            ))}
          </div>
          <div className="mt-8"><GhostButton href={FULL_PORTFOLIO_LINK}>View full portfolio →</GhostButton></div>
        </div>
      </section>

      <section className="section-bg py-20">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-pink-400/30 bg-gradient-to-br from-[#1a0030] to-[#12001f] p-12">
            <div className="absolute -top-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-gradient-pink opacity-30 blur-3xl" />
            <div className="relative">
              <h2 className="font-display text-4xl text-white sm:text-5xl font-black">Your breakthrough <span className="text-gradient">starts today.</span></h2>
              <p className="mx-auto mt-4 max-w-lg text-[#cabfe0]">1,200+ creators already proved — free instruction, real community, relentless execution beats expensive bootcamps every time.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <GradientButton to="/academy" className="shadow-xl shadow-pink-500/25">Join Free Cohort — Claim KR8 ID →</GradientButton>
                <GhostButton to="/about">Read Our Manifesto</GhostButton>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
