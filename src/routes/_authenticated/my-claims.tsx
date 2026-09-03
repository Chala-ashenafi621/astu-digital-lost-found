import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { listMyClaims } from "@/lib/claims.functions";

export const Route = createFileRoute("/_authenticated/my-claims")({
  head: () => ({
    meta: [
      { title: "My claims — ASTU Lost & Found" },
      { name: "description", content: "Track the review status of ownership claims you submitted." },
      { property: "og:title", content: "My claims — ASTU Lost & Found" },
      { property: "og:description", content: "Track your ASTU lost and found ownership claims." },
    ],
  }),
  component: MyClaims,
});

function MyClaims() {
  const { data: claims } = useQuery({ queryKey: ["my-claims"], queryFn: () => listMyClaims() });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">My claims</h1>
      <div className="mt-6 space-y-4">
        {(claims ?? []).map((claim) => (
          <article key={claim.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  claim.status === "approved"
                    ? "default"
                    : claim.status === "rejected"
                      ? "destructive"
                      : "outline"
                }
              >
                {claim.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(claim.created_at).toLocaleString()}
              </span>
            </div>
            <h2 className="mt-2 font-semibold">
              {claim.items?.id ? (
                <Link to="/items/$id" params={{ id: claim.items.id }} className="hover:underline">
                  {claim.items.title}
                </Link>
              ) : (
                "Item removed"
              )}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {claim.evidence_text}
            </p>
            {claim.decision_note && (
              <p className="mt-2 rounded-md bg-secondary p-3 text-sm">
                Administrator note: {claim.decision_note}
              </p>
            )}
          </article>
        ))}
        {(claims ?? []).length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            You have not submitted any claim yet.
          </p>
        )}
      </div>
    </main>
  );
}
