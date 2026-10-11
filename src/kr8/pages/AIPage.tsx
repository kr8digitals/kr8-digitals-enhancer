// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { kr8AiRespond, getSkillName } from "../data/store";
import { Pill, Card, GradientButton } from "../components/ui";
import Icon from "../components/Icon";
import { useSeo } from "../lib/useSeo";

const QUICK_TOPICS = [
  "What is KR8 Digitals and how does it work?",
  "Give me a consistency & accountability check-in",
  "Share the official WhatsApp learning group links",
  "How are Leaderboard XP points calculated?",
  "Show me your live Agency Website Development clients",
  "Tell me about City Fashion Store Complete Branding",
  "How do I verify a KR8 ID or Certificate?",
  "Who are the Founder and Co-Founders of KR8 Digitals?",
];

export default function AIPage() {
  useSeo({
    title: "KR8 AI — Ecosystem Companion & Student Accountability Coach | KR8 Digitals",
    description:
      "Chat with KR8 AI — your 24/7 companion for tuition-free digital skill tracks, daily consistency & accountability coaching, ID verification, leaderboard rankings, and Agency strategy.",
    path: "/ai",
  });

  const { student } = useAuth();
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string }[]>(() => [
    {
      role: "ai",
      text:
        `👋 Welcome${student?.name ? `, **${student.name.split(" ")[0]}**` : ""}! I am **KR8 AI**, your full-ecosystem companion and accountability coach.\n\n` +
        `I know everything across **KR8 Academy**, **KR8 Tribe**, **KR8 Agency**, **Live Credential Verification**, and **Leaderboard Rankings** — and I'm here to help you stay consistent, ship your weekly projects, and answer any question you have.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  const send = (q?: string) => {
    const clean = (q ?? input).trim();
    if (!clean) return;
    setMsgs((prev) => [...prev, { role: "user", text: clean }]);
    if (!q) setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = kr8AiRespond(clean, student, "/ai");
      setMsgs((prev) => [...prev, { role: "ai", text: reply }]);
      setTyping(false);
    }, 320);
  };

  const renderFormatted = (text: string) => {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*|https?:\/\/[^\s)]+)/g);
      return (
        <span key={i} className="block min-h-[1.2em]">
          {parts.map((part, j) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={j} className="font-bold text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (/^https?:\/\//.test(part)) {
              return (
                <a
                  key={j}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-pink-300 underline underline-offset-2 hover:text-pink-200 break-all"
                >
                  {part}
                </a>
              );
            }
            return <span key={j}>{part}</span>;
          })}
        </span>
      );
    });
  };

  return (
    <div className="section-bg min-h-screen py-14">
      <div className="mx-auto max-w-4xl px-5">
        <div className="text-center">
          <Pill>KR8 AI · Ecosystem Companion & Accountability Coach</Pill>
          <h1 className="font-display mt-4 text-4xl text-white sm:text-5xl font-bold">
            Ask <span className="text-gradient">KR8 AI</span> Anything
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#b8aecf] max-w-2xl mx-auto">
            Your 24/7 companion for Academy curriculum, daily consistency habits, WhatsApp class groups, Leaderboard XP rules, ID verification, and Agency services.
          </p>
        </div>

        <Card className="mt-8 p-0 overflow-hidden border-pink-500/30 shadow-2xl">
          <div className="border-b border-white/10 bg-[#150226] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-pink text-white">
                <Icon name="bot" size={20} />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm sm:text-base">
                  KR8 AI Intelligence Engine
                </h2>
                <p className="text-xs text-pink-300">
                  {student
                    ? `Signed in as ${student.name} (${getSkillName(student.skill)}) · ${student.points || 0} XP`
                    : "Visitor & Student Companion · Connected to KR8 Live Knowledge"}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
              ● Active Everywhere
            </span>
          </div>

          <div className="h-[460px] overflow-y-auto p-6 space-y-4 bg-[#0b0014]/60">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] ${
                  m.role === "user"
                    ? "ml-auto bg-gradient-pink text-white shadow-lg"
                    : "mr-auto bg-white/[0.05] border border-white/10 text-[#dfd6f2]"
                }`}
              >
                {renderFormatted(m.text)}
              </div>
            ))}
            {typing && (
              <div className="mr-auto rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-3 text-xs text-pink-300">
                KR8 AI is preparing your response...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-white/10 bg-[#120021] p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_TOPICS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="rounded-full bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-[#cabfe0] hover:border-pink-400/50 hover:text-white transition cursor-pointer"
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
              className="flex gap-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about courses, consistency, WhatsApp links, verification, or Agency..."
                className="flex-1 rounded-full border border-white/15 bg-black/40 px-5 py-3 text-sm text-white placeholder:text-[#7a6b94] focus:border-pink-400 focus:outline-none"
              />
              <GradientButton type="submit">Send →</GradientButton>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
