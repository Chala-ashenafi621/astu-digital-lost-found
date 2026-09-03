import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMe } from "@/lib/auth.functions";
import {
  adminDecideClaim,
  adminListAudit,
  adminListClaims,
  adminListItems,
  adminListUsers,
  adminModerateItem,
  adminSetItemStatus,
  adminSetUserRole,
  adminStats,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — ASTU Lost & Found" },
      { name: "description", content: "Moderation, claim decisions, statistics and audit trail." },
      { property: "og:title", content: "Admin dashboard — ASTU Lost & Found" },
      { property: "og:description", content: "Administer the ASTU lost and found register." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });

  if (isLoading) return <p className="p-10 text-center text-muted-foreground">Loading…</p>;
  if (!me?.isAdmin) {
    return (
      <p className="p-10 text-center text-muted-foreground">
        This area is restricted to administrators.
      </p>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="items">Reports</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview />
        </TabsContent>
        <TabsContent value="claims">
          <Claims />
        </TabsContent>
        <TabsContent value="items">
          <Items />
        </TabsContent>
        <TabsContent value="users">
          <Users />
        </TabsContent>
        <TabsContent value="audit">
          <Audit />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Overview() {
  const { data } = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminStats() });
  const cards = [
    ["Reports", data?.items],
    ["Lost", data?.lost],
    ["Found", data?.found],
    ["Resolved", data?.resolved],
    ["Pending claims", data?.pendingClaims],
    ["Approved claims", data?.approvedClaims],
    ["Rejected claims", data?.rejectedClaims],
    ["Registered users", data?.users],
  ] as const;

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold">{value ?? 0}</p>
        </div>
      ))}
    </div>
  );
}

function Claims() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data } = useQuery({ queryKey: ["admin-claims"], queryFn: () => adminListClaims({ data: {} }) });

  const decide = useMutation({
    mutationFn: (input: { claimId: string; decision: "approved" | "rejected"; note?: string }) =>
      adminDecideClaim({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Decision recorded and the student was notified.");
      void queryClient.invalidateQueries();
    },
  });

  return (
    <div className="mt-6 space-y-4">
      {(data ?? []).map((claim: any) => (
        <article key={claim.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{claim.status}</Badge>
            <span className="text-sm font-medium">{claim.items?.title}</span>
            <span className="text-xs text-muted-foreground">
              by {claim.profiles?.full_name} ({claim.profiles?.email})
            </span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm">{claim.evidence_text}</p>
          {claim.evidence?.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-3">
              {claim.evidence.map((file: any) => (
                <li key={file.id}>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline"
                  >
                    View private evidence
                  </a>
                </li>
              ))}
            </ul>
          )}
          {claim.status === "pending" ? (
            <div className="mt-3 space-y-2">
              <Textarea
                rows={2}
                maxLength={1000}
                placeholder="Decision note (shared with the student)"
                value={notes[claim.id] ?? ""}
                onChange={(event) =>
                  setNotes((prev) => ({ ...prev, [claim.id]: event.target.value }))
                }
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    decide.mutate({
                      claimId: claim.id,
                      decision: "approved",
                      note: notes[claim.id] || undefined,
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    decide.mutate({
                      claimId: claim.id,
                      decision: "rejected",
                      note: notes[claim.id] || undefined,
                    })
                  }
                >
                  Reject
                </Button>
              </div>
            </div>
          ) : (
            claim.decision_note && (
              <p className="mt-2 rounded-md bg-secondary p-2 text-sm">{claim.decision_note}</p>
            )
          )}
        </article>
      ))}
      {(data ?? []).length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No claims submitted yet.
        </p>
      )}
    </div>
  );
}

function Items() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-items"], queryFn: () => adminListItems({ data: {} }) });

  const moderate = useMutation({
    mutationFn: (input: {
      itemId: string;
      moderation: "pending" | "approved" | "rejected";
      remove?: boolean;
    }) => adminModerateItem({ data: input }),
    onSuccess: () => {
      toast.success("Report updated.");
      void queryClient.invalidateQueries();
    },
  });

  const setStatus = useMutation({
    mutationFn: (input: { itemId: string; status: "open" | "claimed" | "resolved" }) =>
      adminSetItemStatus({ data: input }),
    onSuccess: () => {
      toast.success("Status updated.");
      void queryClient.invalidateQueries();
    },
  });

  return (
    <div className="mt-6 space-y-3">
      {(data ?? []).map((item: any) => (
        <article
          key={item.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="min-w-52 flex-1">
            <p className="font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">
              {item.type} · {item.location} · {item.profiles?.email}
            </p>
          </div>
          <Badge variant="secondary">{item.moderation}</Badge>
          {item.is_removed && <Badge variant="destructive">hidden</Badge>}
          <select
            value={item.status}
            onChange={(event) =>
              setStatus.mutate({
                itemId: item.id,
                status: event.target.value as "open" | "claimed" | "resolved",
              })
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Status"
          >
            <option value="open">open</option>
            <option value="claimed">claimed</option>
            <option value="resolved">resolved</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => moderate.mutate({ itemId: item.id, moderation: "approved", remove: false })}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => moderate.mutate({ itemId: item.id, moderation: "rejected", remove: true })}
          >
            Remove
          </Button>
        </article>
      ))}
    </div>
  );
}

function Users() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: () => adminListUsers() });
  const setRole = useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "student"; grant: boolean }) =>
      adminSetUserRole({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Role updated.");
        void queryClient.invalidateQueries();
      }
    },
  });

  return (
    <div className="mt-6 space-y-2">
      {(data ?? []).map((user) => {
        const isAdmin = user.roles.includes("admin");
        return (
          <div
            key={user.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex-1">
              <p className="font-medium">{user.full_name || "(no name)"}</p>
              <p className="text-xs text-muted-foreground">
                {user.email} · {user.department ?? "—"}
              </p>
            </div>
            <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "admin" : "student"}</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRole.mutate({ userId: user.id, role: "admin", grant: !isAdmin })}
            >
              {isAdmin ? "Revoke admin" : "Make admin"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function Audit() {
  const { data } = useQuery({ queryKey: ["admin-audit"], queryFn: () => adminListAudit() });
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left">
          <tr>
            <th className="p-3">When</th>
            <th className="p-3">Action</th>
            <th className="p-3">Entity</th>
            <th className="p-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="p-3 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
              <td className="p-3 font-medium">{row.action}</td>
              <td className="p-3">
                {row.entity_type} {row.entity_id?.slice(0, 8)}
              </td>
              <td className="p-3 text-muted-foreground">{JSON.stringify(row.metadata)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
