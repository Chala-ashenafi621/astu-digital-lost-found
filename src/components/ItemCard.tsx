import { Link } from "@tanstack/react-router";
import { ImageOff, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PublicItem } from "@/lib/items.functions";

export function ItemCard({ item }: { item: PublicItem }) {
  return (
    <Link
      to="/items/$id"
      params={{ id: item.id }}
      className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-secondary">
        {item.images[0] ? (
          <img
            src={item.images[0]}
            alt={item.title}
            loading="lazy"
            suppressHydrationWarning
            className="size-full object-cover transition group-hover:scale-105"
          />

        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <Badge variant={item.type === "lost" ? "destructive" : "default"}>
            {item.type === "lost" ? "Lost" : "Found"}
          </Badge>
          <Badge variant="secondary">{item.category.replace("-", " ")}</Badge>
          {item.status !== "open" && <Badge variant="outline">{item.status}</Badge>}
        </div>
        <h3 className="line-clamp-1 font-semibold">{item.title}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" /> {item.location} · {item.occurred_on}
        </p>
      </div>
    </Link>
  );
}
