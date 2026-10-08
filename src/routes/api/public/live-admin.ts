import { createFileRoute } from "@tanstack/react-router";

// Privileged live-room operations for hosts without the service role key.
// POST {action, ...data} -> {result} | {error} (400).
// POST ?webhook=livekit with the raw LiveKit body + x-livekit-authorization header -> forwarded webhook.
export const Route = createFileRoute("/api/public/live-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("webhook") === "livekit") {
          const { handleLiveKitWebhook } = await import("@/lib/live-admin.server");
          return handleLiveKitWebhook(await request.text(), request.headers.get("x-livekit-authorization") ?? "");
        }
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { action, ...data } = payload ?? {};
        const { liveAdminActions } = await import("@/lib/live-admin.server");
        const fn = typeof action === "string" && Object.hasOwn(liveAdminActions, action)
          ? (liveAdminActions as Record<string, (d: unknown) => Promise<unknown>>)[action]
          : null;
        if (!fn) return Response.json({ error: "Unknown action" }, { status: 400 });
        try {
          return Response.json({ result: await fn(data) });
        } catch (e) {
          const { ZodError } = await import("zod");
          if (e instanceof ZodError) return Response.json({ error: "Invalid input" }, { status: 400 });
          console.error("live-admin", action, e);
          return Response.json({ error: (e as Error)?.message || "Request failed" }, { status: 400 });
        }
      },
    },
  },
});
