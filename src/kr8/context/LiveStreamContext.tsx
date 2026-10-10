// Production LiveStreamContext - DB-first, safe, no crash on missing addNotification
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { liveKitManager, type StreamDataMessage } from "../lib/livekit";

type StreamRole = "host" | "co-host" | "panelist" | "moderator" | "attendee" | "viewer" | "speaker";

type LiveStreamParticipant = {
  id: string;
  name: string;
  avatar?: string;
  role: StreamRole;
  isMuted?: boolean;
  isVideoOn?: boolean;
  handRaised?: boolean;
  joinedAt: number;
};

type LiveChatMessage = {
  id: string;
  streamId: string;
  senderId: string;
  senderName: string;
  senderRole: StreamRole;
  text: string;
  createdAt: number;
};

type LiveStream = {
  id: string;
  title: string;
  category: string;
  description: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  visibility: "public" | "private";
  accessKey?: string;
  isLive: boolean;
  startedAt: number;
  viewerCount: number;
  peakViewers: number;
  viewers: LiveStreamParticipant[];
};

type StreamReplay = {
  id: string;
  title: string;
  hostName: string;
  category: string;
  date: string;
  durationMinutes: number;
  peakViewers: number;
  thumbnail: string;
  videoUrl: string;
  messagesCount: number;
};

interface LiveStreamContextType {
  activeStream: LiveStream | null;
  isLive: boolean;
  isStageOpen: boolean;
  canHost: boolean;
  currentRole: StreamRole;
  chatMessages: LiveChatMessage[];
  replays: StreamReplay[];
  lastEndedStream: StreamReplay | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraActive: boolean;
  micActive: boolean;
  isScreenSharing: boolean;
  openStage: (replay?: StreamReplay) => void;
  closeStage: () => void;
  startCameraStream: () => Promise<MediaStream | null>;
  startScreenShare: () => Promise<MediaStream | null>;
  stopMediaTracks: () => void;
  toggleCamera: () => boolean;
  toggleMic: () => boolean;
  startStream: (data: any) => Promise<LiveStream | null>;
  endStream: () => Promise<StreamReplay | null>;
  sendMessage: (text: string) => void;
  // Legacy compat
  isMiniPlayerOpen: boolean;
  openMiniPlayer: () => void;
  closeMiniPlayer: () => void;
  isPrivateAuthorized: boolean;
  audioOnly: boolean;
  toggleAudioOnly: () => void;
  spotlightId: string | null;
  setSpotlight: (id: string | null) => void;
  pinnedParticipantId: string | null;
  setPinParticipant: (id: string | null) => void;
  chatPermission: "everyone" | "presenters_only" | "disabled";
  updateChatPermission: (perm: any) => void;
  reactions: any[];
  sendReaction: (emoji: string) => void;
  raisedHands: string[];
  raiseHand: () => void;
  lowerHand: (id?: string) => void;
  questions: any[];
  submitQuestion: (text: string, isAnon: boolean) => void;
  upvoteQuestion: (id: string) => void;
  answerQuestion: (id: string, answer: string, visibility: any) => void;
  dismissQuestion: (id: string) => void;
  polls: any[];
  createPoll: (...args: any[]) => void;
  votePoll: (pollId: string, idx: number) => void;
  closePoll: (pollId: string) => void;
  requests: any[];
  requestAccess: (id: string) => void;
  respondRequest: (id: string, status: any) => void;
  invites: any[];
  createInvite: (...args: any[]) => any;
  recordings: any[];
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  isLocked: boolean;
  toggleLock: () => void;
  isSuspended: boolean;
  suspendActivities: () => void;
  breakouts: any[];
  updateBreakouts: (rooms: any[]) => void;
  activeReplay: StreamReplay | null;
  refreshReplays: () => void;
  closeReplay: () => void;
  promoteRole: (id: string, role: StreamRole) => void;
  muteListener: (id: string, force?: boolean) => void;
  muteAll: () => void;
  removeParticipant: (id: string) => void;
  unlockPrivateStream: (key: string) => boolean;
  pinMessage: (id: string) => void;
  deleteMessage: (id: string) => void;
}

