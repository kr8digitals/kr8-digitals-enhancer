// @ts-nocheck
import { lazy, Suspense, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSeo } from "../lib/useSeo";
import { useSearchParams } from "../router-shim";
import { supabase } from "@/integrations/supabase/client";
import { createRoom, getRoomToken } from "@/lib/live.functions";
import { useLiveIdentity, signedFileUrl, fmtDuration } from "../live/useLiveIdentity";
import { Pill } from "../components/ui";
import LiveFeed from "../components/LiveFeed";

const LiveRoom = lazy(() => import("../live/LiveRoom"));

function RecordingCard({ r }) {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const play = async () => { setOpen(true); if (!url) setUrl(await signedFileUrl(r.file_path)); };
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#160824] p-3">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        {open && url ? (
          <video src={url} controls autoPlay className="h-full w-full" />
        ) : (
          <button onClick={play} className="flex h-full w-full items-center justify-center text-white">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-600/90 text-lg">▶</span>
          </button>
        )}
      </div>
      <h4 className="mt-2 line-clamp-1 text-sm font-bold text-white">{r.title}</h4>
      <div className="mt-1 flex justify-between text-[11px] text-[#8e82a8]">
        <span>{r.host_name}</span>
        <span>{new Date(r.created_at).toLocaleDateString()} {fmtDuration(r.duration_seconds)}</span>
      </div>
    </div>
  );
}

