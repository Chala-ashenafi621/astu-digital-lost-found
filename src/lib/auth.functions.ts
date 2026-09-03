import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAstuEmail } from "./constants";

const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  fullName: z.string().trim().min(2).max(100),
  department: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
});

/**
 * Registration is server-only so the ASTU email-domain rule cannot be bypassed
 * from the browser. The account is created with the service role, then the
 * client signs in normally with the password.
 */
export const registerStudent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    if (!isAstuEmail(email)) {
      return { ok: false as const, error: "Only ASTU email addresses (@astu.edu.et) can register." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        department: data.department ?? null,
        phone: data.phone ?? null,
      },
    });

    if (error) {
      const message = /already/i.test(error.message)
        ? "An account with this email already exists."
        : "Could not create the account. Please try again.";
      return { ok: false as const, error: message };
    }

    const { logAudit } = await import("./server-helpers.server");
    await logAudit({
      actorId: created.user?.id ?? null,
      action: "user.registered",
      entityType: "user",
      entityId: created.user?.id ?? null,
      metadata: { email },
    });

    return { ok: true as const };
  });

/** Whether an admin already exists — drives the one-time setup screen. */
export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * One-time bootstrap of the first admin. Requires a signed-in ASTU account and
 * the backend-only setup code; refuses once any admin exists. Students can
 * never insert into user_roles (no write grant, no policy).
 */
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ setupCode: z.string().min(8).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expected = process.env["ADMIN_SETUP_CODE"];
    if (!expected) return { ok: false as const, error: "Setup code is not configured." };

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) return { ok: false as const, error: "An administrator already exists." };

    if (!safeEqual(data.setupCode.trim(), expected)) {
      const { logAudit } = await import("./server-helpers.server");
      await logAudit({
        actorId: context.userId,
        action: "admin.bootstrap_failed",
        entityType: "user",
        entityId: context.userId,
      });
      return { ok: false as const, error: "Invalid setup code." };
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) return { ok: false as const, error: "Could not grant the administrator role." };

    const { logAudit } = await import("./server-helpers.server");
    await logAudit({
      actorId: context.userId,
      action: "admin.bootstrapped",
      entityType: "user",
      entityId: context.userId,
    });
    return { ok: true as const };
  });

/** Current user's roles + profile, for the app shell. */
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: roles }, { data: profile }] = await Promise.all([
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
    ]);
    return {
      userId: context.userId,
      roles: (roles ?? []).map((r) => r.role),
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      profile: profile ?? null,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(100),
        department: z.string().trim().max(100).optional().default(""),
        phone: z.string().trim().max(30).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        department: data.department || null,
        phone: data.phone || null,
      })
      .eq("id", context.userId);
    if (error) return { ok: false as const, error: "Could not save your profile." };
    return { ok: true as const };
  });
