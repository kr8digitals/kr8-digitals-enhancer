import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Live rooms (LiveKit). Hosts are founder / co-founder accounts in the database.
// NOTE: site sign-in is still in-browser, so the caller's account id is trusted as sent.

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function isHost(userId: string) {
  if (!userId) return false;
  const db = await admin();
  const { data } = await db.from("accounts").select("type").eq("id", userId).maybeSingle();
  return !!data && (data.type === "founder" || data.type === "co-founder");
}

function lkEnv() {
  const url = process.env["LIVEKIT_URL"];
  const key = process.env["LIVEKIT_API_KEY"];
  const secret = process.env["LIVEKIT_API_SECRET"];
  if (!url || !key || !secret) throw new Error("Video service is not configured");
  return { url, key, secret, httpUrl: url.replace(/^wss:/, "https:").replace(/^ws:/, "http:") };
}

async function roomService() {
  const { RoomServiceClient } = await import("livekit-server-sdk");
  const e = lkEnv();
  return new RoomServiceClient(e.httpUrl, e.key, e.secret);
}

export const checkHost = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ userId: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => ({ isHost: await isHost(data.userId) }));

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().min(1).max(200),
        userName: z.string().max(120),
        title: z.string().min(1).max(140),
        description: z.string().max(1000).optional(),
        mode: z.enum(["meeting", "broadcast"]),
        visibility: z.enum(["public", "private"]),
        waitingRoom: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!(await isHost(data.userId))) throw new Error("Only hosts can start a live session");
    const db = await admin();
    const id = "kr8-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
    const access_key =
      data.visibility === "private" ? "KR8-" + Math.random().toString(36).slice(2, 8).toUpperCase() : null;
    const { error } = await db.from("live_rooms").insert({
      id,
      title: data.title,
      description: data.description ?? null,
      mode: data.mode,
      host_id: data.userId,
      host_name: data.userName,
      visibility: data.visibility,
      access_key,
      waiting_room: data.waitingRoom,
      is_live: true,
    });
    if (error) throw new Error(error.message);
    await db.from("activity_log").insert({
      actor_id: data.userId,
      actor_name: data.userName,
      action: "live_started",
      target: data.title,
      details: { room: id, mode: data.mode },
    });
    return { id, accessKey: access_key };
  });

export const getRoomToken = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        roomId: z.string().min(1).max(100),
        userId: z.string().min(1).max(200),
        userName: z.string().min(1).max(120),
        accessKey: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: room } = await db.from("live_rooms").select("*").eq("id", data.roomId).maybeSingle();
    if (!room || !room.is_live) return { status: "ended" as const };
    const host = room.host_id === data.userId || (await isHost(data.userId));

    if (!host) {
      if (room.visibility === "private" && (data.accessKey || "").trim().toUpperCase() !== room.access_key) {
        return { status: "needs_key" as const };
      }
      if (room.waiting_room) {
        const { data: adm } = await db
          .from("room_admissions")
          .select("status")
          .eq("room_id", room.id)
          .eq("user_id", data.userId)
          .maybeSingle();
        if (!adm) {
          await db.from("room_admissions").insert({ room_id: room.id, user_id: data.userId, user_name: data.userName });
          return { status: "waiting" as const };
        }
        if (adm.status === "denied") return { status: "denied" as const };
        if (adm.status !== "admitted") return { status: "waiting" as const };
      }
    }

    const { AccessToken } = await import("livekit-server-sdk");
    const e = lkEnv();
    const canPublish = host || room.mode === "meeting";
    const at = new AccessToken(e.key, e.secret, {
      identity: data.userId,
      name: data.userName,
      ttl: "6h",
      metadata: JSON.stringify({ role: host ? "host" : room.mode === "broadcast" ? "viewer" : "participant" }),
    });
    at.addGrant({
      room: room.id,
      roomJoin: true,
      roomAdmin: host,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });
    await db.from("activity_log").insert({
      actor_id: data.userId,
      actor_name: data.userName,
      action: "live_joined",
      target: room.title,
      details: { room: room.id },
    });
    return { status: "ok" as const, token: await at.toJwt(), url: e.url, isHost: host, room };
  });

