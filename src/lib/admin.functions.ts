import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Every admin action re-verifies the caller's role server-side against
 * user_roles (readable by the signed-in user, writable only by the service
 * role). Route guards are UX only — this is the security boundary.
 */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: administrator role required");
}

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const counts = async (table: string, filters: Record<string, string> = {}) => {
      let q = supabaseAdmin.from(table as never).select("id", { count: "exact", head: true });
      for (const [key, value] of Object.entries(filters)) q = q.eq(key, value);
      const { count } = await q;
      return count ?? 0;
    };

    const [items, lost, found, resolved, pendingClaims, approvedClaims, rejectedClaims, users] =
      await Promise.all([
        counts("items"),
        counts("items", { type: "lost" }),
        counts("items", { type: "found" }),
        counts("items", { status: "resolved" }),
        counts("claims", { status: "pending" }),
        counts("claims", { status: "approved" }),
        counts("claims", { status: "rejected" }),
        counts("profiles"),
      ]);

    const { data: recent } = await supabaseAdmin
      .from("items")
      .select("created_at, type")
      .order("created_at", { ascending: false })
      .limit(200);

    return {
      items,
      lost,
      found,
      resolved,
      pendingClaims,
      approvedClaims,
      rejectedClaims,
      users,
      recent: recent ?? [],
    };
  });

export const adminListItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ moderation: z.enum(["pending", "approved", "rejected"]).optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.moderation) query = query.eq("moderation", data.moderation);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    // reporter_id references auth.users, so the reporter profile is looked up
    // separately (no PostgREST relationship exists between items and profiles).
    const ids = [...new Set((rows ?? []).map((r) => r.reporter_id))];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as { id: string; full_name: string; email: string }[] };
    return (rows ?? []).map((r) => ({
      ...r,
      profiles: (profiles ?? []).find((p) => p.id === r.reporter_id) ?? null,
    }));
  });

export const adminModerateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        itemId: z.string().uuid(),
        moderation: z.enum(["pending", "approved", "rejected"]),
        note: z.string().trim().max(500).optional(),
        remove: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit, notify } = await import("./server-helpers.server");

    const { data: item } = await supabaseAdmin
      .from("items")
      .update({
        moderation: data.moderation,
        moderation_note: data.note ?? null,
        ...(data.remove === undefined ? {} : { is_removed: data.remove }),
      })
      .eq("id", data.itemId)
      .select("id, title, reporter_id")
      .maybeSingle();
    if (!item) return { ok: false as const, error: "Report not found." };

    await notify({
      userId: item.reporter_id,
      title: `Your report was ${data.moderation}`,
      body: `"${item.title}" is now ${data.moderation}${data.note ? `: ${data.note}` : "."}`,
      link: "/my-items",
    });
    await logAudit({
      actorId: context.userId,
      action: "item.moderated",
      entityType: "item",
      entityId: item.id,
      metadata: { moderation: data.moderation, removed: data.remove ?? null, note: data.note ?? null },
    });
    return { ok: true as const };
  });

export const adminSetItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ itemId: z.string().uuid(), status: z.enum(["open", "claimed", "resolved"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./server-helpers.server");
    await supabaseAdmin.from("items").update({ status: data.status }).eq("id", data.itemId);
    await logAudit({
      actorId: context.userId,
      action: "item.status_changed",
      entityType: "item",
      entityId: data.itemId,
      metadata: { status: data.status, by: "admin" },
    });
    return { ok: true as const };
  });

export const adminListClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("claims")
      .select(
        "*, items(id, title, type, status), claim_evidence_files(id, storage_path, mime_type, size_bytes)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    // claimant_id references auth.users, so claimant profiles are fetched separately.
    const ids = [...new Set(rows.map((r: any) => r.claimant_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, department")
      .in("id", ids);

    const { signPaths } = await import("./server-helpers.server");
    const signed = await signPaths(
      "claim-evidence",
      rows.flatMap((r: any) => (r.claim_evidence_files ?? []).map((f: any) => f.storage_path)),
      60 * 10,
    );
    return rows.map((r: any) => ({
      ...r,
      profiles: (profiles ?? []).find((p) => p.id === r.claimant_id) ?? null,
      evidence: (r.claim_evidence_files ?? [])
        .map((f: any) => ({ id: f.id, mime: f.mime_type, url: signed[f.storage_path] }))
        .filter((f: any) => Boolean(f.url)),
    }));
  });

export const adminDecideClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        claimId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit, notify } = await import("./server-helpers.server");

    const { data: claim } = await supabaseAdmin
      .from("claims")
      .select("id, status, item_id, claimant_id")
      .eq("id", data.claimId)
      .maybeSingle();
    if (!claim) return { ok: false as const, error: "Claim not found." };
    if (claim.status !== "pending") {
      return { ok: false as const, error: "This claim has already been decided." };
    }

    const { error } = await supabaseAdmin
      .from("claims")
      .update({
        status: data.decision,
        decision_note: data.note ?? null,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.claimId)
      .eq("status", "pending");
    if (error) return { ok: false as const, error: "Could not record the decision." };

    const { data: item } = await supabaseAdmin
      .from("items")
      .select("id, title, reporter_id")
      .eq("id", claim.item_id)
      .maybeSingle();

    if (data.decision === "approved") {
      await supabaseAdmin.from("items").update({ status: "claimed" }).eq("id", claim.item_id);
      await logAudit({
        actorId: context.userId,
        action: "item.status_changed",
        entityType: "item",
        entityId: claim.item_id,
        metadata: { status: "claimed", reason: "claim approved" },
      });
    }

    await notify({
      userId: claim.claimant_id,
      title: `Your claim was ${data.decision}`,
      body: `Your claim for "${item?.title ?? "an item"}" was ${data.decision}${
        data.note ? `: ${data.note}` : "."
      }`,
      link: "/my-claims",
    });
    if (item) {
      await notify({
        userId: item.reporter_id,
        title: `A claim on your report was ${data.decision}`,
        body: `"${item.title}" — decision recorded by an administrator.`,
        link: "/my-items",
      });
    }
    await logAudit({
      actorId: context.userId,
      action: `claim.${data.decision}`,
      entityType: "claim",
      entityId: data.claimId,
      metadata: { itemId: claim.item_id, note: data.note ?? null },
    });

    return { ok: true as const };
  });

export const adminListAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // Read through the user's own client: only the admin SELECT policy allows this.
    const { data } = await context.supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    return data ?? [];
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, department, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "student"]),
        grant: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      return { ok: false as const, error: "You cannot remove your own administrator role." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./server-helpers.server");

    if (data.grant) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
    }
    await logAudit({
      actorId: context.userId,
      action: data.grant ? "role.granted" : "role.revoked",
      entityType: "user",
      entityId: data.userId,
      metadata: { role: data.role },
    });
    return { ok: true as const };
  });
