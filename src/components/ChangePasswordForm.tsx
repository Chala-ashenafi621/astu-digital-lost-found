import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Password must contain at least one letter and one number.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

/** Signed-in users: re-verifies the current password before changing it. */
export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = passwordProblem(next, confirm);
    if (problem) { toast.error(problem); return; }
    if (next === current) { toast.error("New password must differ from the current one."); return; }
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (verifyError) { toast.error("Current password is incorrect."); return; }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) { toast.error(error.message); return; }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border p-6">
      <h2 className="text-lg font-semibold">Change password</h2>
      <div className="space-y-1.5">
        <Label htmlFor="cur-pw">Current password</Label>
        <Input id="cur-pw" type="password" required maxLength={128} autoComplete="current-password"
          value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-pw">New password</Label>
        <Input id="new-pw" type="password" required maxLength={128} autoComplete="new-password"
          value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-pw">Confirm new password</Label>
        <Input id="confirm-pw" type="password" required maxLength={128} autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy || !email} className="w-full">
        {busy ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
