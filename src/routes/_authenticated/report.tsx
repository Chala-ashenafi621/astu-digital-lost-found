import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader } from "@/components/FileUploader";
import { useSession } from "@/hooks/useSession";
import { createItem, attachItemImages } from "@/lib/items.functions";
import {
  ALLOWED_IMAGE_MIME,
  ITEM_CATEGORIES,
  MAX_IMAGES_PER_ITEM,
  MAX_IMAGE_BYTES,
} from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "Report a lost or found item — ASTU Lost & Found" },
      {
        name: "description",
        content: "Post a lost or found item report with photos for the ASTU campus community.",
      },
      { property: "og:title", content: "Report an item — ASTU Lost & Found" },
      { property: "og:description", content: "Post a lost or found item report at ASTU." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [form, setForm] = useState({
    type: "lost" as "lost" | "found",
    title: "",
    description: "",
    category: "other",
    location: "",
    occurredOn: new Date().toISOString().slice(0, 10),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await createItem({
        data: {
          type: form.type,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category as (typeof ITEM_CATEGORIES)[number],
          location: form.location.trim(),
          occurredOn: form.occurredOn,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (paths.length > 0) {
        const attached = await attachItemImages({ data: { itemId: result.id, paths } });
        if (!attached.ok) toast.warning(attached.error);
        else if (attached.rejected > 0)
          toast.warning(`${attached.rejected} file(s) were rejected by the server checks.`);
      }
      toast.success("Report published.");
      navigate({ to: "/my-items" });
    } catch {
      toast.error("Please check the form and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Report an item</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your report is public. Never include your phone number, ID number or address in the
        description — claimants reach you through the system.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5 rounded-xl border border-border p-6">
        <div className="flex gap-2">
          {(["lost", "found"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, type: value }))}
              className={`flex-1 rounded-md border px-4 py-2 text-sm capitalize ${
                form.type === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              I {value} an item
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            required
            minLength={3}
            maxLength={120}
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Black HP laptop bag"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Describe the item, but keep one identifying detail secret so you can verify the owner."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
            >
              {ITEM_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category.replace("-", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={form.occurredOn}
              onChange={(event) => setForm((prev) => ({ ...prev, occurredOn: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="location">Place on campus</Label>
          <Input
            id="location"
            required
            maxLength={120}
            value={form.location}
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
            placeholder="Library, 2nd floor"
          />
        </div>

        {session && (
          <FileUploader
            bucket="item-images"
            userId={session.user.id}
            allowedMime={ALLOWED_IMAGE_MIME}
            maxBytes={MAX_IMAGE_BYTES}
            maxFiles={MAX_IMAGES_PER_ITEM}
            value={paths}
            onChange={setPaths}
            label={`Add photos (up to ${MAX_IMAGES_PER_ITEM}, max 5 MB each)`}
          />
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Publishing…" : "Publish report"}
        </Button>
      </form>
    </main>
  );
}
