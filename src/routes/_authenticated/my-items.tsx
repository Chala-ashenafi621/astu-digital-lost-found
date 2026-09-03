import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteMyItem, listMyItems, setMyItemStatus } from "@/lib/items.functions";
import { listClaimsOnMyItems } from "@/lib/claims.functions";

export const Route = createFileRoute("/_authenticated/my-items")({
  head: () => ({
    meta: [
      { title: "My reports — ASTU Lost & Found" },
      { name: "description", content: "Manage the lost and found reports you posted at ASTU." },
      { property: "og:title", content: "My reports — ASTU Lost & Found" },
      { property: "og:description", content: "Manage your ASTU lost and found reports." },
    ],
  }),
  component: MyItems;
});

function MyItems() {
  const queryClient = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["my-items"], queryFn: () => listMyItems() });
  const { data: claims } = useQuery({
    queryKey: ["claims-on-my-items"],
    queryFn: () => listClaimsOnMyItems(),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { itemId: string; status: "open" | "claimed" | "resolved" }) =>
      setMyItemStatus({ data: input }),
    onSuccess: () => {
      toast.success("Status updated.");
      void queryClient.invalidateQueries({ queryKey: ["my-items"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteMyItem({ data: { itemId } }),
    onSuccess: () => {
      toast.success("Report deleted.");
      void queryClient.invalidateQueries({ queryKey: ["my-items"] });
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">My reports</h1>

      <div className="mt-6 space-y-4">
        {(items ?? []).map((item) => {
          const itemClaims = (claims ?? []).filter((claim) => claim.item_id === item.id);
          return (
            <article key={item.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={item.type === "lost" ? "destructive" : "default"}>{item.type}</Badge>
                <Badge variant="outline">{item.status}</Badge>
                <Badge variant="secondary">{item.moderation}</Badge>
                {item.is_removed && <Badge variant="destructive">removed by admin</Badge>}
              </div>
              <h2 className="mt-2 font-semibold">{item.title}</h2>
              <p className="text-sm text-muted-foreground">
                {item.location} · {item.occurred_on}
              </p>
              {item.moderation_note && (
                <p className="mt-2 rounded-md bg-secondary p-2 text-sm">
                  Moderator note: {item.moderation_note}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={item.status}
                  onChange={(event) =>
                    statusMutation.mutate({
                      itemId: item.id,
                      status: event.target.value as "open" | "claimed" | "resolved",
                    })
                  }
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  aria-label="Report status"
                >
                  <option value="open">open</option>
                  <option value="claimed">claimed</option>
                  <option value="resolved">resolved</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Delete this report permanently?")) deleteMutation.mutate(item.id);
                  }}
                >
                  Delete
                </Button>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <h3 className="text-sm font-semibold">Claims ({itemClaims.length})</h3>
                {itemClaims.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No claims yet.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {itemClaims.map((claim) => (
                      <li key={claim.id} className="rounded-md bg-secondary p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{claim.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(claim.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-line">{claim.evidence_text}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Only administrators can approve or reject claims.
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
        {(items ?? []).length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            You have not reported anything yet.
          </p>
        )}
      </div>
    </main>
  );
}
