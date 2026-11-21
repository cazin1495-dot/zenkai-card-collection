import { useState } from "react";
import { Eye, LockKeyhole } from "lucide-react";
import { AnimeCard } from "@/components/AnimeCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { effectiveDropRate, inPack, isTranscendanceCatalogCard, RARITY, RARITY_ORDER, type Card, type PackId, type Rarity } from "@/lib/cards";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard, type CustomTranscendanceCard } from "@/lib/transcendance-cards";

type PreviewEntry = {
  id: string;
  card: Card;
  customTranscendance: boolean;
};

type Props = {
  cards: Card[];
  pack: PackId;
  packLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customCards?: readonly CustomTranscendanceCard[];
};

type RarityFilter = Rarity | "all";

function rateLabel(rarity: Rarity) {
  return `${String(effectiveDropRate(rarity)).replace(".", ",")} %`;
}

export function BoosterPreviewDialog({
  cards,
  pack,
  packLabel,
  open,
  onOpenChange,
  customCards = CUSTOM_TRANSCENDANCE_CARDS,
}: Props) {
  const [filter, setFilter] = useState<RarityFilter>("all");
  const customForPack = customCards.filter((card) => card.pack_ids.includes(pack));
  const entries: PreviewEntry[] = [
    ...cards.filter((card) => !isTranscendanceCatalogCard(card) && inPack(card, pack)).map((card) => ({
      id: card.id,
      card,
      customTranscendance: false,
    })),
    ...customForPack.map((card) => ({
      id: `custom-${card.id}`,
      card: customTranscendanceAsCard(card),
      customTranscendance: true,
    })),
  ].sort((left, right) => {
    const leftRarity = left.customTranscendance ? "transcendance" : left.card.rarity;
    const rightRarity = right.customTranscendance ? "transcendance" : right.card.rarity;
    return RARITY_ORDER.indexOf(leftRarity) - RARITY_ORDER.indexOf(rightRarity);
  });
  const visibleEntries = entries.filter((entry) => (
    filter === "all" || (entry.customTranscendance ? filter === "transcendance" : entry.card.rarity === filter)
  ));
  const showMystery = customForPack.length === 0 && (filter === "all" || filter === "transcendance");
  const filters: RarityFilter[] = ["all", ...RARITY_ORDER];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="glass" size="sm" className="w-52 border-primary/40 bg-surface/90 font-semibold text-foreground shadow-sm">
          <Eye aria-hidden /> Voir les cartes du pack
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle>Contenu du pack {packLabel}</DialogTitle>
          <DialogDescription>Cartes disponibles et taux de drop par carte.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par rareté">
          {filters.map((rarity) => (
            <Button
              key={rarity}
              type="button"
              size="sm"
              variant={filter === rarity ? "hero" : "glass"}
              aria-pressed={filter === rarity}
              onClick={() => setFilter(rarity)}
              className="gap-1.5"
            >
              {rarity === "all" ? "Toutes" : (
                <>
                  {RARITY[rarity].label}
                  <span className="text-[10px] opacity-75">{rateLabel(rarity)}</span>
                </>
              )}
            </Button>
          ))}
        </div>

        {visibleEntries.length === 0 && !showMystery ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucune carte de cette rareté dans ce pack.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {showMystery && <MysteryCard />}
            {visibleEntries.map((entry) => {
              const rarity = entry.customTranscendance ? "transcendance" : entry.card.rarity;
              return (
                <article key={entry.id} className="mx-auto flex w-full max-w-44 flex-col items-center gap-2">
                  <AnimeCard card={entry.card} customTranscendance={entry.customTranscendance} compact />
                  <p className="w-full text-center text-[10px] font-semibold text-muted-foreground">
                    {RARITY[rarity].label} · {rateLabel(rarity)}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MysteryCard() {
  return (
    <article
      aria-label="??? — Carte Transcendance Exclusive à venir"
      className="mx-auto flex aspect-[2.5/3.5] w-full max-w-44 flex-col items-center justify-center gap-3 rounded-2xl border border-rarity-transcendance/40 bg-gradient-to-br from-rarity-transcendance/10 via-background to-primary/10 p-4 text-center"
    >
      <LockKeyhole aria-hidden className="size-5 text-rarity-transcendance" />
      <span className="font-display text-3xl font-black tracking-[0.3em] text-foreground/80">???</span>
      <span className="text-[10px] font-semibold leading-relaxed text-muted-foreground">
        Carte Transcendance Exclusive à venir
      </span>
      <span className="text-[10px] font-bold text-rarity-transcendance">{rateLabel("transcendance")}</span>
    </article>
  );
}
