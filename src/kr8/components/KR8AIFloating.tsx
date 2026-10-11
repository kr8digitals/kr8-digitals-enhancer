import { useState, useEffect, useRef } from "react";
import { useLocation } from "../router-shim";
import { useAuth } from "../context/AuthContext";
import Icon from "./Icon";

type Msg = { role: "user" | "ai"; text: string };

const PAGE_KNOWLEDGE: Record<string, { context: string; nudges: string[]; prompts: string[] }> = {
  "/": { context: "User is on Home — they need to understand Learn/Belong/Build pillars, free cohorts, leaderboard, live feed.", nudges: ["Have you claimed your KR8 ID yet? 60s free.", "Check live feed for recent registrations.", "Top 10 leaderboard shows real XP from attendance."], prompts: ["What is KR8 Digitals?", "How do I join free?", "Show me leaderboard"] },
  "/academy": { context: "User is on Academy — they see 7 tracks, registration open/closed, curriculum, instructors. Nudge to register, attend Mon/Wed/Fri 9PM-12AM WAT.", nudges: ["Class is Mon/Wed/Fri 9PM-12AM WAT — attendance window auto-opens.", "Submit assignment Tue/Thu/Sat with date/topic/time+proof.", "Join WhatsApp group after confirming email — don't skip."], prompts: ["Which skill should I pick?", "When is next class?", "How to get certificate?"] },
  "/register": { context: "User is on Register — they need to fill name, email, phone, DOB, skill. Explain email confirmation flow, check spam.", nudges: ["After submit, check email (and spam) for confirmation — bold step.", "Once confirmed, you'll join WhatsApp group with one click."], prompts: ["I didn't get confirmation email", "What happens after register?", "Is it really free?"] },
  "/signin": { context: "User is on Sign In — they might be founder locked out, need email or KR8 ID + password. Remind WhatsApp join if skipped.", nudges: ["Founder locked? Use email not phone + reset password.", "If you skipped WhatsApp, join now — live links inside."], prompts: ["I forgot password", "Founder locked out", "Find my KR8 ID"] },
  "/dashboard": { context: "User is on Dashboard — show attendance, submissions, XP, referrals. Nudge consistency.", nudges: ["You have attendance today? Submit with proof.", "Streak: don't break — 1 hour daily wins.", "Check notifications for WhatsApp link."], prompts: ["How to earn points?", "When is mindset shift?", "My attendance not approved"] },
  "/verify": { context: "User is on Verify — they can verify KR8 ID or certificate from live DB.", nudges: ["Paste KR8 ID to verify real-time from Supabase.", "Certificates show tier and graduation comment."], prompts: ["How to verify ID?", "What does withdrawn mean?", "Download certificate"] },
  "/agency": { context: "User is on Agency — they see grouped portfolio with live iframe previews of sites we built.", nudges: ["See live desktop preview of afristemglobal.org etc.", "Hire us for website + branding + video.", "Portfolio controlled from admin."], prompts: ["How much for website?", "Show me City Fashion branding", "What is live preview?"] },
  "/leaderboard": { context: "User is on Leaderboard — real DB ranking, points from attendance, submissions, referrals, graduation tier.", nudges: ["Excellence 200 XP > Professionalism 150 > Completion 100", "Double skill +50 XP", "Search your KR8 ID to find rank."], prompts: ["How points work?", "Why am I low rank?", "How to get Excellence?"] },
  "/about": { context: "User is on About — mission, founder Timfire, co-founders Stevenson Motionverse and Daniel Creative Expression.", nudges: ["Founder Timfire built this to kill paywalls.", "Co-founders lead Graphic and Video tracks."], prompts: ["Who is founder?", "Tell me about co-founders", "What is mission?"] },
  "/blog": { context: "User is on Blog — community stories, can write story if signed in.", nudges: ["Write your story to get followers.", "Follow creators you like."], prompts: ["How to write story?", "How to get featured?"] },
};

type PageKnowledge = { context: string; nudges: string[]; prompts: string[] };

function getPageKnowledge(pathname: string): PageKnowledge {
  const exact = PAGE_KNOWLEDGE[pathname];
  if (exact) return exact;
  for (const key of Object.keys(PAGE_KNOWLEDGE)) {
    const pageKnowledge = PAGE_KNOWLEDGE[key];
    if (pageKnowledge && pathname.startsWith(key) && key !== "/") return pageKnowledge;
  }
  return PAGE_KNOWLEDGE["/"]!;
}

