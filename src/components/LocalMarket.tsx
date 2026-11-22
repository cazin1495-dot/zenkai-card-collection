import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, Gem, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarketSaleDialog } from "@/components/MarketSaleDialog";
import { AnimeCard } from "@/components/AnimeCard";
import { cardsQuery } from "@/lib/queries";
import { DEMON_SLAYER_MYTHIC_CARDS, getCardMarketPrice, getCardPopularityFactor, RARITY, subscribeUserRarityOverrides } from "@/lib/cards";
import { getGuestCollection, getGuestState } from "@/lib/guest-collection";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "@/lib/transcendance-cards";
import {
  bidOnGuestListing,
  buyoutGuestAuction,
  buyGuestListing,
  cancelGuestListing,
  auctionCountdown,
  ensureGuestAuctions,
  getGuestMarket,
  initializeGuestMarket,
  minimumAuctionBid,
  restockGuestMarket,
  settleGuestMarket,
  type MarketListing,
} from "@/lib/guest-market";

type MarketSnapshot = ReturnType<typeof getGuestMarket>;

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
    () => [...(cards.data ?? (cards.isError ? DEMON_SLAYER_MYTHIC_CARDS : [])), ...CUSTOM_TRANSCENDANCE_CARDS.map(customTranscendanceAsCard)],
    [cards.data, cards.isError],
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
    if (!cards.data?.length && !cards.isError) return;
    try {
      if (getGuestState().market === undefined) initializeGuestMarket(cards.data ?? DEMON_SLAYER_MYTHIC_CARDS);
      ensureGuestAuctions(catalog);
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Marché local indisponible.");
    }
  }, [cards.data, cards.isError, catalog, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const onUpdate = () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
    };
    window.addEventListener("zenkai:guest-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    const unsubscribeRarity = subscribeUserRarityOverrides(refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("zenkai:guest-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
      unsubscribeRarity();
    };
  }, [queryClient, refresh]);

  useEffect(() => {
    const due = snapshot?.listings.some(
      (item) =>
        (item.endAt !== null && now >= item.endAt) ||
        (item.rivalAt !== null && now >= item.rivalAt) ||
        (item.seller === "guest" && item.npcAt !== null && now >= item.npcAt),
    );
    if (!due || error) return;
    try {
      settleGuestMarket(now).forEach((message) =>
        message.includes(" a surenchéri sur ") ? toast.info(message) : toast.success(message),
      );
      if (catalog.length) ensureGuestAuctions(catalog, now);
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Clôture du marché impossible.");
    }
  }, [snapshot, now, error, refresh, catalog]);

  useEffect(() => {
    if (!snapshot || error || !catalog.length ||
        snapshot.listings.filter((item) => item.kind === "auction" && item.seller === "npc").length >= 6) return;
    try { ensureGuestAuctions(catalog); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Renouvellement des enchères impossible."); }
  }, [snapshot, error, catalog]);

  function run(action: () => void) {
    try {
      action();
      refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Transaction locale impossible.");
      refresh();
    }
  }

  function placeBid(item: MarketListing, amount: number) {
    run(() => {
      const result = bidOnGuestListing(item.id, amount);
      setBids((previous) => {
        const next = { ...previous };
        delete next[item.id];
        return next;
      });
      toast.success(result.purchased
        ? `Achat immédiat : ${item.cardName} ajoutée à ta collection !`
        : "Enchère placée : Zen réservés.");
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
          <Plus className="size-4" /> {tab === "auction" ? "Créer une enchère" : "Mettre une carte en vente"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Les offres sont débitées et réservées jusqu’à la clôture ; un rival fictif peut surenchérir.
        Une vente fictive peut intervenir après 30 secondes. Les enchères sont réglées pendant que
        le site est ouvert, ou à sa prochaine ouverture. Évite les transactions dans plusieurs onglets simultanément.
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
          Catalogue distant indisponible : seules les cartes intégrées restent disponibles.{" "}
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
          <Gavel className="size-4" /> Enchères
        </Button>
      </div>
      {tab === "fixed" && snapshot && !snapshot.listings.some((item) => item.seller === "npc" && item.kind === "fixed") && (
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
            const canRaise = item.bid === null ||
              Number.isSafeInteger(item.bid + Math.max(50, Math.ceil(item.bid * 0.1)));
            const minimum = item.kind === "auction" && canRaise ? minimumAuctionBid(item) : item.price;
            const expired = item.endAt !== null && now >= item.endAt;
            const countdown = item.endAt === null ? null : auctionCountdown(item.endAt, now);
            return (
              <article
                key={item.id}
                className="flex min-w-0 flex-col rounded-xl border border-amber-400/25 bg-gradient-to-b from-violet-950/50 to-surface p-2 sm:p-3"
              >
                {card && (item.kind === "auction" || item.rarity === "transcendance") ? (
                  <AnimeCard card={card} transcended={item.copy?.transcended} customTranscendance={item.rarity === "transcendance" && !item.copy?.transcended} compact />
                ) : card?.image_url && (
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
                    <p className="mt-1 text-xs">Enchère actuelle : {item.bid === null ? "aucune" : `${item.bid} Zen`}</p>
                    <p className="mt-1 text-xs">{item.bidCount} offre{item.bidCount > 1 ? "s" : ""} · Meilleur enchérisseur :{" "}
                      <span className={item.bidder === "guest" ? "font-bold text-amber-300" : ""}>
                        {item.bidder === "guest" ? "Toi" : item.bidder === "npc" ? item.bidderName ?? "Rival fictif" : "aucun"}
                      </span>
                    </p>
                    <p className={`mt-1 text-xs ${countdown?.urgent ? "font-bold text-amber-400" : "text-muted-foreground"}`}>
                      {countdown?.label}
                    </p>
                    {item.seller === "guest" && item.buyoutPrice !== null && <p className="mt-1 text-xs text-amber-300">Achat immédiat : {item.buyoutPrice.toLocaleString("fr-FR")} Zen</p>}
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
                      disabled={expired || !!error || item.bid !== null}
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
                      {!canRaise && <p role="alert" className="text-xs text-destructive">Montant maximal atteint : impossible de surenchérir.</p>}
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                          variant="hero"
                          size="sm"
                          className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal"
                          disabled={expired || !!error || !canRaise}
                          onClick={() => placeBid(item, minimum)}
                        >
                          Enchérir (+50 Zen / +10 %)
                        </Button>
                        {item.buyoutPrice !== null && <Button
                          variant="glass"
                          size="sm"
                          className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal border-amber-200 bg-amber-400 font-bold text-slate-950 hover:bg-amber-300 hover:text-slate-950"
                          disabled={expired || !!error}
                          onClick={() => run(() => {
                            buyoutGuestAuction(item.id);
                            toast.success(`Achat immédiat : ${item.cardName} ajoutée à ta collection !`);
                          })}
                        >
                          Achat immédiat · {item.buyoutPrice.toLocaleString("fr-FR")} Zen
                        </Button>}
                      </div>
                      <label className="sr-only" htmlFor={`bid-${item.id}`}>
                        Enchère personnalisée pour {item.cardName}
                      </label>
                      <Input
                        id={`bid-${item.id}`}
                        type="number"
                        min={minimum}
                        step="1"
                        disabled={!canRaise}
                        value={bids[item.id] ?? String(minimum)}
                        onChange={(event) =>
                          setBids((previous) => ({ ...previous, [item.id]: event.target.value }))
                        }
                      />
                      <Button
                        variant="glass"
                        size="sm"
                        className="w-full"
                        disabled={expired || !!error || !canRaise}
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
          initialKind={tab}
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
