// Fixed LiveRoom - secure, shows errors, camera/mic failures don't eject user
import ShareRoom from "./ShareRoom";
import "@livekit/components-styles";
import { useEffect, useState, useCallback } from "react";
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
  useRoomContext,
} from "@livekit/components-react";
import { Track, RoomEvent, ConnectionState } from "livekit-client";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  endRoom, moderateParticipant, setAdmission, setRecording, saveRecording,
} from "@/lib/live.functions";
import RoomChat from "./RoomChat";

const EMOJIS = ["👏", "❤️", "😂", "🔥", "🎉", "👍"];

function roleOf(p: any) {
  try { return JSON.parse(p.metadata || "{}").role || "participant"; } catch { return "participant"; }
}

function Stage({ mode, roomType }: { mode: string; roomType?: string }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: mode === "meeting" }, { source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false },
  );
  const isAudioOnly = roomType === 'audio';
  const visible = isAudioOnly ? [] : (mode === "broadcast" ? tracks.filter((t) => t.publication || roleOf(t.participant) !== "viewer") : tracks);
  const screen = visible.find((t) => t.source === Track.Source.ScreenShare && t.publication);
  if (isAudioOnly) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-sm text-[#cabfe0] p-8">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-pink-500/20 text-pink-300">
          <span className="text-3xl">🎙️</span>
        </div>
        <p className="text-lg font-bold text-white">Audio Room - Voice Only</p>
        <p className="mt-2 text-xs text-[#8a7ba8] text-center max-w-sm">This is an audio-only room. No camera needed. Use mic, hand raise, chat, and recording.</p>
        <p className="mt-4 text-xs text-[#cabfe0]">Participants: {visible.length || 'audio listeners'}</p>
      </div>
    );
  }
  if (visible.length === 0)
    return <div className="flex h-full items-center justify-center text-sm text-[#cabfe0]">Waiting for participants... You can still chat!</div>;
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
  const [items, setItems] = useState<any[]>([]);
  const { send } = useDataChannel("reactions", (msg) => {
    const emoji = new TextDecoder().decode(msg.payload);
    const id = Math.random();
    setItems((x) => [...x, { id, emoji, left: 10 + Math.random() * 80 }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3000);
  });
  const fire = (e: string) => {
    try { send(new TextEncoder().encode(e), { reliable: false }); } catch {}
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

function People({ room, me, isHost }: any) {
  const participants = useParticipants();
  const moderate = useServerFn(moderateParticipant);
  const admit = useServerFn(setAdmission);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!isHost || !room.waiting_room) return;
    const load = () => supabase.from("room_admissions").select("*").eq("room_id", room.id).eq("status", "pending").then(({ data }) => setRequests(data || []));
    load();
    const ch = supabase.channel(`adm-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_admissions", filter: `room_id=eq.${room.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isHost, room.id, room.waiting_room]);

  const act = (targetId: string, action: string) => moderate({ data: { roomId: room.id, targetId, action: action as any } }).catch((e: any) => alert(e.message));
  const sorted = [...participants].sort((a, b) => (b.attributes?.hand === "1" ? 1 : 0) - (a.attributes?.hand === "1" ? 1 : 0));

  return (
    <div className="h-full space-y-4 overflow-y-auto p-3 text-sm">
      {isHost && requests.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-bold uppercase text-amber-300">Waiting to join ({requests.length})</div>
          {requests.map((r) => (
            <div key={r.id} className="mb-1 flex items-center justify-between rounded-lg bg-amber-500/10 px-2 py-1.5">
              <span className="text-white">{r.user_name}</span>
              <span className="flex gap-1">
                <button onClick={() => admit({ data: { roomId: room.id, targetId: r.user_id, status: "admitted" } })} className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white">Admit</button>
                <button onClick={() => admit({ data: { roomId: room.id, targetId: r.user_id, status: "denied" } })} className="rounded bg-white/10 px-2 py-0.5 text-xs text-white">Deny</button>
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

function Recorder({ room }: any) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [busy, setBusy] = useState(false);
  const setRecFn = useServerFn(setRecording);
  const saveFn = useServerFn(saveRecording);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true } as any);
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" });
      const startedAt = Date.now();
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setBusy(true);
        const blob = new Blob(chunks, { type: "video/webm" });
        const path = `recordings/${room.id}/${Date.now()}.webm`;
        const { error } = await supabase.storage.from("live-files").upload(path, blob, { contentType: "video/webm" });
        if (!error) await saveFn({ data: { roomId: room.id, filePath: path, durationSeconds: Math.round((Date.now() - startedAt) / 1000) } });
        else alert("Recording upload failed (the file may be over 500 MB).");
        await setRecFn({ data: { roomId: room.id, on: false } });
        setBusy(false);
        setRec(null);
      };
      stream.getVideoTracks()[0].onended = () => mr.state !== "inactive" && mr.stop();
      mr.start(1000);
      setRec(mr);
      setRecFn({ data: { roomId: room.id, on: true } });
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

function Controls({ room, isHost, canPublish, onLeave, onFire, panel, setPanel, connectionError }: any) {
  const { localParticipant } = useLocalParticipant();
  const [hand, setHand] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const end = useServerFn(endRoom);
  const toggleHand = async () => {
    const v = !hand; setHand(v);
    try { await localParticipant.setAttributes({ hand: v ? "1" : "" }); } catch {}
  };
  const btn = "rounded-full px-3 py-2 text-xs font-bold text-white transition";
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/40 p-3">
      {connectionError && (
        <div className="w-full mb-2 rounded-lg bg-red-500/20 border border-red-500/40 px-3 py-2 text-xs text-red-200 text-center">
          ⚠️ {connectionError} - You remain in the room, chat still works.
        </div>
      )}
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
      {isHost && <Recorder room={room} />}
      <button onClick={onLeave} className={`${btn} bg-white/10 hover:bg-white/20`}>Leave</button>
      {isHost && (
        <button
          onClick={async () => { if (confirm("End this session for everyone?")) { await end({ data: { roomId: room.id } }); onLeave(); } }}
          className={`${btn} bg-red-600 hover:bg-red-500`}
        >End for all</button>
      )}
    </div>
  );
}

function RoomInner({ room, me, isHost, onLeave }: any) {
  const [panel, setPanel] = useState<string | null>(null); // Chat closed by default, opened only by user
  const { localParticipant } = useLocalParticipant();
  const roomContext = useRoomContext();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const canPublish = isHost || room.mode === "meeting" || roleOf(localParticipant) === "speaker";
  const { fire, layer } = FloatingReactions();

  // Handle room events for better error reporting
  useEffect(() => {
    if (!roomContext) return;

    const handleDisconnected = () => {
      // Don't auto-leave on disconnect - show error and allow reconnect
      setConnectionError("Connection lost. Trying to reconnect... You can still chat.");
    };

    const handleConnectionStateChanged = (state: ConnectionState) => {
      if (state === ConnectionState.Connected) {
        setConnectionError(null);
      } else if (state === ConnectionState.Disconnected) {
        setConnectionError("Disconnected from live room. Check your internet.");
      }
    };

    const handleMediaDevicesError = (error: Error) => {
      // Camera/mic failures must NOT eject user from room
      setMediaError(`Media error: ${error.message}. You remain in room with chat.`);
      setTimeout(() => setMediaError(null), 5000);
    };

    roomContext.on(RoomEvent.Disconnected, handleDisconnected);
    roomContext.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    roomContext.on(RoomEvent.MediaDevicesError, handleMediaDevicesError as any);

    return () => {
      roomContext.off(RoomEvent.Disconnected, handleDisconnected);
      roomContext.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      roomContext.off(RoomEvent.MediaDevicesError, handleMediaDevicesError as any);
    };
  }, [roomContext]);

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
          {mediaError && <p className="text-[11px] text-amber-300 mt-1">⚠️ {mediaError}</p>}
        </div>
        <ShareRoom room={room} withKey={isHost} />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 p-2"><Stage mode={room.mode} roomType={room.room_type || (room.audio_only ? 'audio' : 'video')} />{layer}</div>
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
      <Controls room={room} me={me} isHost={isHost} canPublish={canPublish} onLeave={onLeave} onFire={fire} panel={panel} setPanel={setPanel} connectionError={connectionError} />
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}

export default function LiveRoom({ session, me, onLeave }: any) {
  const { token, url, isHost, room } = session;
  const [liveRoom, setLiveRoom] = useState(room);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    const ch = supabase.channel(`room-row-${room.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${room.id}` }, (p: any) => {
        setLiveRoom(p.new);
        if (!p.new.is_live) onLeave();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room.id, onLeave]);

  const handleError = useCallback((err: Error) => {
    console.error("LiveKit error:", err);
    setError(err.message);
    // Don't auto-leave on error - show error and allow user to stay or retry
  }, []);

  const handleConnected = useCallback(() => {
    setIsConnecting(false);
    setError(null);
  }, []);

  const handleDisconnected = useCallback((reason?: any) => {
    console.log("LiveKit disconnected:", reason);
    // Only leave if room ended, not on connection failure
    if (reason === "ROOM_ENDED" || reason === "PARTICIPANT_REMOVED") {
      onLeave();
    } else {
      setError(`Disconnected: ${reason || 'Connection lost'}. You can try rejoining or stay for chat.`);
    }
  }, [onLeave]);

  // Audio rooms: no camera permission, speaker/listener roles, hand raise, mute/unmute, chat, recording
  const isAudioRoom = liveRoom?.room_type === 'audio' || liveRoom?.audio_only;
  const [connectOptions, setConnectOptions] = useState({ audio: true, video: !isAudioRoom });

  useEffect(() => {
    // Audio rooms: fully working without camera permission
    const checkMedia = async () => {
      if (isAudioRoom) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          setConnectOptions({ audio: true, video: false });
        } catch (err: any) {
          console.warn("Audio room media check:", err);
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setConnectOptions({ audio: false, video: false });
            setError("Microphone permission denied. You joined as listener with chat - you can still raise hand to speak!");
          } else {
            setConnectOptions({ audio: false, video: false });
          }
        }
        setIsConnecting(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(t => t.stop());
        setConnectOptions({ audio: true, video: true });
      } catch (err: any) {
        console.warn("Media permission check failed:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setConnectOptions({ audio: false, video: false });
          setError("Camera/microphone permission denied. You joined with chat only - you can still participate!");
        } else if (err.name === "NotFoundError") {
          setConnectOptions({ audio: true, video: false });
          setError("No camera found. Joined with microphone only.");
        } else {
          setConnectOptions({ audio: true, video: false });
        }
      }
      setIsConnecting(false);
    };
    checkMedia();
  }, [isAudioRoom]);

  if (isConnecting) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center bg-[#0c0414] p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent"></div>
          <p className="text-sm text-[#cabfe0]">Connecting to live room...</p>
          <p className="mt-2 text-xs text-[#8e82a8]">Checking camera & microphone permissions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {error && (
        <div className="absolute top-2 left-2 right-2 z-50 rounded-lg bg-amber-500/20 border border-amber-500/40 px-4 py-3 text-sm text-amber-100">
          <div className="flex items-start justify-between gap-3">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-amber-300 hover:text-white">✕</button>
          </div>
        </div>
      )}
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect={true}
        audio={connectOptions.audio}
        video={connectOptions.video}
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
        onError={handleError}
        options={{
          // Don't fail if media not available
          publishDefaults: {
            audioPreset: { maxBitrate: 64000 },
            videoEncoding: { maxBitrate: 1500000, maxFramerate: 30 },
          },
        }}
      >
        <RoomInner room={liveRoom} me={me} isHost={isHost} onLeave={onLeave} />
      </LiveKitRoom>
    </div>
  );
}
