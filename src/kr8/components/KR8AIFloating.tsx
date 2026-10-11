// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import {
  kr8AiRespond,
  getSkillName,
  normalizeSkillWhatsAppUrl,
} from "../data/store";
import Icon from "./Icon";

type Msg = {
  id: string;
  role: "user" | "ai";
  text: string;
  time: string;
};

interface PageAngle {
  modeBadge: string;
  modeTitle: string;
  nudgeBubble: string;
  accountabilityTip: string;
  prompts: string[];
}

function getPageAngle(pathname: string, student: any): PageAngle {
  const firstName = student?.name ? student.name.split(" ")[0] : null;
  const skillName = student?.skill ? getSkillName(student.skill) : "your track";

  if (pathname.startsWith("/agency")) {
    return {
      modeBadge: "Agency & Client Strategy Mode",
      modeTitle: "Brand, Web & Growth Advisor",
      nudgeBubble: "Exploring our live client websites? Ask me about pricing, timelines, or a Free Brand Audit!",
      accountabilityTip:
        "Want to build client projects like AFRISTEM or City Fashion Store? Top-ranked KR8 graduates get placed on paid Agency briefs!",
      prompts: [
        "Tell me about your Website Development clients",
        "Show me City Fashion Store Complete Branding",
        "How do I book a Free Brand Audit?",
        "What are your Agency project timelines?",
      ],
    };
  }

  if (pathname.startsWith("/verify")) {
    return {
      modeBadge: "Credential Verification Mode",
      modeTitle: "Official ID & Certificate Guide",
      nudgeBubble: "Need help verifying a KR8 ID or Certificate Reference? Ask me!",
      accountabilityTip:
        "Every graduated scholar receives a permanently verifiable QR certificate. Stay consistent in your 8-week cohort to earn yours!",
      prompts: [
        "How do I verify a KR8 ID or Certificate?",
        "What is Professionalism vs Completion?",
        "Verify Founder ID (KR8-FOUNDER-TIMFIRE)",
        "How do I earn an Excellent commendation?",
      ],
    };
  }

  if (pathname.startsWith("/leaderboard")) {
    return {
      modeBadge: "XP & Ranking Strategist",
      modeTitle: "Leaderboard & Points Coach",
      nudgeBubble: firstName
        ? `${firstName}, want a strategy to climb into the Top 10 this week?`
        : "Curious how scholars earn XP and climb the Top 10? Ask me!",
      accountabilityTip:
        "Graduates with Professionalism/Excellent distinction (+180 XP), strong instructor comments (+45 XP), and multi-skill mastery (+85 XP) rank highest!",
      prompts: [
        "How are Leaderboard points calculated?",
        "Why do Excellent graduates rank higher?",
        "How do I earn the Double-Skill bonus?",
        "Give me a 7-day plan to climb the Leaderboard",
      ],
    };
  }

  if (pathname.startsWith("/academy") || pathname.startsWith("/dashboard")) {
    return {
      modeBadge: "Student Consistency & Accountability Coach",
      modeTitle: "Academy & Daily Habit Companion",
      nudgeBubble: firstName
        ? `Hey ${firstName}! Have you checked into your ${skillName} coursework today?`
        : "Explore our 100% free 8-week digital skill tracks and live curriculum!",
      accountabilityTip:
        "Consistency Formula: Show up Mon/Wed/Fri (9PM–12AM WAT) for live classes + submit Tue/Thu/Sat practical drills. 1 focused hour daily beats 10 hours once a month!",
      prompts: [
        "Give me my consistency & accountability check-in",
        "What is the weekly class & assignment schedule?",
        "Share the official WhatsApp learning group links",
        "How do I qualify for graduation?",
      ],
    };
  }

  if (pathname.startsWith("/register") || pathname.startsWith("/auth")) {
    return {
      modeBadge: "Onboarding & Enrollment Guide",
      modeTitle: "Registration Companion",
      nudgeBubble: "Signing up takes 60 seconds! Need help choosing a skill track or confirming your email?",
      accountabilityTip:
        "Step 1: Submit the form. Step 2: Click the big Confirm button in your email. Step 3: Join your official WhatsApp class group!",
      prompts: [
        "Which skill track should I choose?",
        "How do I confirm my email & join WhatsApp?",
        "Is the 8-week training 100% tuition-free?",
        "Share the WhatsApp group links",
      ],
    };
  }

  if (pathname.startsWith("/signin")) {
    return {
      modeBadge: "Account Access Assistant",
      modeTitle: "Sign-In & Recovery Helper",
      nudgeBubble: "You can sign in with your Email, KR8 ID, or Phone Number!",
      accountabilityTip:
        "Once signed in, check your Dashboard for your WhatsApp learning group link and weekly XP milestones.",
      prompts: [
        "How do I sign in with my KR8 ID or email?",
        "I haven't received my confirmation email",
        "How do I reset my password?",
        "Share the WhatsApp group links",
      ],
    };
  }

  if (pathname.startsWith("/about")) {
    return {
      modeBadge: "Institution & Leadership Guide",
      modeTitle: "About KR8 Digitals Companion",
      nudgeBubble: "Learn about Founder Timfire, Co-Founders Stevenson & Daniel, and our mission!",
      accountabilityTip:
        "KR8 Digitals was built so talented youth never get locked out by paywalls. Honor the free seat by showing up relentlessly!",
      prompts: [
        "Who are the Founder and Co-Founders?",
        "Why is KR8 Academy 100% free?",
        "How do Academy, Tribe, and Agency connect?",
        "How can I partner with or hire KR8?",
      ],
    };
  }

  return {
    modeBadge: "KR8 Ecosystem Companion",
    modeTitle: "Learn Free · Belong Deeply · Build for Real",
    nudgeBubble: firstName
      ? `Welcome back, ${firstName}! Ready to stay consistent and level up today?`
      : "Hi! I'm KR8 AI — ask me anything about free courses, verifying IDs, or hiring our Agency!",
    accountabilityTip:
      "Small daily discipline creates extraordinary creative careers. Dedicate 60 minutes today to your craft!",
    prompts: [
      "What is KR8 Digitals and how does it work?",
      "How do I join a free Academy skill track?",
      "Show me your live Agency Website portfolio",
      "Give me a consistency & accountability plan",
    ],
  };
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function KR8AIFloating() {
  const location = useLocation();
  const { student } = useAuth();
  const pathname = location.pathname || "/";

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showNudgeBubble, setShowNudgeBubble] = useState(true);
  const [checkedInToday, setCheckedInToday] = useState<boolean>(() => {
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      return localStorage.getItem(`kr8_ai_checkin_${todayKey}`) === "1";
    } catch {
      return false;
    }
  });

  const endRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef<string>(pathname);

  const angle = getPageAngle(pathname, student);

  const [msgs, setMsgs] = useState<Msg[]>(() => {
    const firstName = student?.name ? student.name.split(" ")[0] : null;
    const initAngle = getPageAngle(pathname, student);
    return [
      {
        id: "init-welcome",
        role: "ai",
        time: nowTime(),
        text:
          `👋 Hi${firstName ? ` **${firstName}**` : ""}! I'm **KR8 AI**, your personal companion across KR8 Digitals.\n\n` +
          `📍 **Current Angle:** ${initAngle.modeBadge}\n` +
          `💡 **Daily Nudge:** ${initAngle.accountabilityTip}\n\n` +
          `Ask me anything about our tuition-free Academy tracks, WhatsApp learning groups, Leaderboard points, ID verification, or Agency services!`,
      },
    ];
  });

  // When page changes, append a subtle context-switch note if chat is already active, and refresh nudge bubble
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      setShowNudgeBubble(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs, open, typing]);

  const handleDailyCheckIn = () => {
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      localStorage.setItem(`kr8_ai_checkin_${todayKey}`, "1");
    } catch {}
    setCheckedInToday(true);
    const firstName = student?.name ? student.name.split(" ")[0] : "Scholar";
    const skillName = student?.skill ? getSkillName(student.skill) : "your creative track";
    setMsgs((prev) => [
      ...prev,
      {
        id: `user-checkin-${Date.now()}`,
        role: "user",
        time: nowTime(),
        text: "✅ I'm checking in for my daily 1-hour creative practice today!",
      },
      {
        id: `ai-checkin-${Date.now() + 1}`,
        role: "ai",
        time: nowTime(),
        text:
          `🔥 **Consistency Locked In, ${firstName}!**\n\n` +
          `That's the mindset that separates top 1% earners from dabblers. Here is your **3-Step Focus Checklist** for today in **${skillName}**:\n` +
          `1. **40 mins Deep Practice:** Build or refine one real piece of work without distractions.\n` +
          `2. **10 mins Class / Assignment Prep:** Check your official WhatsApp group for today's drill or live class link (Mon/Wed/Fri 9PM–12AM WAT).\n` +
          `3. **10 mins Proof Upload:** Log your progress on your Academy profile to climb the XP Leaderboard!\n\n` +
          `I'm holding you accountable — let's make it count! 💪`,
      },
    ]);
  };

  const send = (rawText?: string) => {
    const clean = (rawText ?? input).trim();
    if (!clean) return;

    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: clean,
      time: nowTime(),
    };
    setMsgs((prev) => [...prev, userMsg]);
    if (!rawText) setInput("");
    setTyping(true);

    setTimeout(() => {
      const replyText = kr8AiRespond(clean, student, pathname);
      const aiMsg: Msg = {
        id: `a-${Date.now()}`,
        role: "ai",
        text: replyText,
        time: nowTime(),
      };
      setMsgs((prev) => [...prev, aiMsg]);
      setTyping(false);
    }, 320);
  };

  // Render simple markdown-like bolding (**text**) and clickable URLs
  const formatMessageText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, lIdx) => {
      const parts = line.split(/(\*\*.*?\*\*|https?:\/\/[^\s)]+)/g);
      return (
        <span key={lIdx} className="block min-h-[1.1em]">
          {parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={pIdx} className="font-bold text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (/^https?:\/\//.test(part)) {
              return (
                <a
                  key={pIdx}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-pink-300 underline underline-offset-2 hover:text-pink-200 break-all"
                >
                  {part}
                </a>
              );
            }
            return <span key={pIdx}>{part}</span>;
          })}
        </span>
      );
    });
  };

  return (
    <>
      {/* Contextual Companion Nudge Bubble (when closed) */}
      {!open && showNudgeBubble && (
        <div className="fixed bottom-22 right-5 z-[60] max-w-[290px] sm:max-w-[320px] rounded-2xl border border-pink-500/40 bg-[#140024]/95 p-3.5 shadow-2xl backdrop-blur-xl animate-fadeIn">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-300">
                {angle.modeBadge}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowNudgeBubble(false)}
              className="text-[11px] text-[#8a7ba8] hover:text-white cursor-pointer"
              aria-label="Dismiss nudge"
            >
              ✕
            </button>
          </div>
          <p
            onClick={() => setOpen(true)}
            className="mt-1.5 text-xs text-[#e5daf5] leading-snug cursor-pointer hover:text-white"
          >
            {angle.nudgeBubble}
          </p>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full bg-gradient-pink px-3 py-1 text-[10px] font-bold text-white shadow-sm cursor-pointer"
            >
              Ask KR8 AI →
            </button>
            {!checkedInToday && (
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  handleDailyCheckIn();
                }}
                className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
              >
                🔥 Daily Check-In
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Launcher Orb */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Toggle KR8 AI Companion"
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-pink shadow-2xl shadow-pink-500/40 hover:scale-105 active:scale-95 transition cursor-pointer ring-2 ring-white/20"
      >
        {open ? (
          <span className="text-white text-lg font-bold">✕</span>
        ) : (
          <div className="relative flex items-center justify-center">
            <Icon name="bot" size={24} className="text-white" />
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#12001f]" />
          </div>
        )}
      </button>

      {/* KR8 AI Companion Panel */}
      {open && (
        <div className="fixed bottom-22 right-4 sm:right-5 z-[60] w-[92vw] max-w-[410px] h-[560px] max-h-[80vh] rounded-3xl border border-pink-500/35 bg-[#0e001a]/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header with Dynamic Page Angle */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#1c0333] via-[#140024] to-[#1c0333] px-4 py-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-pink text-white shadow-md shadow-pink-500/30">
                <Icon name="bot" size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-white truncate">KR8 AI Companion</p>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                    Online
                  </span>
                </div>
                <p className="text-[10px] font-semibold text-pink-300 truncate">
                  {angle.modeBadge}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                to="/ai"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-[#cabfe0] hover:text-white"
                title="Open Fullscreen KR8 AI Workspace"
              >
                Full View ↗
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-white/70 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Accountability & Consistency Banner */}
          <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2.5 flex items-center justify-between gap-2">
            <p className="text-[11px] text-[#cabfe0] leading-snug line-clamp-2 flex-1">
              <strong className="text-pink-300">⚡ Accountability:</strong> {angle.accountabilityTip}
            </p>
            <button
              type="button"
              onClick={handleDailyCheckIn}
              disabled={checkedInToday}
              className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition cursor-pointer ${
                checkedInToday
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                  : "bg-gradient-pink text-white shadow-sm hover:opacity-95"
              }`}
            >
              {checkedInToday ? "✓ Checked In" : "🔥 Log Daily Check-In"}
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed max-w-[88%] ${
                  m.role === "user"
                    ? "ml-auto bg-gradient-pink text-white shadow-md shadow-pink-500/15"
                    : "mr-auto bg-white/[0.05] border border-white/10 text-[#dfd6f2]"
                }`}
              >
                <div className="space-y-0.5">{formatMessageText(m.text)}</div>
                <div
                  className={`mt-1 text-[9px] ${
                    m.role === "user" ? "text-pink-100/80 text-right" : "text-[#8a7ba8]"
                  }`}
                >
                  {m.time}
                </div>
              </div>
            ))}
            {typing && (
              <div className="mr-auto rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-2.5 text-xs text-pink-300 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-pink-400 animate-ping" />
                <span>KR8 AI is thinking...</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Page-Aware Quick Prompts + Input */}
          <div className="border-t border-white/10 bg-[#120021] p-3">
            <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
              {angle.prompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="whitespace-nowrap rounded-full bg-white/[0.05] border border-white/10 px-3 py-1 text-[10px] font-semibold text-[#cabfe0] hover:border-pink-400/50 hover:text-white transition cursor-pointer shrink-0"
                >
                  {p}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${angle.modeTitle.toLowerCase()} or anything on KR8...`}
                className="flex-1 rounded-full border border-white/15 bg-black/40 px-4 py-2.5 text-xs text-white placeholder:text-[#7a6b94] focus:border-pink-400/60 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-gradient-pink px-4 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 transition cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
