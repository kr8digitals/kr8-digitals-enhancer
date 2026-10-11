import { lazy, Suspense, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight, Camera, LockKeyhole, MessageCircle,
  Mic2, Play, Radio, ShieldCheck, Sparkles, Users, Video,
} from "lucide-react";
import { useSeo } from "../lib/useSeo";
import { useSearchParams } from "../router-shim";
import "../live/live.css";
import ShareRoom from "../live/ShareRoom";
import { supabase } from "@/integrations/supabase/client";
import { createRoom, getRoomToken } from "@/lib/live.functions";
import { useLiveIdentity, signedFileUrl, fmtDuration } from "../live/useLiveIdentity";
import { getLagosNow, getAttendanceStatus, shouldAutoMarkLiveAttendance, type AttendanceType } from "../lib/attendance";
import { useAuth } from "../context/AuthContext";

const LiveRoom = lazy(() => import("../live/LiveRoom"));

type CommunityActivity = {
  id: string;
  action: string;
  message: string;
  created_at: string;
};

function SectionLabel({ children, count }: any) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="live-kicker">{children}</h2>
      {count !== undefined && (
        <span className="live-count"><span className="live-status-dot" />{count} {count === 1 ? "room" : "rooms"} live</span>
      )}
    </div>
  );
}

function RecordingCard({ recording }: any) {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const play = async () => {
    setOpen(true);
    if (!url) setUrl(await signedFileUrl(recording.file_path));
  };
  return (
    <article className="live-recording group">
      <div className="live-recording-media">
        {open && url ? (
          <video src={url} controls autoPlay className="h-full w-full object-cover" />
        ) : (
          <button onClick={play} className="live-play-button" aria-label={`Play ${recording.title}`}>
            <Play size={18} fill="currentColor" />
          </button>
        )}
        <span className="live-duration">{fmtDuration(recording.duration_seconds) || "Replay"}</span>
      </div>
      <h3 className="mt-3 truncate text-sm font-semibold">{recording.title}</h3>
      <div className="live-meta mt-1 flex items-center justify-between gap-3 text-xs">
        <span className="truncate">{recording.host_name}</span>
        <span className="shrink-0">{new Date(recording.created_at).toLocaleDateString()}</span>
      </div>
    </article>
  );
}

