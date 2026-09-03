import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";

import { ItemCard } from "@/components/ItemCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { listPublicItems } from "@/lib/items.functions";

const browseQuery = (filters: {
  q?: string;
  type?: "lost" | "found";
  category?: string;
  status?: "open" | "claimed" | "resolved";
}) =>
  queryOptions({
    queryKey: ["public-items", filters],
    queryFn: () => listPublicItems({ data: filters }),
  });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ASTU Digital Lost & Found — Report and recover campus items" },
      {
        name: "description",
        content:
          "Browse and search lost and found items reported across Adama Science and Technology University. Report an item, submit a verified claim, and get it back safely.",
      },
      { property: "og:title", content: "ASTU Digital Lost & Found" },
      {
        property: "og:description",
        content: "Search lost and found items reported across ASTU campus and claim them securely.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(browseQuery({})),
  component: Browse,
});

function Browse() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"lost" | "found" | undefined>();
  const [category, setCategory] = useState<string | undefined>();

  const filters = {
    ...(search ? { q: search } : {}),
    ...(type ? { type } : {}),
    ...(category ? { category } : {}),
  };
  const { data, isFetching } = useQuery(browseQuery(filters));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Lost something on campus? Found something?
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The official Adama Science and Technology University lost &amp; found register. Reports are
          public and safe to browse — the reporter's contact details are never shown. Ownership is
          verified through evidence reviewed by the Student Services administrators.
        </p>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(q.trim().slice(0, 120));
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              maxLength={120}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search by title, description or place…"
              className="pl-9"
              aria-label="Search items"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={!type} onClick={() => setType(undefined)}>
            All
          </FilterChip>
          <FilterChip active={type === "lost"} onClick={() => setType("lost")}>
            Lost
          </FilterChip>
          <FilterChip active={type === "found"} onClick={() => setType("found")}>
            Found
          </FilterChip>
          <span className="mx-2 w-px bg-border" />
          <FilterChip active={!category} onClick={() => setCategory(undefined)}>
            Any category
          </FilterChip>
          {ITEM_CATEGORIES.map((item) => (
            <FilterChip key={item} active={category === item} onClick={() => setCategory(item)}>
              {item.replace("-", " ")}
            </FilterChip>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">
          {isFetching ? "Loading reports…" : `${data?.length ?? 0} reports`}
        </h2>
        {data && data.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            No reports match your search yet.
          </p>
        )}
      </section>
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}
