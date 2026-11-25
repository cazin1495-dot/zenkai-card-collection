import { CATALOG_RARITIES, Card, PackId, Rarity, applyRemoteRarityOverrides, effectiveDropRate, getUserRarityOverrides, inPack, isCatalogRarity, normalizeCatalogCard } from "@/lib/cards";
import { RARITY } from "@/lib/cards";
import { RARITY_ORDER } from "@/lib/cards";
import { CUSTOM_TRANSCENDENCE_CARDS, customTranscendenceAsCard, customTranscendenceInPack, type CustomTranscendenceCard } from "@/lib/cards";
import { isTranscendenceCatalogCard } from "@/lib/cards";
import { useEffect, useState } from "react";
import { Eye, Heart, LockKeyhole, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { AnimeCard, TranscendFrame } from "@/components/AnimeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { saveRarityOverride } from "@/lib/rarity-overrides";
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
  ownedCardIds: ReadonlySet<string> | null;
  ownershipError?: boolean;
  onRetryOwnership?: () => void;
  customCards?: readonly CustomTranscendanceCard[];
};

type RarityFilter = Rarity | "all";

const PREVIEW_PAGE_SIZE = 24;

function rateLabel(rarity: Rarity, pack: PackId) {
  return `${String(effectiveDropRate(rarity, pack)).replace(".", ",")} %`;
}

function searchKey(value: string) {
  return value.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/\p{M}/gu, "");
}

const TOP_POPULARITY: Record<string, number> = {
  "lelouch lamperouge": 182000, "monkey d. luffy": 150400, "satoru gojo": 149000, "levi": 147400,
  "l lawliet": 132400, "roronoa zoro": 116700, "killua zoldyck": 115000, "eren yeager": 112000,
  "edward elric": 105000, "light yagami": 100000, "son goku": 98000, "naruto uzumaki": 95000,
  "itachi uchiha": 93000, "guts": 91000, "ken kaneki": 89000, "mikasa ackerman": 87000,
  "ichigo kurosaki": 85000, "sasuke uchiha": 83000, "vegeta": 81000, "saitama": 79000,
  "tanjiro kamado": 77000, "denji": 75000, "makima": 74000, "kakashi hatake": 73000,
  "nezuko kamado": 72000, "izuku midoriya": 71000, "katsuki bakugo": 70000, "sanji": 69000,
  "trafalgar law": 68000, "portgas d. ace": 67000, "shanks": 66000, "madara uchiha": 65000,
  "sukuna": 64500, "gon freecss": 64000, "kurapika": 63500, "hisoka morow": 63000,
  "rimuru tempest": 62500, "cid kagenou": 62000, "shouko komi": 61500, "nazuna nanakusa": 61000,
  "rudeus greyrat": 60500, "kamina": 60000, "kusuo saiki": 59500, "shinei nouzen": 59000,
};
const previewPopularity = (card: Card) => {
  const key = card.name.trim().toLowerCase();
  if (TOP_POPULARITY[key]) return TOP_POPULARITY[key];
  if (card.popularity && card.popularity > 0) return card.popularity;
  return Math.max(1, 50000 - (card.sort_order ?? 99999));
};

