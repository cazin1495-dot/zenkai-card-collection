import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCardMarketPrice, isTranscendanceCatalogCard, type Card } from "@/lib/cards";
import { getGuestCollection, getGuestState, type GuestOwnedRow } from "@/lib/guest-collection";
import { AUCTION_DURATIONS, AUCTION_PRICE_SUGGESTIONS, initializeGuestMarket, listGuestCopy, type MarketListing } from "@/lib/guest-market";

type Props = {
  cards: Card[];
  copies: GuestOwnedRow[];
  initialCopyId?: string;
  initialKind?: "fixed" | "auction";
  onClose: () => void;
  onPublished: (listing: MarketListing) => void;
};

function sameForm(a: GuestOwnedRow, b: GuestOwnedRow) {
  return a.card_id === b.card_id &&
    (a.transcended || !!a.customTranscendance) === (b.transcended || !!b.customTranscendance);
}

export function MarketSaleDialog({
  cards,
  copies,
  initialCopyId = "",
  initialKind = "fixed",
  onClose,
  onPublished,
}: Props) {
  const queryClient = useQueryClient();
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const selectable = copies.filter((copy) => byId.has(copy.card_id));
  function suggestedPrices(id: string, mode: "fixed" | "auction") {
    const copy = selectable.find((item) => item.id === id);
    const card = copy ? byId.get(copy.card_id) : undefined;
    if (!card || !copy) return { price: "", buyout: "" };
    const rarity = copy.transcended || copy.customTranscendance || isTranscendanceCatalogCard(card)
      ? "transcendance" : card.rarity;
    const suggestion = AUCTION_PRICE_SUGGESTIONS[rarity];
    return {
      price: String(mode === "auction" ? suggestion.start : getCardMarketPrice({ ...card, rarity })),
      buyout: String(suggestion.buyout),
    };
  }
  const [copyId, setCopyId] = useState(initialCopyId);
  const [kind, setKind] = useState<"fixed" | "auction">(initialKind);
  const [price, setPrice] = useState(() => suggestedPrices(initialCopyId, initialKind).price);
  const [buyoutPrice, setBuyoutPrice] = useState(() => suggestedPrices(initialCopyId, initialKind).buyout);
  const [duration, setDuration] = useState("1440");
  const selected = selectable.find((copy) => copy.id === copyId);
  const last = selected && copies.filter((copy) => sameForm(copy, selected)).length === 1;

  function publish() {
    try {
      const current = getGuestCollection();
      const copy = current.find((item) => item.id === copyId);
      const card = copy ? byId.get(copy.card_id) : undefined;
      if (!copy || !card) throw new Error("Cette copie n'est plus disponible.");
      const amount = Number(price);
      if (!Number.isSafeInteger(amount) || amount <= 0)
        throw new Error("Le prix doit être un nombre entier positif.");
      const buyout = kind === "auction" && buyoutPrice.trim() !== "" ? Number(buyoutPrice) : null;
      if (buyout !== null && (!Number.isSafeInteger(buyout) || buyout <= amount))
        throw new Error("Le prix d'achat immédiat doit être un entier supérieur au prix de départ.");
      const isLast = current.filter((item) => sameForm(item, copy)).length === 1;
      if (
        isLast &&
        !window.confirm(`C'est ton dernier exemplaire de ${card.name}. Le mettre en vente ?`)
      )
        return;
      if (getGuestState().market === undefined) initializeGuestMarket(cards);
      const listing = listGuestCopy(copy.id, card, kind, amount, Number(duration), Date.now(), buyout);
      void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
      onClose();
      onPublished(listing);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Publication impossible.");
      void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
    }
  }

  const selectedCard = selected ? byId.get(selected.card_id) : undefined;
  const sellableCount = selected ? selectable.filter((item) => item.card_id === selected.card_id).length : 0;
  const recommendedPrice = selected ? suggestedPrices(selected.id, kind).price : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-[#14171f] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Mettre en vente</DialogTitle>
          <DialogDescription className="text-sm text-zinc-400">
            Choisissez votre personnage, votre mode de vente et le prix en Zen.
          </DialogDescription>
        </DialogHeader>

        {selected && selectedCard && (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <img
              src={selectedCard.image_url}
              alt={selectedCard.name}
              className="h-20 w-14 rounded-lg object-cover shadow"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold text-white">{selectedCard.name}</div>
              <div className="text-xs font-semibold text-amber-400">
                {selectedCard.rarity} · {sellableCount} copie{sellableCount > 1 ? "s" : ""} vendable{sellableCount > 1 ? "s" : ""}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Prix conseillé : <span className="font-semibold text-amber-300">{recommendedPrice} Zen</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor="market-copy" className="mb-1 block text-xs font-medium text-zinc-400">
              Personnage à vendre
            </label>
            <select
              id="market-copy"
              value={copyId}
              onChange={(event) => {
                setCopyId(event.target.value);
                const suggested = suggestedPrices(event.target.value, kind);
                setPrice(suggested.price);
                setBuyoutPrice(suggested.buyoutPrice);
              }}
              className="w-full rounded-xl border border-white/10 bg-[#1b1f2a] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500"
            >
              {selectable.map((copy) => {
                const c = byId.get(copy.card_id);
                const count = selectable.filter((item) => item.card_id === copy.card_id).length;
                return (
                  <option key={copy.id} value={copy.id}>
                    {c?.name ?? "Carte"} · {c?.rarity ?? ""} {count > 1 ? `(x${count})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setKind("fixed");
                if (copyId) setPrice(suggestedPrices(copyId, "fixed").price);
              }}
              className={`rounded-xl border py-2 text-sm font-semibold transition ${
                kind === "fixed"
                  ? "border-amber-500 bg-amber-500/20 text-amber-300"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
              }`}
            >
              Prix fixe
            </button>
            <button
              type="button"
              onClick={() => {
                setKind("auction");
                if (copyId) {
                  const s = suggestedPrices(copyId, "auction");
                  setPrice(s.price);
                  setBuyoutPrice(s.buyoutPrice);
                }
              }}
              className={`rounded-xl border py-2 text-sm font-semibold transition ${
                kind === "auction"
                  ? "border-amber-500 bg-amber-500/20 text-amber-300"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
              }`}
            >
              Enchère
            </button>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
              <span>{kind === "fixed" ? "Prix de vente (Zen)" : "Prix de départ (Zen)"}</span>
              {recommendedPrice > 0 && (
                <button
                  type="button"
                  onClick={() => setPrice(String(recommendedPrice))}
                  className="font-medium text-amber-400 hover:underline"
                >
                  Appliquer {recommendedPrice} Zen
                </button>
              )}
            </div>
            <input
              type="number"
              min={1}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Ex. 250"
              className="w-full rounded-xl border border-white/10 bg-[#1b1f2a] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>

          {kind === "auction" && (
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Achat immédiat (optionnel)</label>
              <input
                type="number"
                min={1}
                value={buyoutPrice}
                onChange={(event) => setBuyoutPrice(event.target.value)}
                placeholder="Ex. 500"
                className="w-full rounded-xl border border-white/10 bg-[#1b1f2a] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div>
            <span className="mb-1 block text-xs text-zinc-400">Durée de l'annonce</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "720", label: "12 h" },
                { value: "1440", label: "24 h" },
                { value: "2880", label: "48 h" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`rounded-xl border py-2 text-sm font-semibold transition ${
                    duration === opt.value
                      ? "border-amber-500 bg-amber-500/20 text-amber-300"
                      : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {last && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Attention : il s'agit de votre dernier exemplaire de ce personnage.
            </p>
          )}
        </div>

        <Button
          variant="hero"
          className="mt-2 w-full py-5 text-base font-bold"
          disabled={!selected || !price}
          onClick={publish}
        >
          Mettre en vente
        </Button>
      </DialogContent>
    </Dialog>
  );
}