const LiveStreamContext = createContext<LiveStreamContextType | null>(null);

export function LiveStreamProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const student = auth?.student || auth?.user || null;
  const addNotification = auth?.addNotification || ((text: string) => console.log('[Notify]', text));

  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [isStageOpen, setIsStageOpen] = useState(false);
  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [replays, setReplays] = useState<StreamReplay[]>([]);
  const [lastEndedStream, setLastEndedStream] = useState<StreamReplay | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPrivateAuthorized, setIsPrivateAuthorized] = useState(true);
  const [audioOnly, setAudioOnly] = useState(false);

  const canHost = (() => {
    if (!student) return false;
    return !!(student as any).isFounder || !!(student as any).isCoFounder || !!(student as any).isAdmin || (student as any).type === 'founder' || (student as any).type === 'co-founder';
  })();

  const currentRole: StreamRole = (() => {
    if (!activeStream) return "viewer";
    if (student?.id === activeStream.hostId) return "host";
    const found = (activeStream.viewers || []).find(v => v.id === student?.id);
    if (found) return found.role;
    return "attendee";
  })();

  const syncFromDB = useCallback(async () => {
    try {
      // Fetch live rooms from DB
      const { data: liveRooms, error } = await supabase.from('live_rooms').select('*').eq('is_live', true).order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (error) {
        console.warn('Live rooms fetch error:', error.message);
        return;
      }
      if (liveRooms) {
        const mapped: LiveStream = {
          id: liveRooms.id,
          title: liveRooms.title || "Live Session",
          category: liveRooms.category || "General",
          description: liveRooms.description || "",
          hostId: liveRooms.host_id || "",
          hostName: liveRooms.host_name || "KR8 Team",
          hostAvatar: liveRooms.host_avatar || undefined,
          visibility: liveRooms.visibility || "public",
          accessKey: liveRooms.access_key || undefined,
          isLive: !!liveRooms.is_live,
          startedAt: new Date(liveRooms.started_at || Date.now()).getTime(),
          viewerCount: liveRooms.viewer_count || 1,
          peakViewers: liveRooms.peak_viewers || 1,
          viewers: [],
        };
        setActiveStream(mapped);

        // Fetch chat messages
        const { data: msgs } = await supabase.from('room_messages').select('*').eq('room_id', liveRooms.id).order('created_at', { ascending: true }).limit(100);
        if (msgs) {
          setChatMessages(msgs.map((m: any) => ({
            id: m.id,
            streamId: m.room_id,
            senderId: m.sender_id,
            senderName: m.sender_name,
            senderRole: m.sender_role || "viewer",
            text: m.text,
            createdAt: new Date(m.created_at).getTime(),
          })));
        }
      } else {
        setActiveStream(null);
      }

      // Replays
      const { data: replayData } = await supabase.from('recordings').select('*').order('created_at', { ascending: false }).limit(10);
      if (replayData) {
        setReplays(replayData.map((r: any) => ({
          id: r.id,
          title: r.title || "Replay",
          hostName: r.host_name || "KR8 Team",
          category: r.category || "General",
          date: new Date(r.created_at).toLocaleDateString(),
          durationMinutes: r.duration_minutes || 0,
          peakViewers: r.peak_viewers || 0,
          thumbnail: r.thumbnail || "/founder_timfire_wide.jpg",
          videoUrl: r.video_url || "",
          messagesCount: r.messages_count || 0,
        })));
        if (replayData.length > 0) {
          const last = replayData[0];
          setLastEndedStream({
            id: last.id,
            title: last.title,
            hostName: last.host_name,
            category: last.category,
            date: new Date(last.created_at).toLocaleDateString(),
            durationMinutes: last.duration_minutes || 0,
            peakViewers: last.peak_viewers || 0,
            thumbnail: last.thumbnail || "/founder_timfire_wide.jpg",
            videoUrl: last.video_url || "",
            messagesCount: last.messages_count || 0,
          });
        }
      }
    } catch (e) {
      console.warn('LiveStream sync error:', e);
    }
  }, []);

  useEffect(() => {
    syncFromDB();
    const channel = supabase.channel('live-rooms-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_rooms' }, syncFromDB)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages' }, syncFromDB)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings' }, syncFromDB)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncFromDB]);

  // LiveKit connection
  useEffect(() => {
    if (!isStageOpen || !activeStream) return;

    const participantName = student?.name || "Guest Creator";
    const isHost = !!(student?.id === activeStream.hostId || (student as any)?.isFounder);

    void liveKitManager.connect({
      roomName: activeStream.id,
      participantName,
      isHost,
      audioOnly,
      onDataReceived: (msg: StreamDataMessage) => {
        if (msg.type === 'chat') {
          setChatMessages(prev => [...prev, msg.payload as any]);
        }
      },
      onRemoteStream: (stream: MediaStream) => {
        setRemoteStream(stream);
      },
    });

    return () => {
      liveKitManager.disconnect();
      setRemoteStream(null);
    };
  }, [isStageOpen, activeStream?.id, audioOnly, student?.id, student?.name]);

  const startCameraStream = async (): Promise<MediaStream | null> => {
    if (audioOnly) return null;
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        setLocalStream(stream);
        setCameraActive(true);
        setMicActive(true);
        void liveKitManager.publishStream(stream);
        return stream;
      }
    } catch (e) {
      console.warn('Camera error:', e);
      addNotification("Camera/mic permission denied, but you remain in chat.");
    }
    return null;
  };

  const startScreenShare = async (): Promise<MediaStream | null> => {
    try {
      const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      setLocalStream(screenStream);
      setIsScreenSharing(true);
      setCameraActive(true);
      void liveKitManager.publishStream(screenStream);
      return screenStream;
    } catch {
      return null;
    }
  };

  const stopMediaTracks = () => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
    setCameraActive(false);
    setMicActive(false);
    setIsScreenSharing(false);
  };

  const toggleCamera = (): boolean => {
    if (!localStream) {
      void startCameraStream();
      return true;
    }
    const track = localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCameraActive(track.enabled);
      return track.enabled;
    }
    return false;
  };

  const toggleMic = (): boolean => {
    if (!localStream) return false;
    const track = localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicActive(track.enabled);
      return track.enabled;
    }
    return false;
  };

  const startStream = async (data: any): Promise<LiveStream | null> => {
    if (!canHost) {
      addNotification("Your account is not authorized to host a live broadcast.");
      return null;
    }
    try {
      const { data: newRoom, error } = await supabase.from('live_rooms').insert({
        title: data.title,
        category: data.category,
        description: data.description || "",
        host_id: student?.id,
        host_name: student?.name || "KR8 Team",
        host_avatar: student?.avatar || null,
        visibility: data.visibility || "public",
        access_key: data.accessKey || null,
        is_live: true,
        viewer_count: 1,
        peak_viewers: 1,
        started_at: new Date().toISOString(),
      }).select().single();

      if (error) throw error;

      await syncFromDB();
      setIsStageOpen(true);
      addNotification(`Broadcast launched! "${data.title}" is now LIVE.`);
      
      if (data.quality !== "audio-only" && !audioOnly) {
        await startCameraStream();
      }

      return activeStream;
    } catch (e: any) {
      console.error('Start stream error:', e);
      addNotification(`Failed to start stream: ${e.message}`);
      return null;
    }
  };

  const endStream = async (): Promise<StreamReplay | null> => {
    if (!activeStream) return null;
    if (currentRole !== "host" && !(student as any)?.isFounder) {
      addNotification("Only the primary host can end the live stream.");
      return null;
    }
    try {
      const { error } = await supabase.from('live_rooms').update({ is_live: false, ended_at: new Date().toISOString() }).eq('id', activeStream.id);
      if (error) throw error;

      // Create recording entry
      await supabase.from('recordings').insert({
        room_id: activeStream.id,
        title: activeStream.title,
        host_name: activeStream.hostName,
        category: activeStream.category,
        duration_minutes: Math.max(1, Math.round((Date.now() - activeStream.startedAt) / 60000)),
        thumbnail: "/founder_timfire_wide.jpg",
        video_url: "",
        is_public: true,
      });

      stopMediaTracks();
      setActiveStream(null);
      setIsStageOpen(false);
      await syncFromDB();
      addNotification("Broadcast ended. Saved to recordings.");
      return lastEndedStream;
    } catch (e: any) {
      console.error('End stream error:', e);
      addNotification(`Failed to end stream: ${e.message}`);
      return null;
    }
  };

  const sendMessage = async (text: string) => {
    if (!activeStream) return;
    if (!text.trim()) return;
    try {
      const { error } = await supabase.from('room_messages').insert({
        room_id: activeStream.id,
        sender_id: student?.id || `guest-${Date.now()}`,
        sender_name: student?.name || "Guest",
        sender_role: currentRole,
        text: text.trim(),
      });
      if (error) throw error;
      
      // Also publish via LiveKit data channel for realtime
      const msg: LiveChatMessage = {
        id: `msg-${Date.now()}`,
        streamId: activeStream.id,
        senderId: student?.id || "guest",
        senderName: student?.name || "Guest",
        senderRole: currentRole,
        text: text.trim(),
        createdAt: Date.now(),
      };
      void liveKitManager.publishData({ type: "chat", payload: msg } as any);
    } catch (e: any) {
      console.error('Send message error:', e);
      // Fallback to local only
      setChatMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        streamId: activeStream!.id,
        senderId: student?.id || "guest",
        senderName: student?.name || "Guest",
        senderRole: currentRole,
        text: text.trim(),
        createdAt: Date.now(),
      }]);
    }
  };

  return (
    <LiveStreamContext.Provider
      value={{
        activeStream,
        isLive: !!activeStream?.isLive,
        isStageOpen,
        canHost,
        currentRole,
        chatMessages,
        replays,
        lastEndedStream,
        localStream,
        remoteStream,
        cameraActive,
        micActive,
        isScreenSharing,
        openStage: (replay?: StreamReplay) => {
          setIsStageOpen(true);
          if (replay) setLastEndedStream(replay);
        },
        closeStage: () => setIsStageOpen(false),
        startCameraStream,
        startScreenShare,
        stopMediaTracks,
        toggleCamera,
        toggleMic,
        startStream,
        endStream,
        sendMessage,
        // Legacy stubs
        isMiniPlayerOpen,
        openMiniPlayer: () => setIsMiniPlayerOpen(true),
        closeMiniPlayer: () => setIsMiniPlayerOpen(false),
        isPrivateAuthorized,
        audioOnly,
        toggleAudioOnly: () => setAudioOnly(!audioOnly),
        spotlightId: null,
        setSpotlight: () => {},
        pinnedParticipantId: null,
        setPinParticipant: () => {},
        chatPermission: "everyone",
        updateChatPermission: () => {},
        reactions: [],
        sendReaction: () => {},
        raisedHands: [],
        raiseHand: () => {},
        lowerHand: () => {},
        questions: [],
        submitQuestion: () => {},
        upvoteQuestion: () => {},
        answerQuestion: () => {},
        dismissQuestion: () => {},
        polls: [],
        createPoll: () => {},
        votePoll: () => {},
        closePoll: () => {},
        requests: [],
        requestAccess: () => {},
        respondRequest: () => {},
        invites: [],
        createInvite: () => null,
        recordings: [],
        isRecording: false,
        startRecording: () => {},
        stopRecording: () => {},
        isLocked: false,
        toggleLock: () => {},
        isSuspended: false,
        suspendActivities: () => {},
        breakouts: [],
        updateBreakouts: () => {},
        activeReplay: null,
        refreshReplays: () => syncFromDB(),
        closeReplay: () => {},
        promoteRole: () => {},
        muteListener: () => {},
        muteAll: () => {},
        removeParticipant: () => {},
        unlockPrivateStream: () => true,
        pinMessage: () => {},
        deleteMessage: () => {},
      }}
    >
      {children}
    </LiveStreamContext.Provider>
  );
}

export function useLiveStream() {
  const ctx = useContext(LiveStreamContext);
  if (!ctx) throw new Error("useLiveStream must be used within a LiveStreamProvider");
  return ctx;
}
