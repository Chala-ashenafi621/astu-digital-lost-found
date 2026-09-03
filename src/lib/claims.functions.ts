import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALLOWED_EVIDENCE_MIME, MAX_EVIDENCE_BYTES, MAX_EVIDENCE_PER_CLAIM } from "./constants";

export const createClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        itemId: z.string().uuid(),
        evidenceText: z.string().trim().min(20, "Describe your evidence in detail").max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // RLS enforces: item must be public, and you cannot claim your own report.
    const { data: row, error } = await context.supabase
      .from("claims")
      .insert({
        item_id: data.itemId,
        claimant_id: context.userId,
        evidence_text: data.evidenceText,
      })
      .select("id")
      .single();

    if (error || !row) {
      const duplicate = error?.code === "23505";
      return {
        ok: false as const,
        error: duplicate
          ? "You have already submitted a claim for this item."
          : "Could not submit the claim.",
      };
    }

    const { logAudit, notify } = await import("./server-helpers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("items")
      .select("title, reporter_id")
      .eq("id", data.itemId)
      .maybeSingle();

    if (item) {
      await notify({
        userId: item.reporter_id,
        title: "New claim on your report",
        body: `Someone submitted a claim for "${item.title}". An administrator will review it.`,
        link: "/my-items",
      });
    }
    await logAudit({
      actorId: context.userId,
      action: "claim.created",
      entityType: "claim",
      entityId: row.id,
      metadata: { itemId: data.itemId },
    });
    return { ok: true as const, id: row.id };
  });

export const attachClaimEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        claimId: z.string().uuid(),
        paths: z.array(z.string().max(200)).min(1).max(MAX_EVIDENCE_PER_CLAIM),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: claim } = await context.supabase
      .from("claims")
      .select("id, claimant_id")
      .eq("id", data.claimId)
      .maybeSingle();
    if (!claim || claim.claimant_id !== context.userId) {
      return { ok: false as const, error: "You can only attach evidence to your own claim." };
    }

    const { validateUploadedObject, removeObjects } = await import("./server-helpers.server");
    const accepted: { path: string; mime: string; size: number }[] = [];
    const rejected: string[] = [];

    for (const path of data.paths) {
      const result = await validateUploadedObject({
        bucket: "claim-evidence",
        path,
        userId: context.userId,
        allowedMime: ALLOWED_EVIDENCE_MIME,
        maxBytes: MAX_EVIDENCE_BYTES,
      });
      if (result.ok) accepted.push({ path, mime: result.mime, size: result.size });
      else rejected.push(path);
    }
    await removeObjects("claim-evidence", rejected);
    if (accepted.length === 0) return { ok: false as const, error: "No valid file was uploaded." };

    const { error } = await context.supabase.from("claim_evidence_files").insert(
      accepted.map((file) => ({
        claim_id: data.claimId,
        storage_path: file.path,
        mime_type: file.mime,
        size_bytes: file.size,
      })),
    );
    if (error) return { ok: false as const, error: "Could not save the evidence files." };
    return { ok: true as const, attached: accepted.length, rejected: rejected.length };
  });

export const listMyClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("claims")
      .select("*, items(id, title, type, status)")
      .eq("claimant_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

/** Claims on reports I own — evidence text stays visible only to owner/admin. */
export const listClaimsOnMyItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("claims")
      .select("*, items!inner(id, title, reporter_id)")
      .eq("items.reporter_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

/** Short-lived signed links to private evidence, only for people RLS allows. */
export const getClaimEvidenceLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ claimId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: files } = await context.supabase
      .from("claim_evidence_files")
      .select("id, storage_path, mime_type, size_bytes")
      .eq("claim_id", data.claimId);
    if (!files || files.length === 0) return [];

    const { signPaths } = await import("./server-helpers.server");
    const signed = await signPaths(
      "claim-evidence",
      files.map((f) => f.storage_path),
      60 * 10,
    );
    return files
      .map((f) => ({ id: f.id, mime: f.mime_type, size: f.size_bytes, url: signed[f.storage_path] }))
      .filter((f): f is { id: string; mime: string; size: number; url: string } => Boolean(f.url));
  });
