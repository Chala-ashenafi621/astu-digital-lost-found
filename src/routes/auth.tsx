import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { registerStudent } from "@/lib/auth.functions";
import { isAstuEmail } from "@/lib/constants";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ASTU Digital Lost & Found" },
      {
        name: "description",
        content:
          "Sign in or register with your ASTU university email to report lost items and submit ownership claims.",
      },
      { property: "og:title", content: "Sign in — ASTU Digital Lost & Found" },
      {
        property: "og:description",
        content: "Access the ASTU lost and found system with your university email address.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useSession();

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-14">
      <h1 className="text-2xl font-bold tracking-tight">ASTU Lost &amp; Found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Accounts are restricted to Adama Science and Technology University email addresses
        (@astu.edu.et). The domain check runs on the server, so it cannot be bypassed.
      </p>

      <Tabs defaultValue="signin" className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
        <TabsContent value="signin">
          <SignInForm />
        </TabsContent>
        <TabsContent value="register">
          <RegisterForm />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error("Invalid email or password.");
      return;
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-border p-5">
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">University email</Label>
        <Input
          id="signin-email"
          type="email"
          required
          maxLength={255}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@astu.edu.et"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          required
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm">
        <Link to="/forgot-password" className="underline">Forgot password?</Link>
      </p>
    </form>
  );
}

function RegisterForm() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    department: "",
    phone: "",
  });
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isAstuEmail(form.email)) {
      toast.error("Please use your @astu.edu.et email address.");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await registerStudent({
        data: {
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          department: form.department.trim() || undefined,
          phone: form.phone.trim() || undefined,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (error) {
        toast.success("Account created. Please sign in.");
        return;
      }
      toast.success("Welcome to ASTU Lost & Found.");
      window.location.href = "/dashboard";
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-border p-5">
      <div className="space-y-1.5">
        <Label htmlFor="reg-name">Full name</Label>
        <Input id="reg-name" required maxLength={100} value={form.fullName} onChange={update("fullName")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-email">University email</Label>
        <Input
          id="reg-email"
          type="email"
          required
          maxLength={255}
          value={form.email}
          onChange={update("email")}
          placeholder="name@astu.edu.et"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-dept">Department (optional)</Label>
        <Input id="reg-dept" maxLength={100} value={form.department} onChange={update("department")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-phone">Phone (optional, kept private)</Label>
        <Input id="reg-phone" maxLength={30} value={form.phone} onChange={update("phone")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-password">Password</Label>
        <Input
          id="reg-password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          value={form.password}
          onChange={update("password")}
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