const hostAction = z.object({ userId: z.string().min(1).max(200), roomId: z.string().min(1).max(100) });

async function assertRoomHost(userId: string, roomId: string) {
  const db = await admin();
  const { data: room } = await db.from("live_rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) throw new Error("Room not found");
  if (room.host_id !== userId && !(await isHost(userId))) throw new Error("Not allowed");
  return { db, room };
}

export const setAdmission = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    hostAction.extend({ targetId: z.string().max(200), status: z.enum(["admitted", "denied"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { db } = await assertRoomHost(data.userId, data.roomId);
    await db.from("room_admissions").update({ status: data.status }).eq("room_id", data.roomId).eq("user_id", data.targetId);
    return { ok: true };
  });

export const moderateParticipant = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    hostAction
      .extend({ targetId: z.string().max(200), action: z.enum(["mute", "remove", "make_speaker", "make_viewer"]) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await assertRoomHost(data.userId, data.roomId);
    const rs = await roomService();
    if (data.action === "remove") {
      await rs.removeParticipant(data.roomId, data.targetId);
    } else if (data.action === "mute") {
      const p = await rs.getParticipant(data.roomId, data.targetId);
      for (const t of p.tracks) {
        if (!t.muted) await rs.mutePublishedTrack(data.roomId, data.targetId, t.sid, true);
      }
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
  .inputValidator((d) => hostAction.parse(d))
  .handler(async ({ data }) => {
    const { db, room } = await assertRoomHost(data.userId, data.roomId);
    try {
      const rs = await roomService();
      await rs.deleteRoom(data.roomId);
    } catch (e) {
      console.error("deleteRoom", e);
    }
    await db.from("live_rooms").update({ is_live: false, ended_at: new Date().toISOString(), is_recording: false }).eq("id", data.roomId);
    await db.from("activity_log").insert({ actor_id: data.userId, action: "live_ended", target: room.title, details: { room: room.id } });
    return { ok: true };
  });

export const setRecording = createServerFn({ method: "POST" })
  .inputValidator((d) => hostAction.extend({ on: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { db } = await assertRoomHost(data.userId, data.roomId);
    await db.from("live_rooms").update({ is_recording: data.on }).eq("id", data.roomId);
    return { ok: true };
  });

export const saveRecording = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    hostAction.extend({ filePath: z.string().max(500), durationSeconds: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { db, room } = await assertRoomHost(data.userId, data.roomId);
    await db.from("recordings").insert({
      room_id: room.id,
      title: room.title,
      host_name: room.host_name,
      file_path: data.filePath,
      duration_seconds: data.durationSeconds,
    });
    return { ok: true };
  });

export const listRoomParticipants = createServerFn({ method: "POST" })
  .inputValidator((d) => hostAction.parse(d))
  .handler(async ({ data }) => {
    await assertRoomHost(data.userId, data.roomId);
    try {
      const rs = await roomService();
      const ps = await rs.listParticipants(data.roomId);
      return ps.map((p) => ({ identity: p.identity, name: p.name, joinedAt: Number(p.joinedAt) }));
    } catch {
      return [];
    }
  });

export const hideRecording = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ userId: z.string().max(200), recordingId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    if (!(await isHost(data.userId))) throw new Error("Not allowed");
    const db = await admin();
    await db.from("recordings").update({ is_hidden: true }).eq("id", data.recordingId);
    return { ok: true };
  });

export const moderateMessage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ userId: z.string().max(200), messageId: z.string().uuid(), action: z.enum(["delete", "pin", "unpin"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!(await isHost(data.userId))) throw new Error("Not allowed");
    const db = await admin();
    const patch = data.action === "delete" ? { is_deleted: true } : { is_pinned: data.action === "pin" };
    await db.from("room_messages").update(patch).eq("id", data.messageId);
    return { ok: true };
  });
