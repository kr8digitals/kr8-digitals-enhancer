import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const applyPointsSchema = z.object({
  userId: z.string().min(1),
  kr8Id: z.string().min(1),
  pointsChange: z.number().int().min(-1000).max(1000).refine(v => v !== 0, "Points change cannot be 0"),
  reason: z.string().min(5).max(500),
});

export const applyPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => applyPointsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc('apply_points', {
      p_user_id: data.userId,
      p_kr8_id: data.kr8Id,
      p_points_change: data.pointsChange,
      p_reason: data.reason,
      p_actor_id: userId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

const grantResetSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().min(5).max(500).optional(),
});

export const grantPasswordResetException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => grantResetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc('grant_password_reset_exception', {
      p_target_user_id: data.targetUserId,
      p_reason: data.reason || 'Admin granted exception',
      p_actor_id: userId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const submitClientRequest = createServerFn({ method: "POST" })
  .inputValidator(d => z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().min(7).max(20).optional(),
    service: z.string().min(2).max(100),
    message: z.string().min(10).max(2000),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc('submit_client_request', {
      p_name: data.name,
      p_email: data.email,
      p_phone: data.phone || null,
      p_service: data.service,
      p_message: data.message,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const incrementLinkClick = createServerFn({ method: "POST" })
  .inputValidator(d => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc('increment_link_click', { p_slug: data.slug });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
