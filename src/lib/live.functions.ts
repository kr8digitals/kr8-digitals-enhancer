import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Secure Live rooms with Supabase Auth - no longer trusts client-supplied userId
// All operations check authenticated user and roles table
// Service role key is required (new Supabase project yuvslnjoutjohxgsxprb)

type RoomRow = import("@/integrations/supabase/types").Database["public"]["Tables"]["live_rooms"]["Row"];
type TokenResult =
  | { status: "ended" }
  | { status: "needs_key" }
  | { status: "waiting" }
  | { status: "denied" }
  | { status: "ok"; token: string; url: string; isHost: boolean; room: RoomRow };
type Ok = { ok: boolean };

export const checkHost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({}).parse(d))
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const { supabaseAdmin, isUserHost } = await import("@/integrations/supabase/client.server");
    const isHost = await isUserHost(userId);
    return { isHost };
  });

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userName: z.string().max(120).optional(),
        title: z.string().min(1).max(140),
        description: z.string().max(1000).optional(),
        mode: z.enum(["meeting", "broadcast"]),
        visibility: z.enum(["public", "private"]),
        waitingRoom: z.boolean(),
        roomType: z.enum(["video","audio"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { supabaseAdmin, isUserHost } = await import("@/integrations/supabase/client.server");

    if (!(await isUserHost(userId))) {
      throw new Error("Only hosts (founders, co-founders, admins, coaches) can start a live session");
    }

    // Get user profile for host name
    let hostName = data.userName || "Host";
    try {
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
      if (profile?.name) hostName = profile.name;
    } catch {}

    const id = "kr8-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
    const access_key =
      data.visibility === "private" ? "KR8-" + Math.random().toString(36).slice(2, 8).toUpperCase() : null;

    const roomType = (data as any).roomType || 'video';
    const { error } = await supabaseAdmin.from("live_rooms").insert({
      id,
      title: data.title,
      description: data.description ?? null,
      mode: data.mode,
      host_id: userId,
      host_name: hostName,
      visibility: data.visibility,
      access_key,
      waiting_room: data.waitingRoom,
      is_live: true,
      room_type: roomType,
      audio_only: roomType === 'audio',
    } as any);

    if (error) throw new Error(error.message);

    try {
      await supabaseAdmin.from("activity_log").insert({
        actor_id: userId,
        actor_name: hostName,
        action: "live_started",
        target: data.title,
        details: { room: id, mode: data.mode, room_type: roomType },
      });
    } catch {}

    return { id, accessKey: access_key };
  });

export const getRoomToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        roomId: z.string().min(1).max(100),
        userName: z.string().min(1).max(120).optional(),
        accessKey: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { supabaseAdmin, isUserHost } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin.from("live_rooms").select("*").eq("id", data.roomId).maybeSingle();
    if (!room || !room.is_live) return { status: "ended" as const };

    const isHostUser = room.host_id === userId || (await isUserHost(userId));

    let userName = data.userName || "Guest";
    try {
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
      if (profile?.name) userName = profile.name;
    } catch {}

    if (!isHostUser) {
      if (room.visibility === "private" && (data.accessKey || "").trim().toUpperCase() !== (room.access_key || "").toUpperCase()) {
        return { status: "needs_key" as const };
      }
      if (room.waiting_room) {
        const { data: adm } = await supabaseAdmin
          .from("room_admissions")
          .select("status")
          .eq("room_id", room.id)
          .eq("user_id", userId)
          .maybeSingle();
        if (!adm) {
          await supabaseAdmin.from("room_admissions").insert({ room_id: room.id, user_id: userId, user_name: userName });
          return { status: "waiting" as const };
        }
        if (adm.status === "denied") return { status: "denied" as const };
        if (adm.status !== "admitted") return { status: "waiting" as const };
      }
    }

    // Mint LiveKit token with matching URL/key/secret
    const LIVEKIT_URL = process.env["LIVEKIT_URL"] || process.env["VITE_LIVEKIT_URL"];
    const LIVEKIT_API_KEY = process.env["LIVEKIT_API_KEY"] || process.env["VITE_LIVEKIT_API_KEY"];
    const LIVEKIT_API_SECRET = process.env["LIVEKIT_API_SECRET"] || process.env["VITE_LIVEKIT_API_SECRET"];

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      throw new Error("LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in Vercel env vars.");
    }

    const { AccessToken } = await import("livekit-server-sdk");
    const canPublish = isHostUser || room.mode === "meeting";

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      name: userName,
      ttl: "6h",
      metadata: JSON.stringify({ role: isHostUser ? "host" : room.mode === "broadcast" ? "viewer" : "participant" }),
    });

    at.addGrant({
      room: room.id,
      roomJoin: true,
      roomAdmin: isHostUser,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });

    try {
      await supabaseAdmin.from("activity_log").insert({
        actor_id: userId,
        actor_name: userName,
        action: "live_joined",
        target: room.title,
        details: { room: room.id },
      });
    } catch {}

    return { status: "ok" as const, token: await at.toJwt(), url: LIVEKIT_URL, isHost: isHostUser, room };
  });

export const setAdmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      roomId: z.string().min(1).max(100),
      targetId: z.string().min(1).max(200),
      status: z.enum(["admitted", "denied"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin.from("live_rooms").select("*").eq("id", data.roomId).maybeSingle();
    if (!room) throw new Error("Room not found");

    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId);
    const isHost = room.host_id === userId || roles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (!isHost) throw new Error("Not allowed");

    await supabaseAdmin.from("room_admissions").update({ status: data.status }).eq("room_id", data.roomId).eq("user_id", data.targetId);
    return { ok: true };
  });