export function BoosterPreviewDialog({
  cards,
  pack,
  packLabel,
  open,
  onOpenChange,
  ownedCardIds,
  ownershipError = false,
  onRetryOwnership,
  customCards = CUSTOM_TRANSCENDANCE_CARDS,
}: Props) {
  const [filter, setFilter] = useState<RarityFilter>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingRarity, setSavingRarity] = useState(false);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ pack, filter, favoritesOnly, open, search, count: PREVIEW_PAGE_SIZE });
  const visibleCount =
    pagination.pack === pack && pagination.filter === filter &&
    pagination.favoritesOnly === favoritesOnly && pagination.open === open && pagination.search === search
      ? pagination.count
      : PREVIEW_PAGE_SIZE;
  useEffect(() => {
    setPagination({ pack, filter, favoritesOnly, open, search, count: PREVIEW_PAGE_SIZE });
  }, [pack, filter, favoritesOnly, open, search]);
  const overrides = useRarityOverrides();
  const { favoriteCardIds, toggleFavorite } = useFavoriteCards();
  const favoriteIds = new Set(favoriteCardIds);
  const customForPack = customCards.filter((card) => customTranscendanceInPack(card, pack));
  const rawEntries: PreviewEntry[] = [
      ...cards.filter((card) => !isTranscendenceCatalogCard(card) && inPack(card, pack)).map((card) => ({
        id: card.id,
        card: normalizeCatalogCard(card, overrides),
        customTranscendence: false,
      })),
      ...customForPack.map((card) => ({
        id: `custom-${card.id}`,
        card: customTranscendenceAsCard(card),
        customTranscendence: true,
      })),
    ];

    const animePopularity = new Map<string, { maxPop: number; totalPop: number }>();
    for (const entry of rawEntries) {
      const seriesKey = (entry.card.series || "Autre").trim().toLocaleLowerCase("fr");
      const pop = previewPopularity(entry.card);
      const current = animePopularity.get(seriesKey) ?? { maxPop: 0, totalPop: 0 };
      animePopularity.set(seriesKey, {
        maxPop: Math.max(current.maxPop, pop),
        totalPop: current.totalPop + pop,
      });
    }

    const entries: PreviewEntry[] = rawEntries.sort((left, right) => {
      const leftRarity = left.customTranscendence ? "transcendance" : left.card.rarity;
      const rightRarity = right.customTranscendence ? "transcendance" : right.card.rarity;
      const rarityDiff = RARITY_ORDER.indexOf(leftRarity) - RARITY_ORDER.indexOf(rightRarity);
      if (rarityDiff !== 0) return rarityDiff;

      const leftSeries = (left.card.series || "Autre").trim();
      const rightSeries = (right.card.series || "Autre").trim();
      const leftAnime = animePopularity.get(leftSeries.toLocaleLowerCase("fr")) ?? { maxPop: 0, totalPop: 0 };
      const rightAnime = animePopularity.get(rightSeries.toLocaleLowerCase("fr")) ?? { maxPop: 0, totalPop: 0 };

      if (rightAnime.maxPop !== leftAnime.maxPop) return rightAnime.maxPop - leftAnime.maxPop;
      if (rightAnime.totalPop !== leftAnime.totalPop) return rightAnime.totalPop - leftAnime.totalPop;

      const seriesDiff = leftSeries.localeCompare(rightSeries, "fr");
      if (seriesDiff !== 0) return seriesDiff;

      return previewPopularity(right.card) - previewPopularity(left.card) || left.id.localeCompare(right.id);
    });
  const searchTerm = searchKey(search);
  const visibleEntries = entries.filter((entry) => (
    (!favoritesOnly || favoriteIds.has(entry.card.id)) &&
    (filter === "all" || (entry.customTranscendance ? filter === "transcendance" : entry.card.rarity === filter)) &&
    (!searchTerm || (
      !(entry.customTranscendance && !ownedCardIds?.has(entry.card.id)) &&
      [entry.card.name, entry.card.series ?? "", entry.card.title].some((value) => searchKey(value).includes(searchTerm))
    ))
  ));
  const showMystery = !searchTerm && !favoritesOnly && customForPack.length === 0 && (filter === "all" || filter === "transcendance");
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

        <div className="flex items-center gap-2">
          <Input aria-label="Rechercher un personnage ou un anime" placeholder="Personnage ou anime…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button type="button" variant="glass" size="icon" aria-label="Effacer la recherche" disabled={!search} onClick={() => setSearch("")}>
            <X aria-hidden className="size-4" />
          </Button>
        </div>

        {pack === "shonen" && <p className="text-xs text-muted-foreground">En ligne, la règle universelle doit encore être activée côté serveur : certaines cartes de cet aperçu peuvent être indisponibles au tirage.</p>}
        {customForPack.length > 0 && <p className="text-xs text-muted-foreground">Les Transcendances exclusives sont disponibles dans la simulation invitée ; leur obtention en ligne dépend du serveur.</p>}
        {customForPack.length > 0 && ownedCardIds === null && (
          ownershipError ? (
            <p role="alert" className="text-xs text-destructive">
              Impossible de vérifier ta collection : les Transcendances restent masquées.{" "}
              {onRetryOwnership && <button type="button" className="underline" onClick={onRetryOwnership}>Réessayer</button>}
            </p>
          ) : <p role="status" className="text-xs text-muted-foreground">Vérification de ta collection…</p>
        )}
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
        {editing && <p className="text-xs text-muted-foreground">Seul le propriétaire peut enregistrer les raretés globales. Les tirages et gains des comptes connectés restent régis par le serveur. Les Transcendances restent liées aux copies.</p>}
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
          <p className="py-10 text-center text-sm text-muted-foreground">{searchTerm ? "Aucune carte ne correspond à cette recherche et à ces filtres." : favoritesOnly ? "Aucune carte favorite ne correspond à ces filtres dans ce pack." : "Aucune carte de cette rareté dans ce pack."}</p>
        ) : (
          <div className="booster-preview-cards grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {showMystery && <MysteryCard pack={pack} />}
            {visibleEntries.slice(0, visibleCount - Number(showMystery)).map((entry) => {
              const rarity = entry.customTranscendance ? "transcendance" : entry.card.rarity;
              const concealed = rarity === "transcendance" && !ownedCardIds?.has(entry.card.id);
              const favoriteName = concealed ? "une carte Transcendance mystère" : entry.card.name;
              return (
                <article key={entry.id} className="mx-auto flex w-full max-w-44 flex-col items-center gap-2">
                  <div className="relative w-full">
                    {concealed ? <MysteryTranscendanceCard /> : <AnimeCard card={entry.card} customTranscendance={entry.customTranscendance} compact staticEffects />}
                    <button
                      type="button"
                      aria-label={`${favoriteIds.has(entry.card.id) ? "Retirer" : "Ajouter"} ${favoriteName} ${favoriteIds.has(entry.card.id) ? "des" : "aux"} favoris`}
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
                      disabled={savingRarity}
                      onChange={async (event) => {
                        const value = event.target.value;
                        if (!isCatalogRarity(value)) {
                          toast.error("Rareté invalide.");
                          return;
                        }
                        try {
                          setSavingRarity(true);
                          await saveRarityOverride(entry.card.id, value, entry.card.name);
                          applyRemoteRarityOverrides({ ...getUserRarityOverrides(), [entry.card.id]: value });
                          toast.success("Rareté d'affichage enregistrée pour tous les joueurs.");
                        } catch (error) {
                          console.error(error);
                          toast.error("Impossible d'enregistrer la rareté globale.");
                        } finally {
                          setSavingRarity(false);
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
        {visibleEntries.length + Number(showMystery) > visibleCount && (
          <Button type="button" variant="glass" onClick={() => setPagination({
            pack, filter, favoritesOnly, open, search, count: visibleCount + PREVIEW_PAGE_SIZE,
          })}>
            Afficher plus (+24)
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MysteryTranscendanceCard() {
  return (
    <div className="reverse-card zenkai-transcendance-card relative aspect-[2.5/3.5] w-full overflow-hidden rounded-2xl shadow-[0_0_20px_rgba(175,82,222,0.45),0_0_12px_rgba(0,199,190,0.35)]">
      <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,#251339_0%,#080611_48%,#000_100%)]">
        <span aria-hidden className="font-display text-7xl font-black text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.9)]">?</span>
      </div>
      <TranscendFrame />
      <div className="premium-glass-label absolute inset-x-0 bottom-0 z-30 p-1">
        <p className="tcg-nameplate text-center font-display text-[9px] font-bold leading-tight">??? · Carte Transcendance</p>
      </div>
    </div>
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
