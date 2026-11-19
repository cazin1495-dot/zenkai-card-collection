import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/AnimeCard";
import { cardsQuery, collectionQuery } from "@/lib/queries";
import { RARITY, type Rarity } from "@/lib/cards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/collection")({
  head: () => ({
    meta: [
      { title: "Ma Collection — Zenkai" },
      { name: "description", content: "Retrouve toutes les cartes anime que tu as obtenues sur Zenkai." },
      { property: "og:title", content: "Ma Collection — Zenkai" },
      { property: "og:description", content: "Retrouve toutes les cartes anime que tu as obtenues sur Zenkai." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollectionPage,
});

const FILTERS: (Rarity | "all")[] = ["all", "commune", "rare", "epique", "legendaire"];

function CollectionPage() {
  const { userId } = Route.useRouteContext();
  const cards = useQuery(cardsQuery);
  const owned = useQuery(collectionQuery(userId));
  const [filter, setFilter] = useState<Rarity | "all">("all");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    owned.data?.forEach((row) => m.set(row.card_id, (m.get(row.card_id) ?? 0) + 1));
    return m;
  }, [owned.data]);

  const list = (cards.data ?? []).filter((c) => filter === "all" || c.rarity === filter);
  const uniqueOwned = counts.size;
  const total = cards.data?.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black sm:text-4xl">Ma Collection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {uniqueOwned} / {total} personnages · {owned.data?.length ?? 0} cartes au total
          </p>
        </div>
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-primary transition-all"
            style={{ width: total ? `${(uniqueOwned / total) * 100}%` : "0%" }}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border border-border px-4 py-1.5 text-xs font-semibold transition-colors",
              filter === f ? "bg-surface-raised text-foreground" : "text-muted-foreground hover:text-foreground",
              f !== "all" && RARITY[f].text,
            )}
          >
            {f === "all" ? "Toutes" : RARITY[f].label}
          </button>
        ))}
      </div>

      {owned.data && owned.data.length === 0 && (
        <div className="mt-10 rounded-2xl border border-border bg-surface/60 p-8 text-center">
          <p className="font-display text-lg font-bold">Ta collection est vide</p>
          <p className="mt-1 text-sm text-muted-foreground">Ouvre ton premier booster gratuit pour obtenir 3 cartes.</p>
          <Button variant="hero" className="mt-5 rounded-full" asChild>
            <Link to="/">Ouvrir un booster</Link>
          </Button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {list.map((card) => {
          const n = counts.get(card.id) ?? 0;
          return <AnimeCard key={card.id} card={card} count={n} locked={n === 0} />;
        })}
      </div>
    </div>
  );
}
