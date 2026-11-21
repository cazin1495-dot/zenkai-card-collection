import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { InspectableCard } from "@/components/Transcendance";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Recycle } from "lucide-react";
import { recycleValue } from "@/lib/economy";
import { cardsQuery, collectionQuery } from "@/lib/queries";
import { inPack, type Card, type PackId } from "@/lib/cards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/collection")({
  head: () => ({
    meta: [
      { title: "Ma Collection — Zenkai" },
      { name: "description", content: "Tes classeurs de cartes anime par saga, avec ta progression." },
      { property: "og:title", content: "Ma Collection — Zenkai" },
      { property: "og:description", content: "Tes classeurs de cartes anime par saga, avec ta progression." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollectionPage,
});

type Filter = "all" | PackId;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "shonen", label: "Shonen" },
  { id: "seinen", label: "Seinen" },
  { id: "shojo", label: "Shojo" },
  { id: "sport", label: "Sport" },
  { id: "protagoniste", label: "Protagonistes" },
  { id: "antagoniste", label: "Antagonistes" },
];

type Owned = { count: number; transcendedCount: number; pendingCopy: string | null };

function CollectionPage() {
  const { userId } = Route.useRouteContext();
  const cards = useQuery(cardsQuery);
  const owned = useQuery(collectionQuery(userId));
  const queryClient = useQueryClient();
  const [recycling, setRecycling] = useState<string | null>(null);
  async function recycle(card: Card, transcended = false) {
    const copy = owned.data?.find(row => row.card_id === card.id && row.transcended === transcended);
    if (!copy || recycling) return;
    const value = recycleValue(transcended ? "transcendance" : card.rarity, card.popularity ?? 1);
    if (!window.confirm(`Recycler un doublon de ${card.name} pour ${value} Coins ?`)) return;
    setRecycling(copy.id);
    try {
      const { data, error } = await supabase.rpc("recycle_copy", { _copy: copy.id });
      if (error) throw error;
      toast.success(`Doublon recyclé · +${data} Coins`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["collection", userId] }), queryClient.invalidateQueries({ queryKey: ["game", userId] })]);
    } catch { toast.error("Recyclage impossible. Le dernier exemplaire est protégé."); }
    finally { setRecycling(null); }
  }
  const [filter, setFilter] = useState<Filter>("all");

  const byCard = useMemo(() => {
    const m = new Map<string, Owned>();
    const rarity = new Map((cards.data ?? []).map((c) => [c.id, c.rarity]));
    owned.data?.forEach((row) => {
      const o = m.get(row.card_id) ?? { count: 0, transcendedCount: 0, pendingCopy: null };
      o.count++;
      if (row.transcended) o.transcendedCount++;
      if (!o.pendingCopy && rarity.get(row.card_id) === "mythique" && !row.awaken_attempted) o.pendingCopy = row.id;
      m.set(row.card_id, o);
    });
    return m;
  }, [owned.data, cards.data]);

  const list = (cards.data ?? []).filter((c) => filter === "all" || inPack(c, filter));
  const binders = useMemo(() => {
    const g = new Map<string, Card[]>();
    list.forEach((c) => {
      const k = c.series ?? "Autres";
      g.set(k, [...(g.get(k) ?? []), c]);
    });
    return [...g.entries()];
  }, [list]);

  const ownedInView = list.filter((c) => byCard.has(c.id)).length;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-black sm:text-4xl">Ma Collection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ownedInView} / {list.length} personnages · {owned.data?.length ?? 0} cartes au total
          </p>
        </div>
        <Progress value={ownedInView} total={list.length} className="max-w-20 sm:max-w-xs" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button variant="ghost"
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-auto rounded-md border border-border px-3 py-2 text-xs font-semibold transition-colors",
              filter === f.id ? "bg-surface-raised text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {owned.data && owned.data.length === 0 && (
        <div className="mt-10 rounded-2xl border border-border bg-surface/60 p-8 text-center">
          <p className="font-display text-lg font-bold">Ta collection est vide</p>
          <p className="mt-1 text-sm text-muted-foreground">Ouvre ton premier booster pour obtenir 5 cartes.</p>
          <Button variant="hero" className="mt-5 rounded-full" asChild>
            <Link to="/">Ouvrir un booster</Link>
          </Button>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-10">
        {binders.map(([series, items]) => {
          const got = items.filter((c) => byCard.has(c.id)).length;
          return (
            <section key={series} className="border-t border-border py-6">
              <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
                <h2 className="text-xl font-black">{series}</h2>
                <div className="flex w-24 shrink-0 items-center gap-3 sm:w-full sm:max-w-xs">
                  <Progress value={got} total={items.length} />
                  <span className="shrink-0 text-xs text-muted-foreground">{got} / {items.length}</span>
                </div>
              </div>
               <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {items.map((card) => {
                  const o = byCard.get(card.id);
                  return (
                    <div key={card.id} className="flex flex-col items-center gap-2">
                       {(!o || o.count > o.transcendedCount) && <InspectableCard card={card} count={o ? o.count - o.transcendedCount : undefined} locked={!o} />}
                      {o && o.count - o.transcendedCount > 1 && <Button variant="glass" size="sm" disabled={!!recycling} onClick={() => recycle(card)} className="h-auto w-full whitespace-normal text-[10px]"><Recycle className="size-3" /> Recycler · +{recycleValue(card.rarity, card.popularity ?? 1)} Coins</Button>}
                       {!!o?.transcendedCount && <InspectableCard card={card} count={o.transcendedCount} transcended />}
                       {o && o.transcendedCount > 1 && <Button variant="glass" size="sm" disabled={!!recycling} onClick={() => recycle(card, true)} className="h-auto w-full whitespace-normal text-[10px]"><Recycle className="size-3" /> Recycler · +{recycleValue("transcendance", card.popularity ?? 1)} Coins</Button>}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Progress({ value, total, className }: { value: number; total: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full bg-gradient-primary transition-all" style={{ width: total ? `${(value / total) * 100}%` : "0%" }} />
    </div>
  );
}
