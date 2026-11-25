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
  const selectable = copies.filter((copy) => byId.has(copy.card_id) && !copy.transcended && !copy.customTranscendence && !isTranscendenceCatalogCard(byId.get(copy.card_id)));
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
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const medianPrice = selected ? Number(suggestedPrices(selected.id, "fixed").price) : 0;
  const numericPrice = Math.max(0, Math.floor(Number(price) || 0));
  const listingFee = numericPrice > 0 ? Math.max(10, Math.round(numericPrice * 0.05)) : 20;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-h-[92vh] max-w-md overflow-y-auto border-white/10 bg-[#12151e] p-5 text-white">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-extrabold tracking-tight text-white">Mettre en vente</DialogTitle>
          <DialogDescription className="text-sm text-zinc-400">
            Choisissez le personnage à lister, le mode de vente et le prix en Zen.
          </DialogDescription>
        </DialogHeader>

        {/* Sélecteur de personnage sans aucun code chiffré (uniquement si aucun personnage pré-sélectionné) */}
        {!initialCopyId && (
          <div className="relative">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">
              Personnage sélectionné
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#191d28] px-3.5 py-2.5 text-left text-sm font-semibold text-white transition hover:border-amber-500/60"
            >
              <span className="truncate">
                {selectedCard ? `${selectedCard.name} · ${selectedCard.rarity}` : "Choisir un personnage"}
              </span>
              <span className="ml-2 text-xs text-zinc-400">{pickerOpen ? "▲" : "▼"}</span>
            </button>

            {pickerOpen && (
              <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-[#191d28] p-1 shadow-xl">
                {selectable.map((copy) => {
                  const c = byId.get(copy.card_id);
                  const count = selectable.filter((item) => item.card_id === copy.card_id).length;
                  const active = copy.id === copyId;
                  return (
                    <button
                      key={copy.id}
                      type="button"
                      onClick={() => {
                        setCopyId(copy.id);
                        const suggested = suggestedPrices(copy.id, kind);
                        setPrice(suggested.price);
                        setBuyoutPrice(suggested.buyout);
                        setPickerOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-amber-500/20 font-bold text-amber-300"
                          : "text-zinc-200 hover:bg-white/5"
                      }`}
                    >
                      <span className="truncate">
                        {c?.name ?? "Carte"} · <span className="text-xs text-zinc-400">{c?.rarity ?? ""}</span>
                      </span>
                      {count > 1 && (
                        <span className="ml-2 shrink-0 text-xs text-zinc-400">({count} copies)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Carte aperçu style Kyara : miniature + nom + rareté + copies vendables */}
        {selected && selectedCard && (
          <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-[#181c27] p-3">
            <img loading="lazy" decoding="async"
              src={selectedCard.image_url ?? undefined}
              alt={selectedCard.name}
              className="h-20 w-14 shrink-0 rounded-lg border border-white/10 object-cover shadow-md"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-extrabold text-white">{selectedCard.name}</div>
              <div className="mt-0.5 text-xs font-semibold text-amber-400">
                {selectedCard.rarity} · {sellableCount} copie{sellableCount > 1 ? "s" : ""} vendable{sellableCount > 1 ? "s" : ""}
              </div>
            </div>
          </div>
        )}

        {/* Encart Médiane style Kyara */}
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#181c27] px-3.5 py-2.5">
          <span className="text-xs font-medium text-zinc-400">Médiane</span>
          <button
            type="button"
            onClick={() => medianPrice > 0 && setPrice(String(medianPrice))}
            className="text-sm font-extrabold text-amber-400 hover:underline"
          >
            {medianPrice > 0 ? `${medianPrice} ◆` : "—"}
          </button>
        </div>

        {/* Sélecteur Prix fixe / Enchère style Kyara */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setKind("fixed");
              if (copyId) setPrice(suggestedPrices(copyId, "fixed").price);
            }}
            className={`rounded-xl border py-2.5 text-sm font-bold transition ${
              kind === "fixed"
                ? "border-amber-500/80 bg-amber-500/15 text-amber-300"
                : "border-white/10 bg-[#181c27] text-zinc-400 hover:text-white"
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
                setBuyoutPrice(s.buyout);
              }
            }}
            className={`rounded-xl border py-2.5 text-sm font-bold transition ${
              kind === "auction"
                ? "border-amber-500/80 bg-amber-500/15 text-amber-300"
                : "border-white/10 bg-[#181c27] text-zinc-400 hover:text-white"
            }`}
          >
            Enchère
          </button>
        </div>

        {/* Champ Prix de vente */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            {kind === "fixed" ? "Prix de vente (◆)" : "Mise de départ (◆)"}
          </label>
          <input
            type="number"
            min={1}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="Ex. 525"
            className="w-full rounded-xl border border-white/10 bg-[#191d28] px-3.5 py-2.5 text-base font-bold text-white outline-none focus:border-amber-500"
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            Meilleur ordre d'achat : Aucun ordre d'achat actif
          </p>
        </div>

        {kind === "auction" && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Achat immédiat (optionnel)</label>
            <input
              type="number"
              min={1}
              value={buyoutPrice}
              onChange={(event) => setBuyoutPrice(event.target.value)}
              placeholder="Ex. 900"
              className="w-full rounded-xl border border-white/10 bg-[#191d28] px-3.5 py-2.5 text-sm font-semibold text-white outline-none focus:border-amber-500"
            />
          </div>
        )}

        {/* Durée 12 h / 24 h / 48 h */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">Durée</span>
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
                className={`rounded-xl border py-2 text-sm font-bold transition ${
                  duration === opt.value
                    ? "border-amber-500/80 bg-amber-500/15 text-amber-300"
                    : "border-white/10 bg-[#181c27] text-zinc-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {last && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Attention : dernier exemplaire de ce personnage dans votre collection.
          </p>
        )}

        {/* Gros bouton orange style Kyara */}
        <Button
          variant="hero"
          className="mt-1 w-full rounded-xl py-5 text-sm font-extrabold"
          disabled={!selected || !price}
          onClick={publish}
        >
          Mettre en vente · {listingFee} ◆ de frais
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-zinc-500">
          Les frais sont remboursés si la carte est vendue ; conservés en cas d'annulation ou d'expiration.
        </p>
      </DialogContent>
    </Dialog>
  );
}