function StartForm({ me, onStarted }: any) {
  const create = useServerFn(createRoom);
  const [form, setForm] = useState({ title: "", description: "", mode: "meeting", visibility: "public", waitingRoom: false, roomType: "video" });
  const [busy, setBusy] = useState(false);
  const submit = async (event: any) => {
    event.preventDefault();
    setBusy(true);
    try {
      const room: any = await create({ data: { ...form, userId: me.id, userName: me.name } });
      onStarted(room.id);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="live-studio-panel">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <span className="live-kicker">Host studio</span>
          <h2 className="live-serif mt-2 text-3xl">Open the room.</h2>
          <p className="live-meta mt-1 text-sm">Set the format, invite your people, then go live.</p>
        </div>
        <span className="live-icon-tile"><Video size={22} /></span>
      </div>
      <div className="space-y-3">
        <label className="live-field-label">Session title
          <input required maxLength={140} placeholder="What are we gathering for? Mindset Shift / Hangout / Class" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="live-field" />
        </label>
        <label className="live-field-label">Short description
          <textarea maxLength={1000} rows={2} placeholder="Give people a reason to join." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="live-field resize-none" />
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Session format">
        {[
          ["meeting", "Meeting", "Everyone can speak", Users],
          ["broadcast", "Broadcast", "Hosts lead the room", Radio],
        ].map(([value, label, description, ModeIcon]: any) => (
          <button type="button" key={value} onClick={() => setForm({ ...form, mode: value })} className={`live-mode ${form.mode === value ? "is-active" : ""}`}>
            <ModeIcon size={17} /><span><b>{label}</b><small>{description}</small></span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="live-toggle"><input type="checkbox" checked={form.visibility === "private"} onChange={(event) => setForm({ ...form, visibility: event.target.checked ? "private" : "public" })} /><LockKeyhole size={15} /> Invite key</label>
        <label className="live-toggle"><input type="checkbox" checked={form.waitingRoom} onChange={(event) => setForm({ ...form, waitingRoom: event.target.checked })} /><ShieldCheck size={15} /> Waiting room</label>
      </div>
      <button disabled={busy} className="live-primary mt-5 w-full">
        <Radio size={17} />{busy ? "Opening studio…" : "Go live now"}<ArrowRight size={17} />
      </button>
    </form>
  );
}

function CommunityPulse() {
  const [items, setItems] = useState<CommunityActivity[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("activity_feed")
        .select("id,action,message,created_at")
        .order("created_at", { ascending: false })
        .limit(6);

      if (!active) return;
      if (error) {
        console.warn("Unable to load the public community pulse", error);
        return;
      }
      setItems(data ?? []);
    };

    void load();
    const channel = supabase
      .channel("live-public-activity-pulse")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_feed" },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="live-activity-list">
      {items.length === 0 ? (
        <p className="live-empty-small">The community pulse will appear here.</p>
      ) : (
        items.map((item, index) => (
          <div className="live-activity" key={item.id}>
            <span className="live-avatar">K</span>
            <p className="min-w-0 flex-1 text-sm">
              <span>{item.message}</span>
              <small>
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </p>
            {index === 0 && <span className="live-unread-dot" />}
          </div>
        ))
      )}
    </div>
  );
}

function EntryGate({ gate, guestName, setGuestName, accessKey, setAccessKey, me, join, leave }: any) {
  if (!gate) return null;
  return (
    <div className="live-gate" role="dialog" aria-modal="true" aria-label="Join live room">
      <div className="live-gate-panel">
        <span className="live-icon-tile mx-auto"><Radio size={22} /></span>
        {gate.status === "name" && (
          <form onSubmit={(event) => { event.preventDefault(); if (guestName.trim()) { me.setGuestName(guestName.trim()); setTimeout(() => join(gate.roomId), 0); } }}>
            <h2 className="live-serif mt-4 text-3xl">How should we introduce you?</h2>
            <p className="live-meta mt-2 text-sm">This is the name everyone in the room will see.</p>
            <input autoFocus required maxLength={60} value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Your name" className="live-field mt-5" />
            <button className="live-primary mt-3 w-full">Continue <ArrowRight size={17} /></button>
          </form>
        )}
        {gate.status === "needs_key" && (
          <form onSubmit={(event) => { event.preventDefault(); join(gate.roomId, accessKey); }}>
            <h2 className="live-serif mt-4 text-3xl">This room is private.</h2>
            <p className="live-meta mt-2 text-sm">Enter the invite key shared by the host.</p>
            <input autoFocus required value={accessKey} onChange={(event) => setAccessKey(event.target.value)} placeholder="KR8-XXXXXX" className="live-field mt-5 uppercase" />
            <button className="live-primary mt-3 w-full">Enter room <ArrowRight size={17} /></button>
          </form>
        )}
        {gate.status === "waiting" && <><h2 className="live-serif mt-4 text-3xl">You’re in the lobby.</h2><p className="live-meta mt-2 text-sm">The host has your request and will let you in shortly.</p></>}
        {gate.status === "denied" && <><h2 className="live-serif mt-4 text-3xl">Not admitted.</h2><p className="live-meta mt-2 text-sm">The host couldn’t let you into this session.</p></>}
        {gate.status === "ended" && <><h2 className="live-serif mt-4 text-3xl">That’s a wrap.</h2><p className="live-meta mt-2 text-sm">This live room has ended. Look for its replay below.</p></>}
        <button onClick={leave} className="live-secondary mt-3 w-full">Back to KR8 Live</button>
      </div>
    </div>
  );
}

function KR8IDPrompt({ onSubmit, onSkip, defaultName }: { onSubmit: (kr8: string, name: string) => void; onSkip: () => void; defaultName: string }) {
  const [kr8, setKr8] = useState("");
  const [name, setName] = useState(defaultName || "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-pink-500/30 bg-[#1a0030] p-6 shadow-2xl">
        <h3 className="font-display font-black text-white text-xl">🎯 Link Your KR8 Profile?</h3>
        <p className="text-xs text-[#b8aecf] mt-2 leading-relaxed">You're joining live! If you have a KR8 ID, enter it to auto-record Mindset/Hangout attendance (1st, 3rd, last Sunday 10PM-11PM WAT). No account needed to join — but account needed to save attendance to profile & appear in live feed.</p>
        <div className="mt-4 space-y-3">
          <input value={kr8} onChange={e => setKr8(e.target.value.toUpperCase())} placeholder="KR8 ID e.g. KR8-GRA-12345" className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white font-mono" />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name (for live room)" className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white" />
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onSkip} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white">Skip — Join as Guest</button>
          <button onClick={() => onSubmit(kr8.trim(), name.trim())} className="flex-1 rounded-xl bg-gradient-pink px-4 py-2.5 text-xs font-bold text-white">Save & Join Live →</button>
        </div>
        <p className="text-[10px] text-[#6a5b82] mt-3 text-center">Don't have account? <a href="/register" className="text-pink-400 underline">Create one</a> — optional, you can still join.</p>
      </div>
    </div>
  );
}

export default function LivePage() {
  useSeo({ path: "/live", noindex: true });
  const me = useLiveIdentity();
  const { student } = useAuth() as any;
  const [params, setParams] = useSearchParams();
  const roomParam = params.get("room");
  const getToken = useServerFn(getRoomToken);
  const [rooms, setRooms] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [gate, setGate] = useState<any>(null);
  const [accessKey, setAccessKey] = useState("");
  const [guestName, setGuestName] = useState("");
  const [kr8Prompt, setKr8Prompt] = useState<{ roomId: string; key?: string } | null>(null);
  const [pendingJoin, setPendingJoin] = useState<{ roomId: string; key?: string; kr8?: string; name?: string } | null>(null);
  const [attendanceBanner, setAttendanceBanner] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      supabase.from("live_rooms").select("*").eq("is_live", true).order("started_at", { ascending: false }).then(({ data }) => setRooms(data || []));
      supabase.from("recordings").select("*").order("created_at", { ascending: false }).limit(30).then(({ data }) => setRecordings(data || []));
    };
    load();
    const channel = supabase.channel("live-hub").on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" }, load).on("postgres_changes", { event: "*", schema: "public", table: "recordings" }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const autoMarkLive = async (roomId: string, roomTitle: string, purpose: string) => {
    try {
      const now = getLagosNow();
      let type: AttendanceType | null = null;
      const lower = `${roomTitle} ${purpose}`.toLowerCase();
      if (lower.includes('mindset') || lower.includes('shift')) type = 'mindset';
      else if (lower.includes('hangout')) type = 'hangout';
      else {
        const mindsetStatus = getAttendanceStatus('mindset', {}, now);
        const hangoutStatus = getAttendanceStatus('hangout', {}, now);
        if (mindsetStatus.isOpen) type = 'mindset';
        else if (hangoutStatus.isOpen) type = 'hangout';
      }
      if (!type) return;
      const attendanceStatus = getAttendanceStatus(type, {}, now);
      if (!attendanceStatus.isOpen) return;
      const should = shouldAutoMarkLiveAttendance(purpose, type, now);
      if (!should) return;
      if (!student?.id || !student?.kr8_id) {
        setAttendanceBanner("Sign in with your KR8 account to auto-mark attendance.");
        setTimeout(() => setAttendanceBanner(null), 6000);
        return;
      }
      const { data: attendanceId, error } = await supabase.rpc('auto_mark_live_attendance', {
        p_user_id: student.id,
        p_kr8_id: student.kr8_id,
        p_live_room_id: roomId,
        p_live_purpose: purpose,
        p_type: type,
      });
      if (error) throw error;
      if (attendanceId) {
        setAttendanceBanner(`✅ ${type} attendance confirmed for this live session.`);
        window.dispatchEvent(new Event('kr8:attendance-updated'));
      }
      setTimeout(() => setAttendanceBanner(null), 6000);
    } catch (e: any) {
      console.warn('auto-mark failed', e.message);
    }
  };

  const join = async (roomId: string, key?: string, kr8Override?: string, nameOverride?: string) => {
    const effectiveName = nameOverride || me.name || guestName || student?.name;
    if (!effectiveName) { setGate({ status: "name", roomId }); return; }
    try {
      const result: any = await getToken({ data: { roomId, userId: me.id || student?.id, userName: effectiveName, accessKey: key || undefined } } as any);
      if (result.status === "ok") {
        setGate(null);
        setSession(result);
        const room = rooms.find((r: any) => r.id === roomId);
        setTimeout(() => autoMarkLive(roomId, room?.title || '', room?.purpose || room?.title || 'live'), 1500);
      } else setGate({ status: result.status, roomId });
    } catch (error: any) { alert(error.message); }
  };

  useEffect(() => { if (roomParam && me.id && !session) { const k = params.get("key") || ""; if (k) setAccessKey(k); join(roomParam, k); } }, [roomParam, me.id, me.name]);
  useEffect(() => {
    if (gate?.status !== "waiting") return;
    const channel = supabase.channel(`wait-${gate.roomId}-${me.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_admissions", filter: `room_id=eq.${gate.roomId}` }, (payload: any) => {
      if (payload.new.user_id === me.id) join(gate.roomId, accessKey);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gate?.status, gate?.roomId]);

  const enter = (roomId: string) => {
    if (!student && !me.name) {
      setKr8Prompt({ roomId });
      setPendingJoin({ roomId });
      return;
    }
    setParams({ room: roomId });
    join(roomId);
  };
  const leave = () => { setSession(null); setGate(null); setParams({}); };
  if (session) return <Suspense fallback={<div className="live-hub flex min-h-screen items-center justify-center">Joining the room…</div>}><LiveRoom session={session} me={{ id: me.id || student?.id, name: me.name || student?.name }} onLeave={leave} /></Suspense>;

  return (
    <div className="live-hub min-h-screen">
      <EntryGate gate={gate} guestName={guestName} setGuestName={setGuestName} accessKey={accessKey} setAccessKey={setAccessKey} me={me} join={join} leave={leave} />
      {attendanceBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-2xl border border-emerald-400 animate-pulse">
          {attendanceBanner}
        </div>
      )}
      {kr8Prompt && (
        <KR8IDPrompt
          defaultName={me.name || student?.name || guestName || ""}
          onSkip={() => {
            setKr8Prompt(null);
            const rId = pendingJoin?.roomId || kr8Prompt.roomId;
            setParams({ room: rId });
            join(rId, pendingJoin?.key || accessKey);
          }}
          onSubmit={(kr8Id, name) => {
            setPendingJoin({ roomId: kr8Prompt.roomId, key: accessKey, kr8: kr8Id, name });
            setKr8Prompt(null);
            if (name) setGuestName(name);
            if (name) me.setGuestName(name);
            setParams({ room: kr8Prompt.roomId });
            join(kr8Prompt.roomId, accessKey, kr8Id, name);
          }}
        />
      )}
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <header className="live-page-head mb-8">
          <div>
            <div className="mb-2 flex items-center gap-2"><span className="live-brand-mark">K</span><span className="live-kicker">KR8 Live · Auto Attendance</span></div>
            <h1 className="live-serif max-w-3xl text-4xl sm:text-6xl">Be in the room<br className="hidden sm:block" /> where ideas move.</h1>
            <p className="live-meta mt-3 max-w-xl text-sm leading-relaxed sm:text-base">Mindset Shift (1st & 3rd Sunday) & Hangout (last Sunday) 7PM-11PM WAT — attendance auto-marked 10PM-11PM when you join live. Everyone in stream linked to profiles; enter KR8 ID if not signed in. No account needed to join, account needed to save to profile & appear in live feed.</p>
          </div>
          <div className="live-head-stats">
            <span><b>{rooms.length}</b> on air</span><span><b>{recordings.length}</b> replays</span>
          </div>
        </header>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="min-w-0 space-y-10">
            <section>
              <SectionLabel count={rooms.length}>Live now</SectionLabel>
              {rooms.length === 0 ? (
                <div className="live-empty-stage">
                  <div className="live-empty-visual"><img src="/branding/kr8_logo.png" alt="" /><span><Radio size={20} /></span></div>
                  <h2 className="live-serif mt-6 text-3xl">The stage is quiet—for now.</h2>
                  <p className="live-meta mt-2 max-w-md text-sm">When a host opens a class, conversation, or broadcast, you’ll see it here instantly.</p>
                </div>
              ) : (
                <div className="live-room-grid">
                  {rooms.map((room: any, index: number) => (
                    <article key={room.id} className={`live-room-card ${index === 0 ? "is-featured" : ""}`}>
                      <div className="live-room-visual">
                        <img src="/branding/kr8_logo.png" alt="" />
                        <div className="live-room-badges"><span className="live-badge-on"><i />Live</span><span className="live-badge-neutral">{room.mode}</span>{room.visibility === "private" && <span className="live-badge-neutral"><LockKeyhole size={11} /> Invite</span>}</div>
                        <div className="live-room-icon"><Camera size={index === 0 ? 34 : 24} /></div>
                      </div>
                      <div className="live-room-copy">
                        <p className="live-kicker">Hosted by {room.host_name}</p>
                        <h3 className="live-serif mt-2 text-2xl">{room.title}</h3>
                        <p className="live-meta mt-2 line-clamp-2 text-sm">{room.description || (room.mode === "meeting" ? "Join the table. Your camera, voice, and ideas are welcome." : "Watch the stage and join the conversation in live chat.")}</p>
                        <button onClick={() => enter(room.id)} className="live-primary mt-5 w-full sm:w-auto">Join live room <ArrowRight size={17} /></button>
                        <ShareRoom room={room} className="mt-3" />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionLabel>Recent replays</SectionLabel>
              {recordings.length === 0 ? <div className="live-empty-line"><Play size={18} /><span><b>No replays yet.</b> Finished sessions will be saved here.</span></div> : <div className="live-recording-row">{recordings.map((recording: any) => <RecordingCard key={recording.id} recording={recording} />)}</div>}
            </section>
          </main>

          <aside className="space-y-7">
            {me.isHost ? <StartForm me={me} onStarted={enter} /> : (
              <div className="live-studio-panel">
                <span className="live-kicker">Your seat is ready</span>
                <h2 className="live-serif mt-3 text-3xl">Enter without the friction.</h2>
                <p className="live-meta mt-3 text-sm leading-relaxed">Meetings put everyone at the table. Broadcasts keep the stage focused while the conversation stays open.</p>
                <div className="mt-5 space-y-3">
                  <div className="live-feature-row"><Mic2 size={17} /><span><b>Speak naturally</b><small>Camera, mic, screen share and raised hands.</small></span></div>
                  <div className="live-feature-row"><MessageCircle size={17} /><span><b>Stay in the conversation</b><small>Replies, reactions, files and read receipts.</small></span></div>
                  <div className="live-feature-row"><ShieldCheck size={17} /><span><b>Join with confidence</b><small>Invite keys and host-managed waiting rooms.</small></span></div>
                </div>
              </div>
            )}
            <section>
              <SectionLabel>Community pulse</SectionLabel>
              <CommunityPulse />
            </section>
            <div className="live-note"><Sparkles size={17} /><p><b>Never miss the moment.</b><span>Live rooms update here automatically across every device.</span></p></div>
          </aside>
        </div>
      </div>
    </div>
  );
}
