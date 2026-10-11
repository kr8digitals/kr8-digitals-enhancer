import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const applyPointsSchema = z.object({
  userId: z.string().min(1),
  kr8Id: z.string().min(1),
  pointsChange: z.number().int().min(-1000).max(1000).refine(v => v !== 0, "Points change cannot be 0"),
  reason: z.string().min(2).max(500),
});

export const applyPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => applyPointsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""));
    const safeActorUuid = isUuid ? userId : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try RPC first if actor is a UUID
    if (isUuid) {
      const { data: result, error } = await supabaseAdmin.rpc('apply_points', {
        p_user_id: data.userId,
        p_kr8_id: data.kr8Id,
        p_points_change: data.pointsChange,
        p_reason: data.reason,
        p_actor_id: userId,
      });
      if (!error && result) {
        return result;
      }
    }

    // Direct DB fallback using supabaseAdmin
    let profile: any = null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.userId)) {
      const { data: p } = await supabaseAdmin
        .from('profiles')
        .select('id, points, name, kr8_id')
        .eq('id', data.userId)
        .maybeSingle();
      profile = p;
    }
    if (!profile) {
      const { data: pByKr8 } = await supabaseAdmin
        .from('profiles')
        .select('id, points, name, kr8_id')
        .or(`kr8_id.ilike.${data.kr8Id},kr8_id.ilike.${data.userId}`)
        .limit(1);
      profile = pByKr8?.[0] || null;
    }

    if (!profile) {
      throw new Error(`Student profile not found for ${data.kr8Id || data.userId}`);
    }

    const oldPoints = Number(profile.points || 0);
    const newPoints = Math.max(0, oldPoints + data.pointsChange);

    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({ points: newPoints, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (updErr) throw new Error(updErr.message);

    try {
      await supabaseAdmin.from('points_audit_log').insert({
        student_id: profile.id,
        admin_id: safeActorUuid,
        delta: data.pointsChange,
        reason: data.reason,
        source: 'admin_manual',
      });
    } catch {}

    try {
      await supabaseAdmin.from('points_ledger').insert({
        user_id: profile.id,
        kr8_id: profile.kr8_id,
        points_change: data.pointsChange,
        reason: data.reason,
        source_type: 'manual_admin',
        created_by: safeActorUuid,
      });
    } catch {}

    try {
      await supabaseAdmin.from('activity_log').insert({
        actor_id: safeActorUuid,
        action: data.pointsChange >= 0 ? 'points_awarded' : 'points_deducted',
        target: `${profile.name} (${profile.kr8_id})`,
        details: { delta: data.pointsChange, reason: data.reason, new_total: newPoints, kr8_id: profile.kr8_id },
      });
    } catch {}

    return { ok: true, old_points: oldPoints, new_points: newPoints };
  });

const grantResetSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().min(3).max(500).optional(),
});

export const grantPasswordResetException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => grantResetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (isUuid) {
      const { data: result, error } = await supabaseAdmin.rpc('grant_password_reset_exception', {
        p_target_user_id: data.targetUserId,
        p_reason: data.reason || 'Admin granted exception',
        p_actor_id: userId,
      });
      if (!error) return result;
    }
    await supabaseAdmin
      .from('profiles')
      .update({ password_reset_exception_granted: true })
      .eq('id', data.targetUserId);
    return { ok: true };
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
    if (error) {
      await supabaseAdmin.from('client_requests').insert({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        service: data.service,
        message: data.message,
      });
      return { ok: true };
    }
    return result;
  });

export const incrementLinkClick = createServerFn({ method: "POST" })
  .inputValidator(d => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc('increment_link_click', { p_slug: data.slug });
    if (error) return { ok: false };
    return { ok: true };
  });
