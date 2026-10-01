// @ts-nocheck
import "@livekit/components-styles";
import { useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  TrackToggle,
  useTracks,
  useParticipants,
  useLocalParticipant,
  useDataChannel,
  ConnectionStateToast,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  endRoom, moderateParticipant, setAdmission, setRecording, saveRecording,
} from "@/lib/live.functions";
import RoomChat from "./RoomChat";

const EMOJIS = ["👏", "❤️", "😂", "🔥", "🎉", "👍"];

function roleOf(p) {
  try { return JSON.parse(p.metadata || "{}").role || "participant"; } catch { return "participant"; }
}

function Stage({ mode }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: mode === "meeting" }, { source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false },
  );
  const visible = mode === "broadcast" ? tracks.filter((t) => t.publication || roleOf(t.participant) !== "viewer") : tracks;
  const screen = visible.find((t) => t.source === Track.Source.ScreenShare && t.publication);
  if (visible.length === 0)
    return <div className="flex h-full items-center justify-center text-sm text-[#cabfe0]">Waiting for the host to start their camera…</div>;
  if (screen) {
    const others = visible.filter((t) => t !== screen);
    return (
      <div className="flex h-full gap-2">
        <div className="flex-1"><ParticipantTile trackRef={screen} /></div>
        {others.length > 0 && (
          <div className="hidden w-48 flex-col gap-2 overflow-y-auto md:flex">
            {others.map((t) => <div key={t.participant.identity + t.source} className="aspect-video"><ParticipantTile trackRef={t} /></div>)}
          </div>
        )}
      </div>
    );
  }
  return <GridLayout tracks={visible} className="h-full"><ParticipantTile /></GridLayout>;
}

