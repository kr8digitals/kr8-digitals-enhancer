import { createFileRoute } from "@tanstack/react-router";

// LiveKit webhook: keeps room status in sync (e.g. when everyone leaves).
export const Route = createFileRoute("/api/public/livekit/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LIVEKIT_API_KEY"];
        const secret = process.env["LIVEKIT_API_SECRET"];
        if (!key || !secret) return new Response("Not configured", { status: 500 });
        const body = await request.text();
        const { WebhookReceiver } = await import("livekit-server-sdk");
        let event;
        try {
          event = await new WebhookReceiver(key, secret).receive(body, request.headers.get("Authorization") ?? "");
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }
        const roomId = event.room?.name;
        if (roomId && event.event === "room_finished") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("live_rooms")
            .update({ is_live: false, ended_at: new Date().toISOString(), is_recording: false })
            .eq("id", roomId);
        }
        return new Response("ok");
      },
    },
  },
});
