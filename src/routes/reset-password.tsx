import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { passwordProblem } from "@/components/ChangePasswordForm";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — ASTU Lost & Found" },
      { name: "description", content: "Choose a new password for your ASTU Lost & Found account." },
      { property: "og:title", content: "Reset password — ASTU Lost & Found" },
      { property: "og:description", content: "Choose a new password for your ASTU Lost & Found account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    const hasRecoveryToken = /type=recovery/.test(window.location.hash + window.location.search);
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setReady((prev) => prev ?? (hasRecoveryToken && !!data.session));
    }, 1200);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = passwordProblem(password, confirm);
    if (problem) return toast.error(problem);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    await supabase.auth.signOut();
    toast.success("Password updated. Please sign in with your new password.");
    navigate({ to: "/auth" });
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      {ready === null && <p className="mt-4 text-sm text-muted-foreground">Checking reset link…</p>}
      {ready === false && (
        <p className="mt-4 text-sm">
          This reset link is invalid or has expired.{" "}
          <Link to="/forgot-password" className="underline">Request a new one</Link>.
        </p>
      )}
      {ready && (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-border p-5">
          <div className="space-y-1.5">
            <Label htmlFor="rp-new">New password</Label>
            <Input id="rp-new" type="password" required maxLength={128} autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-confirm">Confirm new password</Label>
            <Input id="rp-confirm" type="password" required maxLength={128} autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Set new password"}
          </Button>
        </form>
      )}
    </main>
  );
}
