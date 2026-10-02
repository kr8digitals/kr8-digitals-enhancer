// @ts-nocheck
import { lazy, Suspense, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight, CalendarDays, Camera, Clock3, LockKeyhole, MessageCircle,
  Mic2, Play, Radio, ShieldCheck, Sparkles, Users, Video,
} from "lucide-react";
import { useSeo } from "../lib/useSeo";
import { useSearchParams } from "../router-shim";
import { supabase } from "@/integrations/supabase/client";
import { createRoom, getRoomToken } from "@/lib/live.functions";
import { useLiveIdentity, signedFileUrl, fmtDuration } from "../live/useLiveIdentity";

const LiveRoom = lazy(() => import("../live/LiveRoom"));

const activityCopy = {
  page_view: "explored KR8",
  sign_in: "signed in",
  sign_up: "joined KR8",
  sign_out: "signed out",
  live_join: "joined a live room",
  live_message: "sent a message live",
  stream_join: "joined a broadcast",
};

function SectionLabel({ children, count }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="live-kicker">{children}</h2>
      {count !== undefined && (
        <span className="live-count"><span className="live-status-dot" />{count} {count === 1 ? "room" : "rooms"} live</span>
      )}
    </div>
  );
}

function RecordingCard({ recording }) {
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

function StartForm({ me, onStarted }) {
  const create = useServerFn(createRoom);
  const [form, setForm] = useState({ title: "", description: "", mode: "meeting", visibility: "public", waitingRoom: false });
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const room = await create({ data: { ...form, userId: me.id, userName: me.name } });
      onStarted(room.id);
    } catch (error) {
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
          <input required maxLength={140} placeholder="What are we gathering for?" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="live-field" />
        </label>
        <label className="live-field-label">Short description
          <textarea maxLength={1000} rows={2} placeholder="Give people a reason to join." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="live-field resize-none" />
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Session format">
        {[
          ["meeting", "Meeting", "Everyone can speak", Users],
          ["broadcast", "Broadcast", "Hosts lead the room", Radio],
        ].map(([value, label, description, ModeIcon]) => (
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
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    const load = () => supabase.from("activity_log").select("id,actor_name,action,target,created_at").order("created_at", { ascending: false }).limit(6)
      .then(({ data }) => alive && setItems(data || []));
    load();
    const channel = supabase.channel("live-activity-pulse").on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, load).subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="live-activity-list">
      {items.length === 0 ? <p className="live-empty-small">The community pulse will appear here.</p> : items.map((item, index) => (
        <div className="live-activity" key={item.id}>
          <span className="live-avatar">{(item.actor_name || "K").charAt(0).toUpperCase()}</span>
          <p className="min-w-0 flex-1 text-sm"><b>{item.actor_name || "A KR8 member"}</b> <span>{activityCopy[item.action] || item.action.replaceAll("_", " ")}</span><small>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></p>
          {index === 0 && <span className="live-unread-dot" />}
        </div>
      ))}
    </div>
  );
}

function EntryGate({ gate, guestName, setGuestName, accessKey, setAccessKey, me, join, leave }) {
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

export default function LivePage() {
  useSeo({ path: "/live", noindex: true });
  const me = useLiveIdentity();
  const [params, setParams] = useSearchParams();
  const roomParam = params.get("room");
  const getToken = useServerFn(getRoomToken);
  const [rooms, setRooms] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [session, setSession] = useState(null);
  const [gate, setGate] = useState(null);
  const [accessKey, setAccessKey] = useState("");
  const [guestName, setGuestName] = useState("");

  useEffect(() => {
    const load = () => {
      supabase.from("live_rooms").select("*").eq("is_live", true).order("started_at", { ascending: false }).then(({ data }) => setRooms(data || []));
      supabase.from("recordings").select("*").order("created_at", { ascending: false }).limit(30).then(({ data }) => setRecordings(data || []));
    };
    load();
    const channel = supabase.channel("live-hub").on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" }, load).on("postgres_changes", { event: "*", schema: "public", table: "recordings" }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const join = async (roomId, key) => {
    if (!me.name) { setGate({ status: "name", roomId }); return; }
    try {
      const result = await getToken({ data: { roomId, userId: me.id, userName: me.name, accessKey: key || undefined } });
      if (result.status === "ok") { setGate(null); setSession(result); }
      else setGate({ status: result.status, roomId });
    } catch (error) { alert(error.message); }
  };

  useEffect(() => { if (roomParam && me.id && !session) join(roomParam); }, [roomParam, me.id, me.name]);
  useEffect(() => {
    if (gate?.status !== "waiting") return;
    const channel = supabase.channel(`wait-${gate.roomId}-${me.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_admissions", filter: `room_id=eq.${gate.roomId}` }, (payload) => {
      if (payload.new.user_id === me.id) join(gate.roomId, accessKey);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gate?.status, gate?.roomId]);

  const enter = (roomId) => setParams({ room: roomId });
  const leave = () => { setSession(null); setGate(null); setParams({}); };
  if (session) return <Suspense fallback={<div className="live-hub flex min-h-screen items-center justify-center">Joining the room…</div>}><LiveRoom session={session} me={{ id: me.id, name: me.name }} onLeave={leave} /></Suspense>;

  return (
    <div className="live-hub min-h-screen">
      <EntryGate gate={gate} guestName={guestName} setGuestName={setGuestName} accessKey={accessKey} setAccessKey={setAccessKey} me={me} join={join} leave={leave} />
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <header className="live-page-head mb-8">
          <div>
            <div className="mb-2 flex items-center gap-2"><span className="live-brand-mark">K</span><span className="live-kicker">KR8 Live</span></div>
            <h1 className="live-serif max-w-3xl text-4xl sm:text-6xl">Be in the room<br className="hidden sm:block" /> where ideas move.</h1>
            <p className="live-meta mt-3 max-w-xl text-sm leading-relaxed sm:text-base">Meet face to face, follow the conversation, or take the stage. One clear space for every live KR8 moment.</p>
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
                  {rooms.map((room, index) => (
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
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionLabel>Recent replays</SectionLabel>
              {recordings.length === 0 ? <div className="live-empty-line"><Play size={18} /><span><b>No replays yet.</b> Finished sessions will be saved here.</span></div> : <div className="live-recording-row">{recordings.map((recording) => <RecordingCard key={recording.id} recording={recording} />)}</div>}
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