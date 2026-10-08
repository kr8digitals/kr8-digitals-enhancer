import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Live rooms (LiveKit). Hosts are founder / co-founder accounts in the database.
// NOTE: site sign-in is still in-browser, so the caller's account id is trusted as sent.
// With SUPABASE_SERVICE_ROLE_KEY: runs src/lib/live-admin.server.ts directly.
// Without it (e.g. Vercel): forwards to LIVE_ADMIN_URL (/api/public/live-admin on Lovable).

async function run<T>(action: string, data: unknown): Promise<T> {
  if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    const { liveAdminActions } = await import("./live-admin.server");
    return (await (liveAdminActions as Record<string, (d: unknown) => Promise<unknown>>)[action](data)) as T;
  }
  const url = process.env["LIVE_ADMIN_URL"];
  if (!url) throw new Error("Live service is not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(data as object), action }),
  });
  let body: { result?: T; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || body.error !== undefined) throw new Error(body.error || `Live service error (${res.status})`);
  return body.result as T;
}

type RoomRow = import("@/integrations/supabase/types").Database["public"]["Tables"]["live_rooms"]["Row"];
type TokenResult =
  | { status: "ended" }
  | { status: "needs_key" }
  | { status: "waiting" }
  | { status: "denied" }
  | { status: "ok"; token: string; url: string; isHost: boolean; room: RoomRow };
type Ok = { ok: boolean };

const hostAction = z.object({ userId: z.string().min(1).max(200), roomId: z.string().min(1).max(100) });

export const checkHost = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ userId: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => run<{ isHost: boolean }>("checkHost", data));

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
  .handler(async ({ data }) => run<{ id: string; accessKey: string | null }>("createRoom", data));

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
  .handler(async ({ data }) => run<TokenResult>("getRoomToken", data));

export const setAdmission = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    hostAction.extend({ targetId: z.string().max(200), status: z.enum(["admitted", "denied"]) }).parse(d),
  )
  .handler(async ({ data }) => run<Ok>("setAdmission", data));

export const moderateParticipant = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    hostAction
      .extend({ targetId: z.string().max(200), action: z.enum(["mute", "remove", "make_speaker", "make_viewer"]) })
      .parse(d),
  )
  .handler(async ({ data }) => run<Ok>("moderateParticipant", data));

export const endRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => hostAction.parse(d))
  .handler(async ({ data }) => run<Ok>("endRoom", data));

export const setRecording = createServerFn({ method: "POST" })
  .inputValidator((d) => hostAction.extend({ on: z.boolean() }).parse(d))
  .handler(async ({ data }) => run<Ok>("setRecording", data));

export const saveRecording = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    hostAction.extend({ filePath: z.string().max(500), durationSeconds: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data }) => run<Ok>("saveRecording", data));

export const listRoomParticipants = createServerFn({ method: "POST" })
  .inputValidator((d) => hostAction.parse(d))
  .handler(async ({ data }) =>
    run<{ identity: string; name: string; joinedAt: number }[]>("listRoomParticipants", data),
  );

export const hideRecording = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ userId: z.string().max(200), recordingId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => run<Ok>("hideRecording", data));

export const moderateMessage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ userId: z.string().max(200), messageId: z.string().uuid(), action: z.enum(["delete", "pin", "unpin"]) }).parse(d),
  )
  .handler(async ({ data }) => run<Ok>("moderateMessage", data));