function StartForm({ me, onStarted }) {
  const create = useServerFn(createRoom);
  const [f, setF] = useState({ title: "", description: "", mode: "meeting", visibility: "public", waitingRoom: false });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await create({ data: { ...f, userId: me.id, userName: me.name } });
      onStarted(r.id);
    } catch (err) { alert(err.message); }
    setBusy(false);
  };
  const input = "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-pink-400 focus:outline-none";
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-pink-500/30 bg-[#160824] p-5">
      <h3 className="font-display text-lg font-bold text-white">Start a live session</h3>
      <input required maxLength={140} placeholder="Session title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={input} />
      <textarea maxLength={1000} rows={2} placeholder="What's it about? (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={input} />
      <div className="grid gap-2 sm:grid-cols-2">
        {[["meeting", "Meeting", "Everyone can talk and share video"], ["broadcast", "Broadcast", "Hosts present, audience watches & chats"]].map(([v, l, d]) => (
          <button type="button" key={v} onClick={() => setF({ ...f, mode: v })} className={`rounded-xl border p-3 text-left ${f.mode === v ? "border-pink-500 bg-pink-500/10" : "border-white/10"}`}>
            <div className="text-sm font-bold text-white">{l}</div><div className="text-[11px] text-[#cabfe0]">{d}</div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-[#cabfe0]">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.visibility === "private"} onChange={(e) => setF({ ...f, visibility: e.target.checked ? "private" : "public" })} /> Invite key required</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.waitingRoom} onChange={(e) => setF({ ...f, waitingRoom: e.target.checked })} /> Waiting room (I admit people)</label>
      </div>
      <button disabled={busy} className="w-full rounded-xl bg-gradient-pink py-3 text-sm font-black text-white disabled:opacity-60">{busy ? "Starting…" : "Go live now"}</button>
    </form>
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
  const [gate, setGate] = useState(null); // {status, roomId}
  const [key, setKey] = useState("");
  const [guestName, setGuestName] = useState("");

  useEffect(() => {
    const load = () => {
      supabase.from("live_rooms").select("*").eq("is_live", true).order("started_at", { ascending: false }).then(({ data }) => setRooms(data || []));
      supabase.from("recordings").select("*").order("created_at", { ascending: false }).limit(30).then(({ data }) => setRecordings(data || []));
    };
    load();
    const ch = supabase.channel("live-hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "recordings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const join = async (roomId, accessKey) => {
    if (!me.name) { setGate({ status: "name", roomId }); return; }
    try {
      const r = await getToken({ data: { roomId, userId: me.id, userName: me.name, accessKey: accessKey || undefined } });
      if (r.status === "ok") { setGate(null); setSession(r); }
      else setGate({ status: r.status, roomId });
    } catch (e) { alert(e.message); }
  };

  useEffect(() => { if (roomParam && me.id && !session) join(roomParam); }, [roomParam, me.id, me.name]);

  // waiting room: poll admission status via realtime
  useEffect(() => {
    if (gate?.status !== "waiting") return;
    const ch = supabase.channel(`wait-${gate.roomId}-${me.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_admissions", filter: `room_id=eq.${gate.roomId}` }, (p) => {
        if (p.new.user_id === me.id) join(gate.roomId, key);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gate?.status, gate?.roomId]);

  const enter = (roomId) => setParams({ room: roomId });
  const leave = () => { setSession(null); setGate(null); setParams({}); };

  if (session) {
    return (
      <Suspense fallback={<div className="p-10 text-center text-white">Joining…</div>}>
        <LiveRoom session={session} me={{ id: me.id, name: me.name }} onLeave={leave} />
      </Suspense>
    );
  }

  return (
    <div className="section-bg min-h-screen py-12">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center">
          <Pill>KR8 Live</Pill>
          <h1 className="font-display mt-4 text-4xl font-bold text-white sm:text-6xl">Live <span className="text-gradient">classes & meetings</span></h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[#cabfe0]">Join live classes, talk face to face, chat with the community and catch up on recordings.</p>
        </div>

        {gate && (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 text-center">
            {gate.status === "name" && (
              <form onSubmit={(e) => { e.preventDefault(); if (guestName.trim()) { me.setGuestName(guestName.trim()); setTimeout(() => join(gate.roomId), 0); } }} className="space-y-3">
                <p className="text-sm text-white">What name should others see?</p>
                <input autoFocus maxLength={60} value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white" />
                <button className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-bold text-white">Continue</button>
              </form>
            )}
            {gate.status === "needs_key" && (
              <form onSubmit={(e) => { e.preventDefault(); join(gate.roomId, key); }} className="space-y-3">
                <p className="text-sm text-white">This session needs an invite key.</p>
                <input autoFocus value={key} onChange={(e) => setKey(e.target.value)} placeholder="KR8-XXXXXX" className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white" />
                <button className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white">Join</button>
              </form>
            )}
            {gate.status === "waiting" && <p className="text-sm text-white">⏳ Waiting for the host to let you in…</p>}
            {gate.status === "denied" && <p className="text-sm text-red-300">The host didn't admit you to this session.</p>}
            {gate.status === "ended" && <p className="text-sm text-[#cabfe0]">This session has ended.</p>}
            <button onClick={leave} className="mt-3 text-xs text-[#8e82a8] underline">Back</button>
          </div>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div>
            <h3 className="mb-4 font-display text-2xl font-bold text-white">Live now</h3>
            {rooms.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#160824] p-8 text-center text-sm text-[#cabfe0]">Nothing is live right now. Check back soon.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {rooms.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-purple-950/60 to-pink-950/40 p-5">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-white animate-pulse">● Live</span>
                      <span className="rounded-full bg-black/40 px-2 py-0.5 text-[#cabfe0]">{r.mode}</span>
                      {r.visibility === "private" && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">🔒 Invite</span>}
                    </div>
                    <h4 className="mt-3 text-lg font-bold text-white">{r.title}</h4>
                    <p className="text-xs text-[#cabfe0]">Host: {r.host_name}</p>
                    {r.description && <p className="mt-1 line-clamp-2 text-xs text-[#8e82a8]">{r.description}</p>}
                    <button onClick={() => enter(r.id)} className="mt-4 w-full rounded-xl bg-gradient-pink py-2 text-sm font-black text-white">Join →</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>{me.isHost ? <StartForm me={me} onStarted={enter} /> : (
            <div className="rounded-2xl border border-white/10 bg-[#160824] p-5 text-sm text-[#cabfe0]">
              Sessions are started by KR8 hosts. When one goes live it appears here instantly.
            </div>
          )}</div>
        </div>

        <div className="mt-14">
          <h3 className="mb-4 font-display text-2xl font-bold text-white">Recordings</h3>
          {recordings.length === 0 ? (
            <p className="text-sm text-[#8e82a8]">No recordings yet.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recordings.map((r) => <RecordingCard key={r.id} r={r} />)}</div>
          )}
        </div>

        <div className="mt-16">
          <h3 className="mb-4 font-display text-xl font-bold text-white">Community activity</h3>
          <LiveFeed />
        </div>
      </div>
    </div>
  );
}
