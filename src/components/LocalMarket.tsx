import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, Gem, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarketSaleDialog } from "@/components/MarketSaleDialog";
import { cardsQuery } from "@/lib/queries";
import { getCardMarketPrice, getCardPopularityFactor, RARITY } from "@/lib/cards";
import { getGuestCollection, getGuestState } from "@/lib/guest-collection";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "@/lib/transcendance-cards";
import {
  bidOnGuestListing,
  buyGuestListing,
  cancelGuestListing,
  getGuestMarket,
  initializeGuestMarket,
  restockGuestMarket,
  settleGuestMarket,
  type MarketListing,
} from "@/lib/guest-market";

type MarketSnapshot = ReturnType<typeof getGuestMarket>;

function countdown(endAt: number, now: number) {
  const seconds = Math.max(0, Math.ceil((endAt - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function LocalMarket() {
  const queryClient = useQueryClient();
  const cards = useQuery(cardsQuery);
  const owned = useQuery({ queryKey: ["guest-collection"], queryFn: getGuestCollection });
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<"fixed" | "auction">(() =>
    typeof window !== "undefined" && window.location.hash === "#encheres" ? "auction" : "fixed",
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bids, setBids] = useState<Record<string, string>>({});
  const catalog = useMemo(
    () => [...(cards.data ?? []), ...CUSTOM_TRANSCENDANCE_CARDS.map(customTranscendanceAsCard)],
    [cards.data],
  );
  const byId = useMemo(() => new Map(catalog.map((card) => [card.id, card])), [catalog]);

  const refresh = useCallback(() => {
    try {
      setSnapshot(getGuestMarket());
      setError(null);
    } catch (reason) {
      setSnapshot(null);
      setError(reason instanceof Error ? reason.message : "Marché local indisponible.");
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!cards.data?.length) return;
    try {
      if (getGuestState().market === undefined) initializeGuestMarket(cards.data);
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Marché local indisponible.");
    }
  }, [cards.data, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const onUpdate = () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
    };
    window.addEventListener("zenkai:guest-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("zenkai:guest-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [queryClient, refresh]);

  useEffect(() => {
    const due = snapshot?.listings.some(
      (item) =>
        (item.endAt !== null && now >= item.endAt) ||
        (item.seller === "guest" && item.npcAt !== null && now >= item.npcAt),
    );
    if (!due || error) return;
    try {
      settleGuestMarket(now).forEach((message) => toast.success(message));
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Clôture du marché impossible.");
    }
  }, [snapshot, now, error, refresh]);

  function run(action: () => void) {
    try {
      action();
      refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Transaction locale impossible.");
      refresh();
    }
  }

  function minimumBid(item: MarketListing) {
    return item.bid === null ? item.price : item.bid + 10;
  }

  function placeBid(item: MarketListing, amount: number) {
    run(() => {
      const result = bidOnGuestListing(item.id, amount);
      setBids((previous) => {
        const next = { ...previous };
        delete next[item.id];
        return next;
      });
      toast.success(
        result.outbid
          ? `Rival fictif : ${result.amount} Zen. Ton offre a été remboursée.`
          : "Enchère placée : Zen réservés.",
      );
    });
  }

  return (
    <section className="mt-8 border-t border-border pt-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Marché local</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Simulation locale sur cet appareil : vendeurs, acheteurs et rivaux fictifs. La collection
            et les Zen locaux sont distincts du compte connecté.
          </p>
        </div>
        <Button
          variant="hero"
          disabled={!snapshot || !!error || owned.isError}
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" /> Mettre une carte en vente
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Les offres sont débitées et réservées jusqu’à la clôture ; un rival fictif peut surenchérir.
        Une vente fictive peut intervenir après 30 secondes. Clôture automatique à l’ouverture du
        marché. Évite les transactions dans plusieurs onglets simultanément.
      </p>
      <p className="mt-3 flex items-center gap-1 text-sm font-bold text-primary">
        <Gem className="size-4" /> {snapshot?.zen ?? "…"} Zen locaux disponibles
      </p>
      {error && (
        <div role="alert" className="mt-3 text-sm text-destructive">
          {error}{" "}
          <Button variant="link" onClick={refresh}>
            Réessayer
          </Button>
        </div>
      )}
      {cards.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Catalogue indisponible.{" "}
          <Button variant="link" onClick={() => cards.refetch()}>
            Réessayer
          </Button>
        </p>
      )}
      {owned.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Collection locale indisponible.
        </p>
      )}

      <div role="group" aria-label="Type de marché" className="mt-5 flex flex-wrap gap-2">
        <Button
          variant={tab === "fixed" ? "hero" : "glass"}
          aria-pressed={tab === "fixed"}
          onClick={() => setTab("fixed")}
        >
          <ShoppingBag className="size-4" /> Achat immédiat
        </Button>
        <Button
          variant={tab === "auction" ? "hero" : "glass"}
          aria-pressed={tab === "auction"}
          onClick={() => setTab("auction")}
        >
          <Gavel className="size-4" /> Enchères en cours
        </Button>
      </div>
      {snapshot && !snapshot.listings.some((item) => item.seller === "npc") && (
        <Button
          className="mt-4"
          variant="glass"
          disabled={!cards.data?.length}
          onClick={() =>
            run(() => {
              restockGuestMarket(cards.data ?? []);
              toast.success("Offres fictives renouvelées.");
            })
          }
        >
          Renouveler les offres fictives
        </Button>
      )}
      {snapshot && snapshot.listings.filter((item) => item.kind === tab).length === 0 && (
        <p className="mt-5 text-sm text-muted-foreground">Aucune annonce dans cet onglet.</p>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {snapshot?.listings
          .filter((item) => item.kind === tab)
          .map((item) => {
            const card = byId.get(item.cardId);
            const minimum = minimumBid(item);
            const expired = item.endAt !== null && now >= item.endAt;
            return (
              <article
                key={item.id}
                className="flex flex-col rounded-xl border border-border bg-surface p-3"
              >
                {card?.image_url && (
                  <img
                    src={card.image_url}
                    alt=""
                    className="aspect-[2.5/3.5] w-full rounded-lg object-cover"
                  />
                )}
                <p className="mt-2 text-sm font-bold">{item.cardName}</p>
                <p className={`text-xs font-semibold ${RARITY[item.rarity].text}`}>
                  {RARITY[item.rarity].label}
                </p>
                {card && <>
                  {getCardPopularityFactor(card) >= 1.4 && <span className="mt-1 self-start rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-400">Populaire 🔥</span>}
                  <p className="mt-1 text-xs text-muted-foreground">Valeur estimée : {getCardMarketPrice({ ...card, rarity: item.rarity }).toLocaleString("fr-FR")} Zen</p>
                </>}
                <p className="mt-1 text-xs text-muted-foreground">{item.sellerName}</p>
                <p className="mt-2 text-sm font-bold text-primary">
                  {item.kind === "fixed" ? `${item.price} Zen` : `Départ : ${item.price} Zen`}
                </p>
                {item.kind === "auction" && item.endAt !== null && (
                  <>
                    <p className="mt-1 text-xs">
                      Enchère :{" "}
                      {item.bid === null
                        ? "aucune"
                        : `${item.bid} Zen · ${item.bidder === "guest" ? "Toi" : "Rival fictif"}`}
                    </p>
                    <p className="mt-1 text-xs text-accent">
                      {expired ? "Terminée" : countdown(item.endAt, now)}
                    </p>
                  </>
                )}
                <div className="mt-auto pt-3">
                  {expired ? (
                    <Button variant="glass" size="sm" className="w-full" disabled={!!error} onClick={() => run(() => settleGuestMarket().forEach((message) => toast.success(message)))}>
                      Clôturer / Réclamer
                    </Button>
                  ) : item.seller === "guest" ? (
                    <Button
                      variant="glass"
                      size="sm"
                      className="w-full"
                      disabled={expired || !!error}
                      onClick={() =>
                        run(() => {
                          cancelGuestListing(item.id);
                          toast.success("Copie rendue à la collection.");
                        })
                      }
                    >
                      Annuler l'annonce
                    </Button>
                  ) : item.kind === "fixed" ? (
                    <Button
                      variant="hero"
                      size="sm"
                      className="w-full"
                      disabled={!!error}
                      onClick={() =>
                        run(() => {
                          buyGuestListing(item.id);
                          toast.success(`${item.cardName} ajoutée à ta collection.`);
                        })
                      }
                    >
                      Acheter
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        variant="hero"
                        size="sm"
                        className="w-full"
                        disabled={expired || !!error}
                        onClick={() => placeBid(item, minimum)}
                      >
                        Enchérir (+10 Zen)
                      </Button>
                      <label className="sr-only" htmlFor={`bid-${item.id}`}>
                        Enchère personnalisée pour {item.cardName}
                      </label>
                      <Input
                        id={`bid-${item.id}`}
                        type="number"
                        min={minimum}
                        step="1"
                        value={bids[item.id] ?? String(minimum)}
                        onChange={(event) =>
                          setBids((previous) => ({ ...previous, [item.id]: event.target.value }))
                        }
                      />
                      <Button
                        variant="glass"
                        size="sm"
                        className="w-full"
                        disabled={expired || !!error}
                        onClick={() => placeBid(item, Number(bids[item.id] ?? minimum))}
                      >
                        Enchérir ce montant
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
      </div>

      {dialogOpen && (
        <MarketSaleDialog
          cards={catalog}
          copies={owned.data ?? []}
          onClose={() => setDialogOpen(false)}
          onPublished={(listing) => {
            setTab(listing.kind);
            toast.success(`${listing.cardName} mise en vente dans le marché fictif.`);
          }}
        />
      )}
    </section>
  );
}
