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
import { getCardMarketPrice, type Card } from "@/lib/cards";
import { getGuestCollection, getGuestState, type GuestOwnedRow } from "@/lib/guest-collection";
import { initializeGuestMarket, listGuestCopy, type MarketListing } from "@/lib/guest-market";

type Props = {
  cards: Card[];
  copies: GuestOwnedRow[];
  initialCopyId?: string;
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
  onClose,
  onPublished,
}: Props) {
  const queryClient = useQueryClient();
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const selectable = copies.filter((copy) => byId.has(copy.card_id));
  function suggestedPrice(id: string) {
    const copy = selectable.find((item) => item.id === id);
    const card = copy ? byId.get(copy.card_id) : undefined;
    return card
      ? String(
          getCardMarketPrice({
            ...card,
            rarity: copy?.transcended || copy?.customTranscendance ? "transcendance" : card.rarity,
          }),
        )
      : "";
  }
  const [copyId, setCopyId] = useState(initialCopyId);
  const [price, setPrice] = useState(() => suggestedPrice(initialCopyId));
  const [kind, setKind] = useState<"fixed" | "auction">("fixed");
  const [duration, setDuration] = useState("2");
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
      const isLast = current.filter((item) => sameForm(item, copy)).length === 1;
      if (
        isLast &&
        !window.confirm(`C'est ton dernier exemplaire de ${card.name}. Le mettre en vente ?`)
      )
        return;
      if (getGuestState().market === undefined) initializeGuestMarket(cards);
      const listing = listGuestCopy(copy.id, card, kind, amount, Number(duration));
      void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
      onClose();
      onPublished(listing);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Publication impossible.");
      void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="rounded-2xl border-primary/40 bg-surface">
        <DialogHeader>
          <DialogTitle>Mettre une carte en vente</DialogTitle>
          <DialogDescription>
            Marché fictif local : la copie sera retirée de ta collection jusqu’à la vente ou
            l’annulation.
          </DialogDescription>
        </DialogHeader>
        <label htmlFor="market-copy" className="text-sm font-semibold">
          Copie de ta collection
        </label>
        <select
          id="market-copy"
          value={copyId}
          onChange={(event) => {
            setCopyId(event.target.value);
            setPrice(suggestedPrice(event.target.value));
          }}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">Choisir une carte</option>
          {selectable.map((copy) => (
            <option key={copy.id} value={copy.id}>
              {byId.get(copy.card_id)?.name}
              {copy.transcended || copy.customTranscendance ? " · Transcendance" : ""} ·{" "}
              {copy.id.slice(-8)}
            </option>
          ))}
        </select>
        {selectable.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Aucune copie disponible dans le catalogue chargé.
          </p>
        )}
        {last && (
          <p role="status" className="text-xs font-semibold text-amber-400">
            Dernier exemplaire : une confirmation sera demandée.
          </p>
        )}
        <label htmlFor="market-kind" className="text-sm font-semibold">
          Mode de vente
        </label>
        <select
          id="market-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value === "auction" ? "auction" : "fixed")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="fixed">Vente directe</option>
          <option value="auction">Enchère</option>
        </select>
        <label htmlFor="market-price" className="text-sm font-semibold">
          {kind === "fixed" ? "Prix" : "Prix de départ"} en Zen
        </label>
        <Input
          id="market-price"
          type="number"
          min="1"
          step="1"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        {kind === "auction" && (
          <>
            <label htmlFor="market-duration" className="text-sm font-semibold">
              Durée
            </label>
            <select
              id="market-duration"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="2">2 min</option>
              <option value="5">5 min</option>
              <option value="15">15 min</option>
            </select>
          </>
        )}
        <Button variant="hero" disabled={!selected || !price} onClick={publish}>
          Publier l’annonce fictive
        </Button>
      </DialogContent>
    </Dialog>
  );
}
