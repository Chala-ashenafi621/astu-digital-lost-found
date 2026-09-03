import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — ASTU Lost & Found" },
      { name: "description", content: "In-app updates about your reports and ownership claims." },
      { property: "og:title", content: "Notifications — ASTU Lost & Found" },
      { property: "og:description", content: "Updates about your ASTU reports and claims." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => listMyNotifications() });

  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <Button variant="outline" size="sm" onClick={() => readAll.mutate()}>
          Mark all read
        </Button>
      </div>
      <ul className="mt-6 space-y-3">
        {(data ?? []).map((item) => (
          <li
            key={item.id}
            className={`rounded-xl border p-4 ${
              item.read_at ? "border-border bg-card" : "border-primary/40 bg-primary/5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              {!item.read_at && (
                <Button variant="ghost" size="sm" onClick={() => readOne.mutate(item.id)}>
                  Mark read
                </Button>
              )}
            </div>
          </li>
        ))}
        {(data ?? []).length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            Nothing here yet.
          </p>
        )}
      </ul>
    </main>
  );
}
