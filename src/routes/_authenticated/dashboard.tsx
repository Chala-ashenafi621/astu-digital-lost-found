import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, FileText, PlusCircle, ShieldCheck, UserCog } from "lucide-react";

import { getMe } from "@/lib/auth.functions";
import { listMyItems } from "@/lib/items.functions";
import { listMyClaims } from "@/lib/claims.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — ASTU Lost & Found" },
      { name: "description", content: "Your reports, claims and account activity in one place." },
      { property: "og:title", content: "Your dashboard — ASTU Lost & Found" },
      { property: "og:description", content: "Track your ASTU lost and found reports and claims." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const { data: items } = useQuery({ queryKey: ["my-items"], queryFn: () => listMyItems() });
  const { data: claims } = useQuery({ queryKey: ["my-claims"], queryFn: () => listMyClaims() });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">
        Welcome{me?.profile?.full_name ? `, ${me.profile.full_name}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {me?.isAdmin ? "Administrator account" : "Student account"} · {me?.profile?.email}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="My reports" value={items?.length ?? 0} />
        <Stat label="My claims" value={claims?.length ?? 0} />
        <Stat
          label="Pending decisions"
          value={(claims ?? []).filter((c) => c.status === "pending").length}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Tile to="/report" icon={<PlusCircle className="size-5" />} title="Report an item">
          Post a lost or found item with photos.
        </Tile>
        <Tile to="/my-items" icon={<FileText className="size-5" />} title="My reports">
          Review claims, update status or remove a report.
        </Tile>
        <Tile to="/my-claims" icon={<ShieldCheck className="size-5" />} title="My claims">
          Track the review of claims you submitted.
        </Tile>
        <Tile to="/notifications" icon={<Bell className="size-5" />} title="Notifications">
          Decisions and updates about your activity.
        </Tile>
        <Tile to="/profile" icon={<UserCog className="size-5" />} title="Profile">
          Update your name, department and private contact details.
        </Tile>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function Tile({
  to,
  icon,
  title,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex gap-3 rounded-xl border border-border bg-card p-5 transition hover:shadow-md"
    >
      <span className="text-primary">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{children}</span>
      </span>
    </Link>
  );
}
