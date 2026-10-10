import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Role and permission system
// Only founder can promote, demote, or change permissions
// User can never change own role

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

export const promoteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => promoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only founder can promote
    const { data: founderCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'founder')
      .maybeSingle();

    if (!founderCheck) {
      throw new Error("Only founder can promote users");
    }

    // Prevent self-promotion
    if (data.targetUserId === userId) {
      throw new Error("Cannot change own role");
    }

    // Check target exists
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .eq('id', data.targetUserId)
      .maybeSingle();

    if (!targetProfile) {
      throw new Error("Target user not found");
    }

    // Prevent promoting to founder via this function (founder is special, only via email verification)
    if (data.role === 'founder' as any) {
      throw new Error("Cannot promote to founder via this function. Founder is only kr8digitals01@gmail.com after email verification.");
    }

    // Insert role with permissions
    const { error } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: data.targetUserId,
        role: data.role,
        title: data.title || null,
        permissions: data.permissions || [],
        granted_by: userId,
        granted_at: new Date().toISOString(),
      }, { onConflict: 'user_id,role' });

    if (error) throw new Error(error.message);

    // Log
    await supabaseAdmin.from('activity_log').insert({
      actor_id: userId,
      action: 'role_granted',
      target: targetProfile.name,
      details: { role: data.role, permissions: data.permissions, target_email: targetProfile.email },
    });

    return { ok: true };
  });

export const demoteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => demoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only founder can demote
    const { data: founderCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'founder')
      .maybeSingle();

    if (!founderCheck) {
      throw new Error("Only founder can demote users");
    }

    if (data.targetUserId === userId) {
      throw new Error("Cannot change own role");
    }

    // Prevent demoting founder
    const { data: targetRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', data.targetUserId);

    if (targetRoles?.some(r => r.role === 'founder')) {
      throw new Error("Cannot demote founder");
    }

    const { error } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', data.targetUserId)
      .eq('role', data.role);

    if (error) throw new Error(error.message);

    await supabaseAdmin.from('activity_log').insert({
      actor_id: userId,
      action: 'role_revoked',
      target: data.targetUserId,
      details: { role: data.role },
    });

    return { ok: true };
  });

export const updatePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({
    targetUserId: z.string().uuid(),
    role: z.string().min(1),
    permissions: z.array(z.string()).max(30),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: founderCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'founder')
      .maybeSingle();

    if (!founderCheck) {
      throw new Error("Only founder can change permissions");
    }

    if (data.targetUserId === userId) {
      throw new Error("Cannot change own permissions");
    }

    const { error } = await supabaseAdmin
      .from('user_roles')
      .update({
        permissions: data.permissions,
        granted_by: userId,
        granted_at: new Date().toISOString(),
      })
      .eq('user_id', data.targetUserId)
      .eq('role', data.role);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const listRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({}).parse(d))
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only admin can list roles
    const { data: isAdmin } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['founder','co-founder','admin'])
      .maybeSingle();

    if (!isAdmin) {
      throw new Error("Only admins can view roles");
    }

    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select(`
        *,
        profiles:user_id (kr8_id, name, email, phone)
      `)
      .order('granted_at', { ascending: false });

    return roles || [];
  });
