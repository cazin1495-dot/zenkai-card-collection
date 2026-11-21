import { useState } from "react";
import { Eye, Heart, LockKeyhole, Pencil } from "lucide-react";
import { toast } from "sonner";
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
import { CATALOG_RARITIES, effectiveDropRate, inPack, isCatalogRarity, isTranscendanceCatalogCard, normalizeCatalogCard, RARITY, RARITY_ORDER, setUserRarityOverride, type Card, type PackId, type Rarity } from "@/lib/cards";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard, customTranscendanceInPack, type CustomTranscendanceCard } from "@/lib/transcendance-cards";
import { useFavoriteCards } from "@/lib/favorites";
import { cn } from "@/lib/utils";
import { useRarityOverrides } from "@/hooks/use-rarity-overrides";

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

function rateLabel(rarity: Rarity, pack: PackId) {
  return `${String(effectiveDropRate(rarity, pack)).replace(".", ",")} %`;
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
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editing, setEditing] = useState(false);
  const overrides = useRarityOverrides();
  const { favoriteCardIds, toggleFavorite } = useFavoriteCards();
  const favoriteIds = new Set(favoriteCardIds);
  const customForPack = customCards.filter((card) => customTranscendanceInPack(card, pack));
  const entries: PreviewEntry[] = [
    ...cards.filter((card) => !isTranscendanceCatalogCard(card) && inPack(card, pack)).map((card) => ({
      id: card.id,
      card: normalizeCatalogCard(card, overrides),
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
    (!favoritesOnly || favoriteIds.has(entry.card.id)) &&
    (filter === "all" || (entry.customTranscendance ? filter === "transcendance" : entry.card.rarity === filter))
  ));
  const showMystery = !favoritesOnly && customForPack.length === 0 && (filter === "all" || filter === "transcendance");
  const favoriteCount = entries.filter((entry) => favoriteIds.has(entry.card.id)).length;
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

        {pack === "shonen" && <p className="text-xs text-muted-foreground">En ligne, la règle universelle doit encore être activée côté serveur : certaines cartes de cet aperçu peuvent être indisponibles au tirage.</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={favoritesOnly ? "hero" : "glass"} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
            ★ Mes favoris ({favoriteCount})
          </Button>
          <Button type="button" size="sm" variant={editing ? "hero" : "glass"} aria-pressed={editing} onClick={() => setEditing(!editing)}>
            <Pencil aria-hidden /> Éditer les raretés
          </Button>
          {editing && <Button type="button" size="sm" variant="glass" onClick={async () => {
            try {
              await navigator.clipboard.writeText(`export const USER_RARITY_OVERRIDES = ${JSON.stringify(overrides, null, 2)} as const;`);
              toast.success("Configuration copiée !");
            } catch {
              toast.error("Impossible de copier la configuration dans le presse-papiers.");
            }
          }}>Exporter ma config</Button>}
        </div>
        {editing && <p className="text-xs text-muted-foreground">Modifications locales sur cet appareil : les tirages et gains des comptes connectés restent régis par le serveur. Les Transcendances restent liées aux copies.</p>}
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
                  <span className="text-[10px] opacity-75">{rateLabel(rarity, pack)}</span>
                </>
              )}
            </Button>
          ))}
        </div>

        {visibleEntries.length === 0 && !showMystery ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{favoritesOnly ? "Aucune carte favorite ne correspond à ces filtres dans ce pack." : "Aucune carte de cette rareté dans ce pack."}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {showMystery && <MysteryCard pack={pack} />}
            {visibleEntries.map((entry) => {
              const rarity = entry.customTranscendance ? "transcendance" : entry.card.rarity;
              return (
                <article key={entry.id} className="mx-auto flex w-full max-w-44 flex-col items-center gap-2">
                  <div className="relative w-full">
                    <AnimeCard card={entry.card} customTranscendance={entry.customTranscendance} compact />
                    <button
                      type="button"
                      aria-label={`${favoriteIds.has(entry.card.id) ? "Retirer" : "Ajouter"} ${entry.card.name} ${favoriteIds.has(entry.card.id) ? "des" : "aux"} favoris`}
                      aria-pressed={favoriteIds.has(entry.card.id)}
                      onClick={() => {
                        try {
                          const added = toggleFavorite(entry.card.id);
                          toast.success(added ? "Ajouté à tes cartes favorites ★" : "Retiré de tes cartes favorites");
                        } catch {
                          toast.error("Impossible d'enregistrer tes cartes favorites. Vérifie le stockage du navigateur.");
                        }
                      }}
                      className="absolute right-2 top-2 z-40 rounded-full bg-background/80 p-2 text-foreground/70 transition-colors hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                    >
                      <Heart aria-hidden className={cn("size-4", favoriteIds.has(entry.card.id) && "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]")} />
                    </button>
                  </div>
                  <p className="w-full text-center text-[10px] font-semibold text-muted-foreground">
                    {RARITY[rarity].label} · {rateLabel(rarity, pack)}
                  </p>
                  {editing && (entry.customTranscendance ? (
                    <p className="text-center text-xs text-muted-foreground">Transcendance exclusive</p>
                  ) : (
                    <select
                      aria-label={`Rareté de ${entry.card.name}`}
                      value={entry.card.rarity}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!isCatalogRarity(value)) {
                          toast.error("Rareté invalide.");
                          return;
                        }
                        try {
                          setUserRarityOverride(entry.card.id, value);
                          toast.success("Rareté mise à jour !");
                        } catch {
                          toast.error("Impossible d'enregistrer la rareté. Vérifie le stockage du navigateur.");
                        }
                      }}
                      className="w-full rounded-lg border border-amber-400/40 bg-violet-950 px-2 py-1 text-xs text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                    >
                      {CATALOG_RARITIES.map((option) => <option key={option} value={option}>{RARITY[option].label}</option>)}
                    </select>
                  ))}
                </article>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MysteryCard({ pack }: { pack: PackId }) {
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
      <span className="text-[10px] font-bold text-rarity-transcendance">{rateLabel("transcendance", pack)}</span>
    </article>
  );
}
