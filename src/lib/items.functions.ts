import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ALLOWED_IMAGE_MIME,
  ITEM_CATEGORIES,
  MAX_IMAGES_PER_ITEM,
  MAX_IMAGE_BYTES,
} from "./constants";

export type PublicItem = {
  id: string;
  type: "lost" | "found";
  title: string;
  description: string;
  category: string;
  location: string;
  occurred_on: string;
  status: "open" | "claimed" | "resolved";
  created_at: string;
  images: string[];
};

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: z.enum(["lost", "found"]).optional(),
  category: z.string().trim().max(40).optional(),
  status: z.enum(["open", "claimed", "resolved"]).optional(),
  limit: z.number().int().min(1).max(60).optional(),
});

/**
 * Public browsing. Uses the publishable (anon) key so the anon SELECT policy —
 * approved, non-removed items only — is the security boundary. No reporter
 * identity or contact data is ever selected here.
 */
export const listPublicItems = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<PublicItem[]> => {
    const { publicClient } = await import("./public-client.server");
    const { signPaths } = await import("./server-helpers.server");

    let query = publicClient()
      .from("items")
      .select(
        "id, type, title, description, category, location, occurred_on, status, created_at, item_images(storage_path, position)",
      )
      .eq("moderation", "approved")
      .eq("is_removed", false)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 40);

    if (data.type) query = query.eq("type", data.type);
    if (data.category) query = query.eq("category", data.category);
    if (data.status) query = query.eq("status", data.status);
    if (data.q) {
      const term = data.q.replace(/[%,()]/g, " ");
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,location.ilike.%${term}%`);
    }

    const { data: rows, error } = await query;
    if (error || !rows) return [];

    const paths = rows.flatMap((row) =>
      (row.item_images ?? []).map((img: { storage_path: string }) => img.storage_path),
    );
    const signed = await signPaths("item-images", paths);

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      category: row.category,
      location: row.location,
      occurred_on: row.occurred_on,
      status: row.status,
      created_at: row.created_at,
      images: (row.item_images ?? [])
        .sort(
          (a: { position: number }, b: { position: number }) => a.position - b.position,
        )
        .map((img: { storage_path: string }) => signed[img.storage_path])
        .filter((url: string | undefined): url is string => Boolean(url)),
    }));
  });

export const getPublicItem = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<PublicItem | null> => {
    const { publicClient } = await import("./public-client.server");
    const { signPaths } = await import("./server-helpers.server");

    const { data: row } = await publicClient()
      .from("items")
      .select(
        "id, type, title, description, category, location, occurred_on, status, created_at, item_images(storage_path, position)",
      )
      .eq("id", data.id)
      .eq("moderation", "approved")
      .eq("is_removed", false)
      .maybeSingle();

    if (!row) return null;
    const images = (row.item_images ?? []).sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position,
    );
    const signed = await signPaths(
      "item-images",
      images.map((img: { storage_path: string }) => img.storage_path),
    );

    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      category: row.category,
      location: row.location,
      occurred_on: row.occurred_on,
      status: row.status,
      created_at: row.created_at,
      images: images
        .map((img: { storage_path: string }) => signed[img.storage_path])
        .filter((url: string | undefined): url is string => Boolean(url)),
    };
  });

const itemInput = z.object({
  type: z.enum(["lost", "found"]),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  category: z.enum(ITEM_CATEGORIES),
  location: z.string().trim().min(2).max(120),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => itemInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("items")
      .insert({
        reporter_id: context.userId,
        type: data.type,
        title: data.title,
        description: data.description,
        category: data.category,
        location: data.location,
        occurred_on: data.occurredOn,
      })
      .select("id")
      .single();

    if (error || !row) return { ok: false as const, error: "Could not save your report." };

    const { logAudit } = await import("./server-helpers.server");
    await logAudit({
      actorId: context.userId,
      action: "item.created",
      entityType: "item",
      entityId: row.id,
      metadata: { type: data.type, title: data.title },
    });
    return { ok: true as const, id: row.id };
  });

/**
 * Files are uploaded straight to the user's own storage folder (RLS-scoped),
 * then registered here. The server re-checks path shape, MIME type and size
 * against the stored object and deletes anything that fails.
 */
export const attachItemImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        itemId: z.string().uuid(),
        paths: z.array(z.string().max(200)).min(1).max(MAX_IMAGES_PER_ITEM),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: item } = await context.supabase
      .from("items")
      .select("id, reporter_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || item.reporter_id !== context.userId) {
      return { ok: false as const, error: "You can only add photos to your own report." };
    }

    const { validateUploadedObject, removeObjects } = await import("./server-helpers.server");
    const accepted: string[] = [];
    const rejected: string[] = [];

    for (const path of data.paths) {
      const result = await validateUploadedObject({
        bucket: "item-images",
        path,
        userId: context.userId,
        allowedMime: ALLOWED_IMAGE_MIME,
        maxBytes: MAX_IMAGE_BYTES,
      });
      if (result.ok) accepted.push(path);
      else rejected.push(path);
    }
    await removeObjects("item-images", rejected);

    if (accepted.length === 0) return { ok: false as const, error: "No valid image was uploaded." };

    const { error } = await context.supabase.from("item_images").insert(
      accepted.map((path, index) => ({
        item_id: data.itemId,
        storage_path: path,
        position: index,
      })),
    );
    if (error) return { ok: false as const, error: "Could not attach the photos." };
    return { ok: true as const, attached: accepted.length, rejected: rejected.length };
  });

export const listMyItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase
      .from("items")
      .select("*, item_images(storage_path, position), claims(id, status)")
      .eq("reporter_id", context.userId)
      .order("created_at", { ascending: false });

    const { signPaths } = await import("./server-helpers.server");
    const signed = await signPaths(
      "item-images",
      (rows ?? []).flatMap((r) =>
        (r.item_images ?? []).map((i: { storage_path: string }) => i.storage_path),
      ),
    );
    return (rows ?? []).map((r) => ({
      ...r,
      images: (r.item_images ?? [])
        .map((i: { storage_path: string }) => signed[i.storage_path])
        .filter((u: string | undefined): u is string => Boolean(u)),
    }));
  });

export const setMyItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ itemId: z.string().uuid(), status: z.enum(["open", "claimed", "resolved"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("items")
      .update({ status: data.status })
      .eq("id", data.itemId)
      .eq("reporter_id", context.userId);
    if (error) return { ok: false as const, error: "Could not update the report." };
    const { logAudit } = await import("./server-helpers.server");
    await logAudit({
      actorId: context.userId,
      action: "item.status_changed",
      entityType: "item",
      entityId: data.itemId,
      metadata: { status: data.status, by: "owner" },
    });
    return { ok: true as const };
  });

export const deleteMyItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ itemId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: images } = await context.supabase
      .from("item_images")
      .select("storage_path")
      .eq("item_id", data.itemId);

    const { error } = await context.supabase
      .from("items")
      .delete()
      .eq("id", data.itemId)
      .eq("reporter_id", context.userId);
    if (error) return { ok: false as const, error: "Could not delete the report." };

    const { removeObjects, logAudit } = await import("./server-helpers.server");
    await removeObjects(
      "item-images",
      (images ?? []).map((i) => i.storage_path),
    );
    await logAudit({
      actorId: context.userId,
      action: "item.deleted",
      entityType: "item",
      entityId: data.itemId,
      metadata: { by: "owner" },
    });
    return { ok: true as const };
  });