export const moderateParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      roomId: z.string().min(1).max(100),
      targetId: z.string().max(200),
      action: z.enum(["mute", "remove", "make_speaker", "make_viewer"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin.from("live_rooms").select("*").eq("id", data.roomId).maybeSingle();
    if (!room) throw new Error("Room not found");

    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId);
    const isHost = room.host_id === userId || roles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (!isHost) throw new Error("Not allowed");

    const LIVEKIT_URL = process.env["LIVEKIT_URL"];
    const LIVEKIT_API_KEY = process.env["LIVEKIT_API_KEY"];
    const LIVEKIT_API_SECRET = process.env["LIVEKIT_API_SECRET"];

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) throw new Error("LiveKit not configured");

    const { RoomServiceClient } = await import("livekit-server-sdk");
    const httpUrl = LIVEKIT_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    const rs = new RoomServiceClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    if (data.action === "remove") {
      await rs.removeParticipant(data.roomId, data.targetId);
    } else if (data.action === "mute") {
      try {
        const p = await rs.getParticipant(data.roomId, data.targetId);
        for (const t of p.tracks) {
          if (!t.muted) await rs.mutePublishedTrack(data.roomId, data.targetId, t.sid, true);
        }
      } catch {}
    } else {
      const speaker = data.action === "make_speaker";
      await rs.updateParticipant(data.roomId, data.targetId, {
        metadata: JSON.stringify({ role: speaker ? "speaker" : "viewer" }),
        permission: { canPublish: speaker, canSubscribe: true, canPublishData: true },
      });
    }
    return { ok: true };
  });

export const endRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin.from("live_rooms").select("*").eq("id", data.roomId).maybeSingle();
    if (!room) throw new Error("Room not found");

    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId);
    const isHost = room.host_id === userId || roles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (!isHost) throw new Error("Not allowed");

    try {
      const LIVEKIT_URL = process.env["LIVEKIT_URL"];
      const LIVEKIT_API_KEY = process.env["LIVEKIT_API_KEY"];
      const LIVEKIT_API_SECRET = process.env["LIVEKIT_API_SECRET"];
      if (LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
        const { RoomServiceClient } = await import("livekit-server-sdk");
        const httpUrl = LIVEKIT_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
        const rs = new RoomServiceClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
        await rs.deleteRoom(data.roomId);
      }
    } catch (e) {
      console.error("deleteRoom", e);
    }

    await supabaseAdmin.from("live_rooms").update({ is_live: false, ended_at: new Date().toISOString(), is_recording: false }).eq("id", data.roomId);

    try {
      await supabaseAdmin.from("activity_log").insert({ actor_id: userId, action: "live_ended", target: room.title, details: { room: room.id } });
    } catch {}

    return { ok: true };
  });

export const setRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().min(1).max(100), on: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin.from("live_rooms").select("*").eq("id", data.roomId).maybeSingle();
    if (!room) throw new Error("Room not found");

    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId);
    const isHost = room.host_id === userId || roles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (!isHost) throw new Error("Not allowed");

    await supabaseAdmin.from("live_rooms").update({ is_recording: data.on }).eq("id", data.roomId);
    return { ok: true };
  });

export const saveRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ roomId: z.string().min(1).max(100), filePath: z.string().max(500), durationSeconds: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin.from("live_rooms").select("*").eq("id", data.roomId).maybeSingle();
    if (!room) throw new Error("Room not found");

    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId);
    const isHost = room.host_id === userId || roles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (!isHost) throw new Error("Not allowed");

    await supabaseAdmin.from("recordings").insert({
      room_id: room.id,
      title: room.title,
      host_name: room.host_name,
      file_path: data.filePath,
      duration_seconds: data.durationSeconds,
    });
    return { ok: true };
  });

export const listRoomParticipants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin.from("live_rooms").select("*").eq("id", data.roomId).maybeSingle();
    if (!room) throw new Error("Room not found");

    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId);
    const isHost = room.host_id === userId || roles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (!isHost) throw new Error("Not allowed");

    try {
      const LIVEKIT_URL = process.env["LIVEKIT_URL"];
      const LIVEKIT_API_KEY = process.env["LIVEKIT_API_KEY"];
      const LIVEKIT_API_SECRET = process.env["LIVEKIT_API_SECRET"];
      if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return [];
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const httpUrl = LIVEKIT_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
      const rs = new RoomServiceClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      const ps = await rs.listParticipants(data.roomId);
      return ps.map((p) => ({ identity: p.identity, name: p.name, joinedAt: Number(p.joinedAt) }));
    } catch {
      return [];
    }
  });

export const hideRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ recordingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin, isUserHost } = await import("@/integrations/supabase/client.server");
    if (!(await isUserHost(userId))) throw new Error("Not allowed");
    await supabaseAdmin.from("recordings").update({ is_hidden: true }).eq("id", data.recordingId);
    return { ok: true };
  });

export const moderateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ messageId: z.string().uuid(), action: z.enum(["delete", "pin", "unpin"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin, isUserHost } = await import("@/integrations/supabase/client.server");
    if (!(await isUserHost(userId))) throw new Error("Not allowed");
    const patch = data.action === "delete" ? { is_deleted: true } : { is_pinned: data.action === "pin" };
    await supabaseAdmin.from("room_messages").update(patch).eq("id", data.messageId);
    return { ok: true };
  });