function aiReply(q: string, pathname: string, user: any): string {
  const l = q.toLowerCase();
  const knowledge = getPageKnowledge(pathname);
  const ctx = knowledge.context;

  if (l.includes("whatsapp") || l.includes("group")) {
    return `Here are your WhatsApp learning groups (updated per your request):\n\n🎨 Graphic Design: https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4\n💻 Website Development: https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v?s=cl&p=a&mlu=4&ilr=4\n🎬 Video Editing: https://chat.whatsapp.com/C9IyCVi8pWMJJUsErJhQ0M?s=cl&p=a&mlu=4&ilr=4\n\nAfter confirming email, you get unmistakable green button to join. If you skipped, we remind you on next login. Check notifications — link is clickable.\n\nContext: ${ctx}`;
  }
  if (l.includes("confirm") || l.includes("email not")) {
    return `Email confirmation flow (new):\n1. You register → we celebrate you and tell you boldly to confirm email.\n2. Check inbox AND spam for 'KR8 Digitals — Confirm Your Account' — big button inside.\n3. Click confirm → you land on /auth/confirmed celebration page with WhatsApp join button (unmistakable).\n4. Join WhatsApp → click Done or Skip to profile. If skipped, we remind you next login.\n\nMost people today didn't confirm because they didn't know — now it's bold and unmissable.\n\nContext: ${ctx}`;
  }
  if (l.includes("founder") || l.includes("locked")) {
    return `Founder locked out fix: Sign in now uses Supabase + KR8 ID lookup. You can use email OR KR8 ID (we lookup email from profiles table). If email not confirmed, check spam. Use Forgot Password → reset link goes to /reset-password. Founder, co-founders, admins all have staff access via user_roles table. Try your founder email + password, or reset.\n\nContext: ${ctx}`;
  }
  if (l.includes("verify") || l.includes("id")) {
    return `Verification now uses live Supabase DB, not localStorage. Go to /verify, paste KR8 ID or certificate number. It checks profiles table and certificates table real-time. Shows graduation status, tier, points, attendance, double skill, graduation comment. Every ID verifying with current updates.\n\nContext: ${ctx}`;
  }
  if (l.includes("leaderboard") || l.includes("points") || l.includes("rank")) {
    return `Leaderboard now 100% real DB: points = attendance×5 + submissions×10 + referrals×20 + graduation tier (Excellence 200, Professionalism 150, Completion 100) + graduation_score + double_skill 50 + XP. Graduated with good comments get higher points. Shows top 10 + full 100 + search KR8 ID to find rank. Data from profiles table live.\n\nContext: ${ctx}`;
  }
  if (l.includes("live feed") || l.includes("activity")) {
    return `Live feed uses a separate, privacy-safe activity_feed table with generic registration, attendance, assignment, graduation, and leaderboard updates. It refreshes in real time through Supabase Realtime without exposing names, IDs, emails, or audit details.\n\nContext: ${ctx}`;
  }
  if (l.includes("agency") || l.includes("portfolio") || l.includes("client")) {
    return `Agency upgraded: Clients grouped — Website Development (AFRISTEM afristemglobal.org, Prime STEM Nigeria primestemnigeria.afristemglobal.org, Chi-Tom chitomraphahospital.com, Consistency Drill consistencydrill.com), Complete Branding (City Fashion Store), Video Editing (Smart Living), Web Engineering (KR8 Academy). For sites we built, preview is live desktop view via iframe of actual homepage (with browser chrome). If site blocks iframe, fallback image. Fully controlled from admin dashboard → Website Content → Portfolio.\n\nContext: ${ctx}`;
  }
  if (l.includes("about") || l.includes("co-founder") || l.includes("stevenson") || l.includes("daniel")) {
    return `About page co-founders images fixed: now local /team/stevenson.jpg and /team/daniel.jpg downloaded from Drive (previously 403). Founder Timfire image /founder_timfire_wide.jpg. All images load locally, no Drive 403.\n\nContext: ${ctx}`;
  }
  if (l.includes("ai") || l.includes("help")) {
    return `I'm KR8 AI — now everywhere, not just /ai page. I know everything in site and switch knowledge based on page you're on. Current page: ${pathname}. ${ctx}\n\nI nudge students to stay consistent: daily attendance Mon/Wed/Fri 9PM-12AM WAT, assignments Tue/Thu/Sat, mindset 1st/3rd Sun, hangout last Sun. I answer any question, give assistance, and I'm reason to keep coming back.\n\nTry: ${knowledge.prompts.join(", ")}\n\nNudges: ${knowledge.nudges.join(" • ")}`;
  }
  return `Great question! I'm KR8 AI, your companion everywhere. Current page: ${pathname}. ${ctx}\n\nI can help with: registration flow, email confirmation, WhatsApp groups, verification, leaderboard points, live feed, agency portfolio, attendance, graduation, admin controls — all connected to Supabase DB.\n\nWhat specifically do you need? ${knowledge.prompts[0] ?? "Ask me anything."}\n\nNudges: ${knowledge.nudges[0] ?? "Keep showing up consistently."}`;
}

