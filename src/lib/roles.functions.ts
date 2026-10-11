import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const promoteSchema = z.object({
  targetUserId: z.string().uuid(),
  role: z.enum(['student','tribe','coach','assistant','admin','co-founder','attendance_reviewer','moderator']),
  title: z.string().max(100).optional(),
  permissions: z.array(z.string()).max(30).optional(),
});

const demoteSchema = z.object({
  targetUserId: z.string().uuid(),
  role: z.string().min(1),
});

async function isFounderUser(supabaseAdmin: any, userId: string, user?: any): Promise<boolean> {
  const email = String(user?.email || "").toLowerCase();
  if (email === "kr8digitals01@gmail.com" || email === "kutimfire001@gmail.com" || user?.is_executive) {
    return true;
  }
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""));
  if (!isUuid) return false;
  const { data: founderCheck } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'founder')
    .maybeSingle();
  return Boolean(founderCheck);
}

export const promoteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => promoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, user } = context as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""));
    const safeActorUuid = isUuid ? userId : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const isFounder = await isFounderUser(supabaseAdmin, userId, user);
    if (!isFounder) {
      throw new Error("Only founder can promote users");
    }

    if (data.targetUserId === userId) {
      throw new Error("Cannot change own role");
    }

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .eq('id', data.targetUserId)
      .maybeSingle();

    if (!targetProfile) {
      throw new Error("Target user not found");
    }

    if (data.role === 'founder' as any) {
      throw new Error("Cannot promote to founder via this function.");
    }

    const { error } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: data.targetUserId,
        role: data.role,
        title: data.title || null,
        permissions: data.permissions || [],
        granted_by: safeActorUuid,
        granted_at: new Date().toISOString(),
      }, { onConflict: 'user_id,role' });

    if (error) throw new Error(error.message);

    try {
      await supabaseAdmin.from('activity_log').insert({
        actor_id: safeActorUuid,
        action: 'role_granted',
        target: targetProfile.name,
        details: { role: data.role, permissions: data.permissions, target_email: targetProfile.email },
      });
    } catch {}

    return { ok: true };
  });

export const demoteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => demoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, user } = context as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""));
    const safeActorUuid = isUuid ? userId : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const isFounder = await isFounderUser(supabaseAdmin, userId, user);
    if (!isFounder) {
      throw new Error("Only founder can demote users");
    }

    if (data.targetUserId === userId) {
      throw new Error("Cannot change own role");
    }

    const { data: targetRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', data.targetUserId);

    if (targetRoles?.some((r: any) => r.role === 'founder')) {
      throw new Error("Cannot demote founder");
    }

    const { error } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', data.targetUserId)
      .eq('role', data.role);

    if (error) throw new Error(error.message);

    try {
      await supabaseAdmin.from('activity_log').insert({
        actor_id: safeActorUuid,
        action: 'role_revoked',
        target: data.targetUserId,
        details: { role: data.role },
      });
    } catch {}

    return { ok: true };
  });

export const updatePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    targetUserId: z.string().uuid(),
    role: z.string().min(1),
    permissions: z.array(z.string()).max(30),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, user } = context as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""));
    const safeActorUuid = isUuid ? userId : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const isFounder = await isFounderUser(supabaseAdmin, userId, user);
    if (!isFounder) {
      throw new Error("Only founder can change permissions");
    }

    if (data.targetUserId === userId) {
      throw new Error("Cannot change own permissions");
    }

    const { error } = await supabaseAdmin
      .from('user_roles')
      .update({
        permissions: data.permissions,
        granted_by: safeActorUuid,
        granted_at: new Date().toISOString(),
      })
      .eq('user_id', data.targetUserId)
      .eq('role', data.role);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const listRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({}).parse(d || {}))
  .handler(async ({ context }) => {
    const { userId, user } = context as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = String(user?.email || "").toLowerCase();
    const isExec =
      Boolean(user?.is_executive) ||
      ["kr8digitals01@gmail.com", "kutimfire001@gmail.com", "stevenson@kr8digitals.com", "daniel@kr8digitals.com"].includes(email);

    if (!isExec && isUuid) {
      const { data: isAdmin } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['founder','co-founder','admin'])
        .maybeSingle();

      if (!isAdmin) {
        throw new Error("Only admins can view roles");
      }
    } else if (!isExec) {
      throw new Error("Only admins can view roles");
    }

    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select(`
        *,
        profiles:user_id (id, kr8_id, name, email, avatar)
      `)
      .order('granted_at', { ascending: false });

    return roles || [];
  });
