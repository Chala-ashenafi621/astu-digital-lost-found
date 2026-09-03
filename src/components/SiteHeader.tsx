import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Search, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { getMe } from "@/lib/auth.functions";
import { listMyNotifications } from "@/lib/notifications.functions";

export function SiteHeader() {
  const { session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me", session?.user.id],
    queryFn: () => getMe(),
    enabled: Boolean(session),
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications", session?.user.id],
    queryFn: () => listMyNotifications(),
    enabled: Boolean(session),
    refetchInterval: 60_000,
  });

  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Search className="size-4" />
          </span>
          <span className="hidden sm:inline">ASTU Lost &amp; Found</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link to="/" className="rounded-md px-3 py-2 hover:bg-secondary">
            Browse
          </Link>
          {session ? (
            <>
              <Link to="/dashboard" className="rounded-md px-3 py-2 hover:bg-secondary">
                Dashboard
              </Link>
              <Link to="/report" className="rounded-md px-3 py-2 hover:bg-secondary">
                Report
              </Link>
              {me?.isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1 rounded-md px-3 py-2 text-primary hover:bg-secondary"
                >
                  <Shield className="size-4" /> Admin
                </Link>
              )}
              <Link
                to="/notifications"
                className="relative rounded-md px-3 py-2 hover:bg-secondary"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </Link>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
              Sign in
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