export default function KR8AIFloating() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const { student } = useAuth();
  const endRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const pathname = location.pathname;

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const knowledge = getPageKnowledge(pathname);
    const firstName = student?.name.split(" ")[0] ?? student?.name ?? "";
    setMsgs([{ role: "ai", text: `Hi${firstName ? ` ${firstName}` : ""}! I'm KR8 AI — now with you everywhere. You're on ${pathname}. ${knowledge.context}\n\nQuick nudges: ${knowledge.nudges.slice(0,2).join(" • ")}\n\nAsk me anything — I know the whole site and adapt to this page.` }]);
  }, [pathname, student?.name]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    if (!openRef.current && msgs.length > 1) setUnread((unreadCount) => unreadCount + 1);
  }, [msgs]);

  useEffect(() => { if (open) setUnread(0); }, [open]);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMsgs(m=>[...m, { role: "user", text }]);
    setInput("");
    setTimeout(() => {
      const reply = aiReply(text, pathname, student);
      setMsgs(m=>[...m, { role: "ai", text: reply }]);
    }, 600);
  };

  return (
    <>
      {/* Floating button */}
      <button onClick={()=>setOpen(!open)} className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-pink shadow-2xl shadow-pink-500/30 hover:scale-105 transition">
        <span className="text-white text-xl">{open ? "✕" : "🤖"}</span>
        {unread>0 && !open && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-pink-600 text-[10px] font-black">{unread}</span>}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-[60] w-[90vw] max-w-[380px] h-[480px] rounded-3xl border border-white/15 bg-[#0d0015]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#12001f] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-pink text-white"><Icon name="bot" size={16} /></span>
              <div><p className="text-sm font-bold text-white">KR8 AI · Everywhere</p><p className="text-[10px] text-[#8a7ba8] truncate max-w-[180px]">{pathname} · {getPageKnowledge(pathname).context.slice(0,40)}...</p></div>
            </div>
            <button onClick={()=>setOpen(false)} className="text-white/60 hover:text-white">✕</button>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            {msgs.map((m,i)=> (
              <div key={i} className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed max-w-[85%] ${m.role==="user" ? "ml-auto bg-gradient-pink text-white" : "mr-auto bg-white/5 border border-white/10 text-[#cabfe0] whitespace-pre-wrap"}`}>{m.text}</div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {getPageKnowledge(pathname).prompts.slice(0,3).map((p:any)=> (
                <button key={p} onClick={()=>send(p)} className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] text-[#8a7ba8] hover:text-white">{p}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && send(input)} placeholder="Ask KR8 AI anything..." className="flex-1 rounded-full border border-white/15 bg-black/30 px-4 py-2.5 text-xs text-white placeholder:text-[#6f6390] focus:border-pink-400/50 focus:outline-none" />
              <button onClick={()=>send(input)} className="rounded-full bg-gradient-pink px-4 py-2 text-xs font-bold text-white">Send</button>
            </div>
            <p className="mt-1.5 text-[9px] text-center text-[#4a3d5e]">AI companion everywhere · knows site · nudges consistency · DB-connected</p>
          </div>
        </div>
      )}
    </>
  );
}
