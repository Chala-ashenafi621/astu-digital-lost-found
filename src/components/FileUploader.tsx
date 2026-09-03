import { useState } from "react";
import { Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { extensionForMime } from "@/lib/constants";

type Props = {
  bucket: "item-images" | "claim-evidence";
  userId: string;
  allowedMime: readonly string[];
  maxBytes: number;
  maxFiles: number;
  value: string[];
  onChange: (paths: string[]) => void;
  label: string;
};

/**
 * Uploads into the signed-in user's own storage folder (storage RLS scopes the
 * folder). The server re-validates every path, MIME type and size before the
 * file is linked to a report or claim.
 */
export function FileUploader({
  bucket,
  userId,
  allowedMime,
  maxBytes,
  maxFiles,
  value,
  onChange,
  label,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const next = [...value];
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (next.length >= maxFiles) {
          setError(`You can upload at most ${maxFiles} files.`);
          break;
        }
        if (!allowedMime.includes(file.type)) {
          setError(`Unsupported file type: ${file.type || "unknown"}`);
          continue;
        }
        if (file.size > maxBytes) {
          setError(`"${file.name}" is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
          continue;
        }
        const path = `${userId}/${crypto.randomUUID()}.${extensionForMime(file.type)}`;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          setError("Upload failed. Please try again.");
          continue;
        }
        next.push(path);
      }
      onChange(next);
    } finally {
      setBusy(false);
    }
  }

  async function remove(path: string) {
    await supabase.storage.from(bucket).remove([path]);
    onChange(value.filter((p) => p !== path));
  }

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm hover:bg-secondary">
        <Upload className="size-4" />
        <span>{busy ? "Uploading…" : label}</span>
        <input
          type="file"
          multiple
          className="hidden"
          accept={allowedMime.join(",")}
          disabled={busy}
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((path) => (
            <li
              key={path}
              className="flex items-center justify-between rounded-md bg-secondary px-3 py-1.5 text-xs"
            >
              <span className="truncate">{path.split("/")[1]}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => void remove(path)}>
                <X className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
