import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, MapPin, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader } from "@/components/FileUploader";
import { useSession } from "@/hooks/useSession";
import { getPublicItem } from "@/lib/items.functions";
import { attachClaimEvidence, createClaim } from "@/lib/claims.functions";
import { ALLOWED_EVIDENCE_MIME, MAX_EVIDENCE_BYTES, MAX_EVIDENCE_PER_CLAIM } from "@/lib/constants";

const itemQuery = (id: string) =>
  queryOptions({ queryKey: ["item", id], queryFn: () => getPublicItem({ data: { id } }) });

export const Route = createFileRoute("/items/$id")({
  loader: async ({ context, params }) => {
    const item = await context.queryClient.ensureQueryData(itemQuery(params.id));
    if (!item) throw notFound();
    return item;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Item"} — ASTU Lost & Found` },
      {
        name: "description",
        content: (loaderData?.description ?? "Lost and found report at ASTU.").slice(0, 155),
      },
      { property: "og:title", content: `${loaderData?.title ?? "Item"} — ASTU Lost & Found` },
      {
        property: "og:description",
        content: (loaderData?.description ?? "Lost and found report at ASTU.").slice(0, 155),
      },
    ],
  }),
  errorComponent: () => (
    <p className="p-10 text-center text-muted-foreground">This report could not be loaded.</p>
  ),
  notFoundComponent: () => (
    <p className="p-10 text-center text-muted-foreground">This report is not available.</p>
  ),
  component: ItemDetail,
});

function ItemDetail() {
  const { id } = Route.useParams();
  const { data: item } = useQuery(itemQuery(id));
  const { session } = useSession();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!item) return null;

  async function submitClaim() {
    if (evidence.trim().length < 20) {
      toast.error("Please describe your evidence (at least 20 characters).");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createClaim({ data: { itemId: id, evidenceText: evidence.trim() } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (files.length > 0) {
        const attached = await attachClaimEvidence({ data: { claimId: result.id, paths: files } });
        if (!attached.ok) toast.warning(attached.error);
      }
      toast.success("Claim submitted. An administrator will review it.");
      navigate({ to: "/my-claims" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to all reports
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          {item.images.length > 0 ? (
            item.images.map((url) => (
              <img
                key={url}
                src={url}
                alt={item.title}
                className="w-full rounded-xl border border-border object-cover"
              />
            ))
          ) : (
            <div className="grid h-64 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
              No photo provided
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={item.type === "lost" ? "destructive" : "default"}>
              {item.type === "lost" ? "Lost" : "Found"}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {item.category.replace("-", " ")}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {item.status}
            </Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{item.title}</h1>
          <p className="mt-3 whitespace-pre-line text-muted-foreground">{item.description}</p>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" /> {item.location}
            </li>
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" /> {item.occurred_on}
            </li>
            <li className="flex items-start gap-2 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 text-primary" />
              Contact details are never published. Submit a claim and administrators will handle the
              handover.
            </li>
          </ul>

          <div className="mt-6">
            {!session ? (
              <Button onClick={() => navigate({ to: "/auth" })}>Sign in to claim this item</Button>
            ) : !showForm ? (
              <Button onClick={() => setShowForm(true)}>Claim this item</Button>
            ) : (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <h2 className="font-semibold">Ownership evidence</h2>
                <p className="text-sm text-muted-foreground">
                  Describe details only the real owner would know (marks, contents, serial number,
                  where and when you lost it). Your evidence is private — only administrators and the
                  reporter can see it.
                </p>
                <Textarea
                  value={evidence}
                  maxLength={2000}
                  rows={5}
                  onChange={(event) => setEvidence(event.target.value)}
                  placeholder="My laptop has a blue ASTU sticker on the lid and the serial ends with 4471…"
                />
                {session && (
                  <FileUploader
                    bucket="claim-evidence"
                    userId={session.user.id}
                    allowedMime={ALLOWED_EVIDENCE_MIME}
                    maxBytes={MAX_EVIDENCE_BYTES}
                    maxFiles={MAX_EVIDENCE_PER_CLAIM}
                    value={files}
                    onChange={setFiles}
                    label="Attach private proof (optional: photo, receipt, PDF)"
                  />
                )}
                <Button disabled={submitting} onClick={() => void submitClaim()}>
                  {submitting ? "Submitting…" : "Submit claim"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
