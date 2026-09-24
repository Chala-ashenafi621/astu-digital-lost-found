import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isAstuEmail } from "@/lib/constants";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — ASTU Lost & Found" },
      { name: "description", content: "Request a password reset link for your ASTU Lost & Found account." },
      { property: "og:title", content: "Forgot password — ASTU Lost & Found" },
      { property: "og:description", content: "Request a password reset link for your ASTU Lost & Found account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isAstuEmail(email)) return toast.error("Please use your @astu.edu.et email address.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    // Same message whether or not the account exists, to avoid revealing registered emails.
    if (error && error.status === 429) return toast.error("Too many requests. Please try again later.");
    setSent(true);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Forgot password</h1>
      {sent ? (
        <p className="mt-4 rounded-xl border border-border p-5 text-sm">
          If an account exists for that email, a reset link has been sent. Open it on this device to
          choose a new password. The link expires after one hour.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-border p-5">
          <div className="space-y-1.5">
            <Label htmlFor="fp-email">University email</Label>
            <Input id="fp-email" type="email" required maxLength={255} value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="name@astu.edu.et" />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link to="/auth" className="underline">Back to sign in</Link>
      </p>
    </main>
  );
}
