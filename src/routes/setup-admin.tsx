import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { adminExists, bootstrapFirstAdmin } from "@/lib/auth.functions";

export const Route = createFileRoute("/setup-admin")({
  head: () => ({
    meta: [
      { title: "Administrator setup — ASTU Lost & Found" },
      { name: "description", content: "One-time secure setup of the first system administrator." },
      { property: "og:title", content: "Administrator setup — ASTU Lost & Found" },
      { property: "og:description", content: "One-time administrator setup for ASTU Lost & Found." },
    ],
  }),
  component: SetupAdmin,
});

function SetupAdmin() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, refetch } = useQuery({ queryKey: ["admin-exists"], queryFn: () => adminExists() });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await bootstrapFirstAdmin({ data: { setupCode: code.trim() } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("You are now the administrator.");
      void refetch();
      navigate({ to: "/admin" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-bold tracking-tight">Administrator setup</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The first administrator is created once, by a signed-in ASTU account that supplies the secret
        setup code stored in the backend. After that, this page is permanently disabled and only
        existing administrators can grant the role.
      </p>

      {data?.exists ? (
        <p className="mt-6 rounded-lg border border-border p-6 text-sm">
          An administrator already exists. Setup is closed.
        </p>
      ) : !session ? (
        <Button className="mt-6" onClick={() => navigate({ to: "/auth" })}>
          Sign in first
        </Button>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border p-6">
          <div className="space-y-1.5">
            <Label htmlFor="code">Setup code</Label>
            <Input
              id="code"
              required
              value={code}
              maxLength={200}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Verifying…" : "Become administrator"}
          </Button>
        </form>
      )}
    </main>
  );
}
