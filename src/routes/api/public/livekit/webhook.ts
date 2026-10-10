import { createFileRoute } from "@tanstack/react-router";

// LiveKit webhook: keeps room status in sync (e.g. when everyone leaves)
// Now runs directly on Vercel with service role key - no longer forwards to Lovable

export const Route = createFileRoute("/api/public/livekit/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const auth = request.headers.get("Authorization") ?? request.headers.get("x-livekit-authorization") ?? "";

        // Always handle directly with service role - no forwarding to Lovable
        try {
          const { handleLiveKitWebhook } = await import("@/lib/live-admin.server");
          return handleLiveKitWebhook(body, auth);
        } catch (err: any) {
          console.error('LiveKit webhook error:', err);
          return new Response(err.message || "Webhook handling failed", { status: 500 });
        }
      },
    },
  },
});
