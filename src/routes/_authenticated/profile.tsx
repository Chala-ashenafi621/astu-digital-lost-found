import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMe, updateProfile } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — ASTU Lost & Found" },
      { name: "description", content: "Update your ASTU profile and private contact details." },
      { property: "og:title", content: "My profile — ASTU Lost & Found" },
      { property: "og:description", content: "Manage your ASTU Lost & Found account details." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [form, setForm] = useState({ fullName: "", department: "", phone: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me?.profile) {
      setForm({
        fullName: me.profile.full_name ?? "",
        department: me.profile.department ?? "",
        phone: me.profile.phone ?? "",
      });
    }
  }, [me]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await updateProfile({ data: form });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Profile saved.");
        void queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">My profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your email, phone and department are private. They are visible only to you and to
        administrators handling a handover — never on public pages.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border p-6">
        <div className="space-y-1.5">
          <Label>University email</Label>
          <Input value={me?.profile?.email ?? ""} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            required
            maxLength={100}
            value={form.fullName}
            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dept">Department</Label>
          <Input
            id="dept"
            maxLength={100}
            value={form.department}
            onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (private)</Label>
          <Input
            id="phone"
            maxLength={30}
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </main>
  );
}
