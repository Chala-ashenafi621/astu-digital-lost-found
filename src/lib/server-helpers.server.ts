// Server-only helpers. Never imported from client code (blocked by filename).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function logAudit(entry: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
  if (error) console.error("[audit] failed to write log", error);
}

export async function notify(entry: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: entry.userId,
    title: entry.title,
    body: entry.body ?? "",
    link: entry.link ?? null,
  });
  if (error) console.error("[notify] failed", error);
}

/** Signed URLs for private storage objects. Caller MUST authorize first. */
export async function signPaths(
  bucket: string,
  paths: string[],
  expiresIn = 60 * 30,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.signedUrl && row.path) map[row.path] = row.signedUrl;
  }
  return map;
}

/** Server-side validation of an uploaded object: owner folder, MIME and size. */
export async function validateUploadedObject(opts: {
  bucket: string;
  path: string;
  userId: string;
  allowedMime: readonly string[];
  maxBytes: number;
}): Promise<{ ok: true; mime: string; size: number } | { ok: false; reason: string }> {
  const { bucket, path, userId, allowedMime, maxBytes } = opts;

  // Path must be exactly "<uid>/<uuid>.<ext>" — no traversal, no other users' folders.
  const safePath = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i;
  if (!safePath.test(path) || !path.startsWith(`${userId}/`)) {
    return { ok: false, reason: "Unsafe storage path" };
  }

  const folder = path.split("/")[0]!;
  const fileName = path.split("/")[1]!;
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(folder, {
    search: fileName,
    limit: 1,
  });
  const object = data?.find((entry) => entry.name === fileName);
  if (error || !object) return { ok: false, reason: "Uploaded file not found" };

  const metadata = (object.metadata ?? {}) as { mimetype?: string; size?: number };
  const mime = metadata.mimetype ?? "";
  const size = metadata.size ?? 0;

  if (!allowedMime.includes(mime)) return { ok: false, reason: `File type not allowed: ${mime}` };
  if (size <= 0 || size > maxBytes) return { ok: false, reason: "File exceeds the allowed size" };

  return { ok: true, mime, size };
}

export async function removeObjects(bucket: string, paths: string[]) {
  if (paths.length === 0) return;
  await supabaseAdmin.storage.from(bucket).remove(paths);
}