function FloatingReactions() {
  const [items, setItems] = useState([]);
  const { send } = useDataChannel("reactions", (msg) => {
    const emoji = new TextDecoder().decode(msg.payload);
    const id = Math.random();
    setItems((x) => [...x, { id, emoji, left: 10 + Math.random() * 80 }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3000);
  });
  const fire = (e) => {
    send(new TextEncoder().encode(e), { reliable: false });
    const id = Math.random();
    setItems((x) => [...x, { id, emoji: e, left: 10 + Math.random() * 80 }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3000);
  };
  return { fire, layer: (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((i) => (
        <span key={i.id} className="absolute bottom-4 text-3xl animate-[kr8float_3s_ease-out_forwards]" style={{ left: `${i.left}%` }}>{i.emoji}</span>
      ))}
      <style>{`@keyframes kr8float{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-320px);opacity:0}}`}</style>
    </div>
  ) };
}

function People({ room, me, isHost }) {
  const participants = useParticipants();
  const moderate = useServerFn(moderateParticipant);
  const admit = useServerFn(setAdmission);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!isHost || !room.waiting_room) return;
    const load = () => supabase.from("room_admissions").select("*").eq("room_id", room.id).eq("status", "pending").then(({ data }) => setRequests(data || []));
    load();
    const ch = supabase.channel(`adm-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_admissions", filter: `room_id=eq.${room.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isHost, room.id, room.waiting_room]);

  const act = (targetId, action) => moderate({ data: { userId: me.id, roomId: room.id, targetId, action } }).catch((e) => alert(e.message));
  const sorted = [...participants].sort((a, b) => (b.attributes?.hand === "1") - (a.attributes?.hand === "1"));

  return (
    <div className="h-full space-y-4 overflow-y-auto p-3 text-sm">
      {isHost && requests.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-bold uppercase text-amber-300">Waiting to join ({requests.length})</div>
          {requests.map((r) => (
            <div key={r.id} className="mb-1 flex items-center justify-between rounded-lg bg-amber-500/10 px-2 py-1.5">
              <span className="text-white">{r.user_name}</span>
              <span className="flex gap-1">
                <button onClick={() => admit({ data: { userId: me.id, roomId: room.id, targetId: r.user_id, status: "admitted" } })} className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white">Admit</button>
                <button onClick={() => admit({ data: { userId: me.id, roomId: room.id, targetId: r.user_id, status: "denied" } })} className="rounded bg-white/10 px-2 py-0.5 text-xs text-white">Deny</button>
              </span>
            </div>
          ))}
        </div>
      )}
      <div>
        <div className="mb-2 text-xs font-bold uppercase text-[#8e82a8]">In this room ({participants.length})</div>
        {sorted.map((p) => {
          const r = roleOf(p);
          return (
            <div key={p.identity} className="mb-1 flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5">
              <span className="flex items-center gap-2 text-white">
                {p.attributes?.hand === "1" && <span title="Hand raised">✋</span>}
                {p.name || p.identity}
                <span className="text-[10px] uppercase text-[#8e82a8]">{r}{p.isLocal ? " · you" : ""}</span>
                {!p.isMicrophoneEnabled && <span className="text-xs">🔇</span>}
              </span>
              {isHost && !p.isLocal && (
                <span className="flex gap-1 text-xs">
                  <button onClick={() => act(p.identity, "mute")} className="rounded bg-white/10 px-1.5 py-0.5 text-white" title="Mute">🔇</button>
                  {room.mode === "broadcast" && (r === "viewer"
                    ? <button onClick={() => act(p.identity, "make_speaker")} className="rounded bg-white/10 px-1.5 py-0.5 text-white" title="Invite to speak">🎤</button>
                    : <button onClick={() => act(p.identity, "make_viewer")} className="rounded bg-white/10 px-1.5 py-0.5 text-white" title="Move to audience">⬇</button>)}
                  <button onClick={() => act(p.identity, "remove")} className="rounded bg-red-600/70 px-1.5 py-0.5 text-white" title="Remove">✕</button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Recorder({ room, me }) {
  const [rec, setRec] = useState(null);
  const [busy, setBusy] = useState(false);
  const setRecFn = useServerFn(setRecording);
  const saveFn = useServerFn(saveRecording);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true });
      const chunks = [];
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" });
      const startedAt = Date.now();
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setBusy(true);
        const blob = new Blob(chunks, { type: "video/webm" });
        const path = `recordings/${room.id}/${Date.now()}.webm`;
        const { error } = await supabase.storage.from("live-files").upload(path, blob, { contentType: "video/webm" });
        if (!error) await saveFn({ data: { userId: me.id, roomId: room.id, filePath: path, durationSeconds: Math.round((Date.now() - startedAt) / 1000) } });
        else alert("Recording upload failed (the file may be over 500 MB).");
        await setRecFn({ data: { userId: me.id, roomId: room.id, on: false } });
        setBusy(false);
        setRec(null);
      };
      stream.getVideoTracks()[0].onended = () => mr.state !== "inactive" && mr.stop();
      mr.start(1000);
      setRec(mr);
      setRecFn({ data: { userId: me.id, roomId: room.id, on: true } });
    } catch {
      /* user cancelled */
    }
  };
  if (busy) return <button disabled className="rounded-full bg-white/10 px-3 py-2 text-xs text-white">Saving…</button>;
  return rec ? (
    <button onClick={() => rec.stop()} className="rounded-full bg-red-600 px-3 py-2 text-xs font-bold text-white animate-pulse">⏺ Stop recording</button>
  ) : (
    <button onClick={start} className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20" title="Record this session (choose this tab when asked)">⏺ Record</button>
  );
}

function Controls({ room, me, isHost, canPublish, onLeave, onFire, panel, setPanel }) {
  const { localParticipant } = useLocalParticipant();
  const [hand, setHand] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const end = useServerFn(endRoom);
  const toggleHand = async () => {
    const v = !hand; setHand(v);
    await localParticipant.setAttributes({ hand: v ? "1" : "" });
  };
  const btn = "rounded-full px-3 py-2 text-xs font-bold text-white transition";
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/40 p-3">
      {canPublish && (
        <>
          <TrackToggle source={Track.Source.Microphone} className="lk-button" />
          <TrackToggle source={Track.Source.Camera} className="lk-button" />
          <TrackToggle source={Track.Source.ScreenShare} className="lk-button" />
        </>
      )}
      <button onClick={toggleHand} className={`${btn} ${hand ? "bg-amber-500" : "bg-white/10 hover:bg-white/20"}`}>✋ {hand ? "Lower" : "Raise"} hand</button>
      <div className="relative">
        <button onClick={() => setShowEmoji(!showEmoji)} className={`${btn} bg-white/10 hover:bg-white/20`}>😊 React</button>
        {showEmoji && (
          <div className="absolute bottom-11 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-[#1d0b2e] px-2 py-1 shadow-xl">
            {EMOJIS.map((e) => <button key={e} className="text-xl" onClick={() => { onFire(e); setShowEmoji(false); }}>{e}</button>)}
          </div>
        )}
      </div>
      <button onClick={() => setPanel(panel === "chat" ? null : "chat")} className={`${btn} ${panel === "chat" ? "bg-pink-600" : "bg-white/10 hover:bg-white/20"}`}>💬 Chat</button>
      <button onClick={() => setPanel(panel === "people" ? null : "people")} className={`${btn} ${panel === "people" ? "bg-pink-600" : "bg-white/10 hover:bg-white/20"}`}>👥 People</button>
      {isHost && <Recorder room={room} me={me} />}
      <button onClick={onLeave} className={`${btn} bg-white/10 hover:bg-white/20`}>Leave</button>
      {isHost && (
        <button
          onClick={async () => { if (confirm("End this session for everyone?")) { await end({ data: { userId: me.id, roomId: room.id } }); onLeave(); } }}
          className={`${btn} bg-red-600 hover:bg-red-500`}
        >End for all</button>
      )}
    </div>
  );
}

function RoomInner({ room, me, isHost, onLeave }) {
  const [panel, setPanel] = useState("chat");
  const { localParticipant } = useLocalParticipant();
  const canPublish = isHost || room.mode === "meeting" || roleOf(localParticipant) === "speaker";
  const { fire, layer } = FloatingReactions();

  return (
    <div className="flex h-[calc(100vh-80px)] min-h-[560px] flex-col bg-[#0c0414]" data-lk-theme="default">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">LIVE</span>
            {room.is_recording && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-red-300">⏺ REC</span>}
            <h2 className="truncate font-bold text-white">{room.title}</h2>
          </div>
          <p className="text-[11px] text-[#8e82a8]">{room.mode === "broadcast" ? "Broadcast" : "Meeting"} · Host: {room.host_name}{isHost && room.access_key ? ` · Invite key: ${room.access_key}` : ""}</p>
        </div>
        {isHost && (
          <button onClick={() => navigator.clipboard?.writeText(`${location.origin}/live?room=${room.id}`)} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20">Copy link</button>
        )}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 p-2"><Stage mode={room.mode} />{layer}</div>
        {panel && (
          <aside className="absolute inset-x-0 bottom-16 top-28 z-20 flex w-full flex-col border-l border-white/10 bg-[#140720] md:static md:w-80">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm font-bold text-white">
              {panel === "chat" ? "Chat" : "People"}
              <button onClick={() => setPanel(null)} className="text-[#8e82a8]">✕</button>
            </div>
            <div className="min-h-0 flex-1">
              {panel === "chat" ? <RoomChat roomId={room.id} me={me} isHost={isHost} /> : <People room={room} me={me} isHost={isHost} />}
            </div>
          </aside>
        )}
      </div>
      <Controls room={room} me={me} isHost={isHost} canPublish={canPublish} onLeave={onLeave} onFire={fire} panel={panel} setPanel={setPanel} />
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}

export default function LiveRoom({ session, me, onLeave }) {
  const { token, url, isHost, room } = session;
  const [liveRoom, setLiveRoom] = useState(room);
  useEffect(() => {
    const ch = supabase.channel(`room-row-${room.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${room.id}` }, (p) => {
        setLiveRoom(p.new);
        if (!p.new.is_live) onLeave();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room.id]);
  const publishOnJoin = isHost || room.mode === "meeting";
  return (
    <LiveKitRoom serverUrl={url} token={token} connect audio={publishOnJoin} video={publishOnJoin} onDisconnected={onLeave}>
      <RoomInner room={liveRoom} me={me} isHost={isHost} onLeave={onLeave} />
    </LiveKitRoom>
  );
}
