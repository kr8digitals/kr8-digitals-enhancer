import { createFileRoute } from "@tanstack/react-router";

// LiveKit webhook: keeps room status in sync (e.g. when everyone leaves).
// Without the service role key, forwards raw body + signature to LIVE_ADMIN_URL.
export const Route = createFileRoute("/api/public/livekit/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const auth = request.headers.get("Authorization") ?? "";
        if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          const { handleLiveKitWebhook } = await import("@/lib/live-admin.server");
          return handleLiveKitWebhook(body, auth);
        }
        const target = process.env["LIVE_ADMIN_URL"];
        if (!target) return new Response("Not configured", { status: 500 });
        const u = new URL(target);
        u.searchParams.set("webhook", "livekit");
        const res = await fetch(u, {
          method: "POST",
          headers: { "Content-Type": request.headers.get("Content-Type") ?? "application/webhook+json", "x-livekit-authorization": auth },
          body,
        });
        return new Response(await res.text(), { status: res.status });
      },
    },
  },
});
