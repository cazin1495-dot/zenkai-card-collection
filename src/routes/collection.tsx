import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InspectableCard } from "@/components/Transcendance";
import { toast } from "sonner";
import { Heart, Recycle } from "lucide-react";
import { cardsQuery } from "@/lib/queries";
import { cardIdentity, getCardMarketPrice, getCardPopularityFactor, getCardRecycleValue, inPack, RARITY, RARITY_ORDER, type Card, type CatalogRarity, type PackId, type Rarity } from "@/lib/cards";
import { collectionEntries, sortCollectionEntries, type CollectionEntry, type CollectionSort } from "@/lib/collection-view";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useZenkaiPlus } from "@/hooks/use-zenkai-plus";
import { getPlus } from "@/lib/subscription";
import { getGuestCollection, getGuestPlus, guestDuplicates, guestRecycleGroups, plusRecycleBonus, recycleGuestCollection, type GuestOwnedRow } from "@/lib/guest-collection";
import { MarketSaleDialog } from "@/components/MarketSaleDialog";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "@/lib/transcendance-cards";
import { useFavoriteCards } from "@/lib/favorites";
import { AnimeAlbum } from "@/components/AnimeAlbum";
import { recordQuestActivity } from "@/lib/quests";

export const Route = createFileRoute("/collection")({
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
const RECYCLABLE_RARITIES = ["commune", "non_commune", "rare", "epique", "legendaire", "mythique"] as const satisfies readonly CatalogRarity[];
const DEFAULT_RECYCLE_RARITIES: readonly CatalogRarity[] = ["commune", "non_commune", "rare", "epique"];

export function CollectionPage() {
  const { session, guest } = useAuth();
  const [albumView, setAlbumView] = useState(false);
  const localCollection = true;
  const userId = session?.user.id;
  const cards = useQuery(cardsQuery);
  const guestOwned = useQuery({ queryKey: ["guest-collection"], queryFn: getGuestCollection, enabled: true });
  const plus = useQuery({ queryKey: ["guest-plus"], queryFn: getGuestPlus, enabled: true });
  const accountPlus = useZenkaiPlus();
  const localBonus = session ? accountPlus.state?.active === true : plus.data?.active === true;
  const queryClient = useQueryClient();
  const ownedRows = guestOwned.data;
  const [recycling, setRecycling] = useState<string | null>(null);
  const [saleCopyId, setSaleCopyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CollectionEntry | null>(null);
  const [recycleOpen, setRecycleOpen] = useState(false);
  useEffect(() => {
    if (!localCollection) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
      void queryClient.invalidateQueries({ queryKey: ["guest-plus"] });
    };
    window.addEventListener("zenkai:guest-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("zenkai:guest-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [localCollection, queryClient]);

  async function recycle(card: Card) {
    if (localCollection) {
      if (recycling || !guestOwned.data || !cards.data || !plus.data || plus.isError || (session && (!accountPlus.state || accountPlus.error))) return;
      const copy = guestDuplicates(guestOwned.data, cards.data).find((row) => row.card_id === card.id);
      if (!copy) {
        toast.error("Ce doublon n'est plus disponible. Actualise la collection.");
        void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
        return;
      }
      const base = getCardRecycleValue(card);
      const value = base + plusRecycleBonus(base, localBonus);
      if (!window.confirm(`Recycler un doublon de ${card.name} pour ${value} Zen locaux ?`)) return;
      setRecycling(copy.id);
      try {
        const gained = recycleGuestCollection([copy.id], cards.data, { total: value }, session ? getPlus(session.user.id, false).active : undefined);
        toast.success(`Doublon recyclé · +${gained} Zen locaux`);
        try { if (session?.user?.id) recordQuestActivity(session.user.id, "recycled", 1); recordQuestActivity(null, "recycled", 1); }
        catch { toast.error("Recyclage effectué, mais progression des quêtes locales indisponible."); }
      } catch (error) {
        toast.error(error instanceof Error ? `Recyclage impossible : ${error.message}` : "Recyclage impossible.");
      } finally {
        setRecycling(null);
        void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
      }
      return;
    }
  }
  const [filter, setFilter] = useState<Filter>("all");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "all">("all");
  const [animeSearch, setAnimeSearch] = useState("");
  const [sort, setSort] = useState<CollectionSort>("owned-rarest");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { favoriteCardIds } = useFavoriteCards();
  const favoriteIds = new Set(favoriteCardIds);

  const catalog = useMemo(() => [
    ...(cards.data ?? []),
    ...(localCollection ? CUSTOM_TRANSCENDANCE_CARDS
      .filter((card) => guestOwned.data?.some((row) => row.card_id === card.id))
      .map(customTranscendanceAsCard) : []),
  ], [cards.data, localCollection, guestOwned.data]);
  const entries = useMemo(() => collectionEntries(
    catalog,
    ownedRows ?? [],
    new Set(CUSTOM_TRANSCENDANCE_CARDS.map((card) => card.id)),
  ), [catalog, ownedRows]);
  const packEntries = entries.filter((entry) =>
    filter === "all" || (filter === "shonen" ? entry.card.category === "shonen" : inPack(entry.card, filter)),
  );
  const rarityCounts = new Map<Rarity, number>();
  for (const entry of packEntries) {
    if (entry.count) rarityCounts.set(entry.rarity, (rarityCounts.get(entry.rarity) ?? 0) + 1);
  }
  const termeRecherche = animeSearch
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/tokyo mew mew power|mew mew power/g, "tokyo mew mew")
    .trim();
  const filtered = packEntries.filter((entry) => {
    const correspondRarete = rarityFilter === "all" || entry.rarity === rarityFilter;
    const correspondFavori = !favoritesOnly || favoriteIds.has(entry.card.id);
    if (!correspondRarete || !correspondFavori) return false;
    if (!termeRecherche) return true;
    const animeNorm = String(entry.card.anime ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const nomNorm = String(entry.card.name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return animeNorm.includes(termeRecherche) || nomNorm.includes(termeRecherche);
  });
  const list = sortCollectionEntries(filtered, sort);
  const recycleGroups = useMemo(() => guestRecycleGroups(
    guestOwned.data ?? [], cards.data ?? [], localBonus,
  ), [guestOwned.data, cards.data, localBonus]);
  const duplicateCount = [...recycleGroups.values()].reduce((sum, group) => sum + group.copies.length, 0);
  const catalogIds = new Set((cards.data ?? []).map((card) => card.id));
  const missingMetadata = !!guestOwned.data?.some((row) =>
    !row.transcended && !row.customTranscendance && !catalogIds.has(row.card_id),
  );
  const recycleAvailable = localCollection && !!cards.data && !!guestOwned.data && !!plus.data &&
    !cards.isError && !guestOwned.isError && !plus.isError && (!session || (!!accountPlus.state && !accountPlus.error)) && !missingMetadata;
  function sellCopy(card: Card, transcended: boolean) {
    const copy = guestOwned.data?.filter((row) =>
      row.card_id === card.id && (row.transcended || row.customTranscendance === true) === transcended,
    ).sort((a, b) => b.obtained_at.localeCompare(a.obtained_at) || b.id.localeCompare(a.id))[0];
    if (!copy) {
      toast.error("Cette copie n'est plus disponible. Actualise la collection.");
      void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
      return;
    }
    setSaleCopyId(copy.id);
  }
  const ownedInView = list.filter((entry) => entry.count > 0).length;
  const albumCatalog = useMemo(() => [...new Map([
    ...(cards.data ?? []),
    ...CUSTOM_TRANSCENDANCE_CARDS.map(customTranscendanceAsCard),
  ].map((card) => [card.id, card])).values()], [cards.data]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-black sm:text-4xl">Ma Collection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ownedInView} / {list.length} formes · {ownedRows?.length ?? 0} cartes au total
          </p>
        </div>
        <Progress value={ownedInView} total={list.length} className="max-w-20 sm:max-w-xs" />
      </div>

      {!session && !guest && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/60 p-4">
          <p className="text-sm text-muted-foreground">
            Ta collection est enregistrée localement sur cet appareil, même après connexion.
          </p>
          <Button variant="glass" asChild>
            <Link to="/auth">Se connecter</Link>
          </Button>
        </div>
      )}
      {localCollection && <p className="mt-5 text-sm text-muted-foreground">Collection locale sur cet appareil, disponible avec ou sans compte connecté. Le marché local est fictif.</p>}
      {localCollection && (guestOwned.isError || plus.isError) && <p role="alert" className="mt-3 text-sm text-destructive">Collection ou état Zenkai+ local indisponible : vérifie le stockage du navigateur.</p>}
      {localCollection && session && accountPlus.error && <p role="alert" className="mt-3 text-sm text-destructive">État Zenkai+ du profil indisponible : vérifie le stockage du navigateur.</p>}
      {cards.isError && <p role="alert" className="mt-3 text-sm text-destructive">Catalogue indisponible. <Button variant="link" onClick={() => cards.refetch()}>Réessayer</Button></p>}
      {localCollection && cards.data && missingMetadata && <p role="alert" className="mt-3 text-sm text-destructive">Certaines cartes locales sont absentes du catalogue : recyclage global indisponible.</p>}

      <div role="group" aria-label="Vue de la collection" className="mt-6 flex gap-2">
        <Button variant={!albumView ? "hero" : "glass"} aria-pressed={!albumView} onClick={() => setAlbumView(false)}>Grille classique</Button>
        <Button variant={albumView ? "hero" : "glass"} aria-pressed={albumView} onClick={() => setAlbumView(true)}>Album par Anime</Button>
      </div>
      {albumView ? (
        cards.data && ownedRows ? <AnimeAlbum cards={albumCatalog} copies={ownedRows} userId={null} /> :
          <p className="mt-6 text-sm text-muted-foreground">Chargement du catalogue et de la collection…</p>
      ) : <>
      <div aria-label="Filtrer par pack" className="mt-6 flex max-w-full gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
        {FILTERS.map((f) => (
          <Button variant="ghost"
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-auto min-h-11 shrink-0 rounded-md border border-border px-3 py-2 text-xs font-semibold transition-colors",
              filter === f.id ? "bg-surface-raised text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label htmlFor="collection-sort" className="text-sm font-bold">Trier la collection</label>
        <select id="collection-sort" value={sort} onChange={(event) => setSort(event.target.value as CollectionSort)} className="rounded-lg border border-primary/30 bg-surface px-3 py-2 text-sm">
          <option value="owned-rarest">Possédées d'abord · Plus rare → Commune</option>
          <option value="rarest">Rareté : Plus rare → Commune</option>
          <option value="commonest">Rareté : Commune → Plus rare</option>
          <option value="value">Valeur Zen (Plus chères en premier)</option>
          <option value="duplicates">Doublons (×N)</option>
          <option value="recent">Récemment obtenues</option>
        </select>
        <Button variant={favoritesOnly ? "hero" : "glass"} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>★ Favoris uniquement</Button>
        <Button variant="glass" aria-label="Recycler" disabled={!recycleAvailable} onClick={() => setRecycleOpen(true)}>
          <Recycle className="size-4" /> Recycler <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">{recycleAvailable ? duplicateCount > 99 ? "99+" : duplicateCount : "—"}</span>
        </Button>
      </div>
      {!localCollection && <p className="mt-2 text-xs text-muted-foreground">Le recyclage groupé en Zen concerne uniquement la collection locale.</p>}
      <div role="group" aria-label="Filtrer par rareté" className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
        {(["all", ...RARITY_ORDER] as const).map((rarity) => (
          <Button key={rarity} variant={rarityFilter === rarity ? "hero" : "glass"} size="sm" className="min-h-11 shrink-0 sm:min-h-0" aria-pressed={rarityFilter === rarity} onClick={() => setRarityFilter(rarity)}>
            {rarity === "all" ? "Toutes" : RARITY[rarity].label} {rarity === "all" ? packEntries.filter((entry) => entry.count > 0).length : rarityCounts.get(rarity) ?? 0}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Compteurs : formes différentes possédées, après filtre de pack.</p>
      <div className="mt-3 flex items-center gap-2 max-w-md">
        <input
          type="text"
          value={animeSearch}
          onChange={(e) => setAnimeSearch(e.target.value)}
          placeholder="Rechercher par nom d'animé (ex : Naruto, Demon Slayer...)"
          className="w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {animeSearch && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAnimeSearch("")}
          >
            Effacer
          </Button>
        )}
      </div>

      {ownedRows && ownedRows.length === 0 && (
        <div className="mt-10 rounded-2xl border border-border bg-surface/60 p-8 text-center">
          <p className="font-display text-lg font-bold">Ta collection est vide</p>
          <p className="mt-1 text-sm text-muted-foreground">Ouvre ton premier booster pour obtenir 5 cartes.</p>
          <Button variant="hero" className="mt-5 rounded-full" asChild>
            <Link to="/">Ouvrir un booster</Link>
          </Button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
        {list.map((entry) => {
          const { card, count, rarity } = entry;
          const evolved = rarity === "transcendance";
          return <div key={`${card.id}-${rarity}`} className="flex flex-col items-center gap-2">
            <div className="relative w-full">
              <InspectableCard card={card} count={count || undefined} locked={!!session && !count} transcended={entry.transcended} customTranscendance={entry.customTranscendance} />
              {favoriteIds.has(card.id) && <span role="img" aria-label="Carte favorite" className="pointer-events-none absolute right-2 top-2 z-40 rounded-full bg-background/80 p-1.5"><Heart aria-hidden className="size-4 fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" /></span>}
            </div>
            <CardValues entry={entry} bonus={localCollection && localBonus} />
            {!!count && <Button variant="glass" size="sm" aria-label={`Détails ${card.name}${evolved ? " transcendée" : ""}`} onClick={() => setDetail(entry)} className="w-full">Détails</Button>}
            {localCollection && !!count && <Button variant="hero" size="sm" aria-label={`Vendre ${card.name}${evolved ? " transcendée" : ""}`} onClick={() => sellCopy(card, evolved)} className="w-full">Vendre</Button>}
            {count > 1 && !evolved && <Button variant="glass" size="sm" disabled={!!recycling || !plus.data || plus.isError || (!!session && (!accountPlus.state || accountPlus.error))} onClick={() => recycle(card)} className="h-auto w-full whitespace-normal text-[10px]"><Recycle className="size-3" /> Recycler · +{getCardRecycleValue(card) + plusRecycleBonus(getCardRecycleValue(card), localBonus)} Zen locaux</Button>}
          </div>;
        })}
      </div>
      </>}
      {detail && <Dialog open onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto border-primary/40 bg-surface p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle>{cardIdentity(detail.card, detail.transcended).name}</DialogTitle>
            <DialogDescription>{detail.card.description || RARITY[detail.rarity].label} · ×{detail.count}</DialogDescription>
          </DialogHeader>
          <div className="mx-auto w-36"><InspectableCard card={detail.card} transcended={detail.transcended} customTranscendance={detail.customTranscendance} count={detail.count} /></div>
          <CardValues entry={detail} bonus={localCollection && localBonus} />
          {localCollection && <Button variant="hero" onClick={() => { setDetail(null); sellCopy(detail.card, detail.rarity === "transcendance"); }}>Vendre</Button>}
        </DialogContent>
      </Dialog>}
      {recycleOpen && recycleAvailable && cards.data && guestOwned.data && plus.data && <RecycleDialog
        cards={cards.data}
        copies={guestOwned.data}
        active={localBonus}
        userId={session?.user.id ?? null}
        onClose={() => setRecycleOpen(false)}
      />}
      {localCollection && saleCopyId && <MarketSaleDialog
        cards={catalog}
        copies={guestOwned.data ?? []}
        initialCopyId={saleCopyId}
        onClose={() => setSaleCopyId(null)}
        onPublished={(listing) => toast.success(`${listing.cardName} mise en vente sur le marché fictif.`, {
          description: <Link to="/market" hash={listing.kind === "auction" ? "encheres" : ""}>Voir l'annonce</Link>,
        })}
      />}
    </div>
  );
}

function RecycleDialog({ cards, copies, active, userId, onClose }: {
  cards: Card[];
  copies: GuestOwnedRow[];
  active: boolean;
  userId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const groups = guestRecycleGroups(copies, cards, active);
  const [selected, setSelected] = useState<Set<CatalogRarity>>(() =>
    new Set(DEFAULT_RECYCLE_RARITIES.filter((rarity) => groups.has(rarity))),
  );
  const rarities = RECYCLABLE_RARITIES.filter((rarity) => selected.has(rarity));
  const selectedCopies = rarities.flatMap((rarity) => groups.get(rarity)?.copies ?? []);
  const total = rarities.reduce((sum, rarity) => sum + (groups.get(rarity)?.gain ?? 0), 0);

  function submit() {
    try {
      const gain = recycleGuestCollection(selectedCopies.map((copy) => copy.id), cards, { rarities, total }, userId ? getPlus(userId, false).active : undefined);
      try { if (session?.user?.id) recordQuestActivity(session.user.id, "recycled", selectedCopies.length); recordQuestActivity(null, "recycled", selectedCopies.length); }
      catch { toast.error("Recyclage effectué, mais progression des quêtes locales indisponible."); }
      void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
      onClose();
      toast.success(`${selectedCopies.length} doublons recyclés ! +${gain} Zen ajoutés`);
    } catch (error) {
      toast.error(error instanceof Error ? `Recyclage impossible : ${error.message}` : "Recyclage impossible.");
      void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
      void queryClient.invalidateQueries({ queryKey: ["guest-plus"] });
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl border-primary/40 bg-surface">
      <DialogHeader>
        <DialogTitle>Recycler les doublons</DialogTitle>
        <DialogDescription>La copie locale la plus ancienne de chaque carte est conservée. Les Transcendances sont exclues.</DialogDescription>
      </DialogHeader>
      {active && <p className="text-sm font-bold text-amber-400">+20 % Bonus Zenkai+</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {RECYCLABLE_RARITIES.map((rarity) => {
          const group = groups.get(rarity);
          const count = group?.copies.length ?? 0;
          return <button
            key={rarity}
            type="button"
            disabled={!count}
            aria-pressed={selected.has(rarity) && count > 0}
            onClick={() => setSelected((previous) => {
              const next = new Set(previous);
              if (next.has(rarity)) next.delete(rarity); else next.add(rarity);
              return next;
            })}
            className={cn("rounded-xl border bg-background p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              selected.has(rarity) && count ? "border-primary bg-primary/10" : "border-border")}
          >
            <span className={cn("block text-sm font-bold", RARITY[rarity].text)}>{RARITY[rarity].label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{count ? `×${count}` : "aucun"}</span>
            <span className="mt-1 block text-sm font-semibold text-primary">+{(group?.gain ?? 0).toLocaleString("fr-FR")} Zen</span>
          </button>;
        })}
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="glass" onClick={onClose}>Annuler</Button>
        <Button variant="hero" disabled={!selectedCopies.length} onClick={submit}>Recycler {selectedCopies.length} doublons · +{total.toLocaleString("fr-FR")} Zen</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function CardValues({ entry, bonus }: { entry: CollectionEntry; bonus: boolean }) {
  const priced = { ...entry.card, rarity: entry.rarity };
  const recycle = getCardRecycleValue(priced);
  const value = recycle + plusRecycleBonus(recycle, bonus);
  return <div className="w-full text-center text-xs">
    {getCardPopularityFactor(entry.card) >= 1.4 && <span className="inline-block rounded-full bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-400">Populaire 🔥</span>}
    <p className="mt-1 font-bold text-primary">Valeur locale : {getCardMarketPrice(priced).toLocaleString("fr-FR")} Zen</p>
    <p className="text-muted-foreground">Recyclage local : {value.toLocaleString("fr-FR")} Zen{entry.rarity === "transcendance" ? " · non recyclable" : bonus ? " · Zenkai+" : ""}</p>
  </div>;
}

function Progress({ value, total, className }: { value: number; total: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full bg-gradient-primary transition-all" style={{ width: total ? `${(value / total) * 100}%` : "0%" }} />
    </div>
  );
}
