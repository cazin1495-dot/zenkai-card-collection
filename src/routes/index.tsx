import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Clock, Gem, Package, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BoosterPack } from "@/components/BoosterPack";
import { BoosterArtwork } from "@/components/BoosterArtwork";
import { BoosterPreviewDialog } from "@/components/BoosterPreviewDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OpeningAura } from "@/components/OpeningAura";
import { CardReveal, NewCardBadge } from "@/components/CardReveal";
import { InspectableCard } from "@/components/Transcendance";
import { gameQuery } from "@/lib/game";
import { REWARD_LABELS } from "@/lib/economy";
import { useAuth } from "@/hooks/use-auth";
import { useRarityOverrides } from "@/hooks/use-rarity-overrides";
import { supabase } from "@/integrations/supabase/client";
import { cardsQuery, collectionQuery, pityQuery, profileQuery } from "@/lib/queries";
import { createLocalGuestDraw } from "@/lib/guest";
import { recordBoosterOpen, recordSecretDraw } from "@/lib/quests";
import { getGuestBalance, getGuestCollection } from "@/lib/guest-collection";
import { markNewBoosterCards, sortBoosterCardsByRarity } from "@/lib/booster-order";
import {
  bestRarity,
  boosterStock,
  CARDS_PER_BOOSTER,
  formatCountdown,
  effectiveDropRate,
  normalizeCatalogCard,
  OPEN_COUNTS,
  PACK_ARTWORK_BY_PACK,
  getPackCardBack,
  PACKS,
  RARITY,
  rarityRank,
  PITY_LIMIT,
  STOCK_CAP,
  ZENKAI_BOOSTER_COST,
  type Card,
  type PackId,
  type PulledCard,
  type Rarity,
} from "@/lib/cards";
import { cn } from "@/lib/utils";
import { bestOpeningRarity } from "@/lib/pack-opening";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Boosters — Zenkai" },
      { name: "description", content: "Ouvre des boosters de 5 cartes anime : Shonen, Seinen, Shojo, Sport, Antagonistes et Protagonistes." },
      { property: "og:title", content: "Boosters — Zenkai" },
      { property: "og:description", content: "Ouvre des boosters de 5 cartes anime : Shonen, Seinen, Shojo, Sport, Antagonistes et Protagonistes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(cardsQuery),
  component: BoostersPage,
});

type Phase = "idle" | "opening" | "tearing" | "reveal" | "summary";
type Awake = Record<string, "transcended" | "failed">;
type PackFilter = "free" | "zen" | "all";

export function BoostersPage() {
  const { data: cards } = useSuspenseQuery(cardsQuery);
  const { session, ready, guest } = useAuth();
  const userId = session?.user.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useQuery({ ...profileQuery(userId ?? ""), enabled: !!userId });
  const game = useQuery({ ...gameQuery(userId ?? ""), enabled: !!userId });
  const pity = useQuery({ ...pityQuery(userId ?? ""), enabled: !!userId });

  const [now, setNow] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pack, setPack] = useState<PackId>("shonen");
  const [packFilter, setPackFilter] = useState<PackFilter>("free");
  const [isPackPreviewOpen, setIsPackPreviewOpen] = useState(false);
  const [isPackChoiceOpen, setIsPackChoiceOpen] = useState(false);
  const [pulled, setPulled] = useState<PulledCard[]>([]);
  const [opened, setOpened] = useState(1);
  const [awake, setAwake] = useState<Awake>({});
  const [returningToBoosters, setReturningToBoosters] = useState(false);
  const [quantity, setQuantity] = useState<(typeof OPEN_COUNTS)[number]>(1);
  const [localZen, setLocalZen] = useState<number | null>(null);
  const [localZenError, setLocalZenError] = useState(false);
  const tearRequested = useRef(false);
  const finishOpeningWait = useRef<(() => void) | null>(null);
  const accountCollection = useQuery({
    ...collectionQuery(userId ?? ""),
    enabled: ready && isPackPreviewOpen && !!userId,
    staleTime: 0,
    retry: false,
  });
  const guestCollection = useQuery({
    queryKey: ["guest-collection"],
    queryFn: getGuestCollection,
    enabled: ready && isPackPreviewOpen && !userId,
    staleTime: 0,
    retry: false,
  });
  const previewCollection = userId ? accountCollection : guestCollection;
  const ownedCardIds = ready && !previewCollection.isFetching && !previewCollection.isError && previewCollection.data
    ? new Set(previewCollection.data.map((row) => row.card_id))
    : null;
  const rarityOverrides = useRarityOverrides();
  const displayedPulled = useMemo(
    () => pulled.map((item) => ({ ...item, card: normalizeCatalogCard(item.card, rarityOverrides) })),
    [pulled, rarityOverrides],
  );
  const tearBeam = useMemo(
    () => bestOpeningRarity(displayedPulled.map((p) => (p.transcended || p.customTranscendance ? "transcendance" : p.card.rarity))),
    [displayedPulled],
  );

  useEffect(() => {
    if (!isPackPreviewOpen || !ready || userId) return;
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["guest-collection"] }); };
    window.addEventListener("zenkai:guest-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("zenkai:guest-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [isPackPreviewOpen, ready, userId, queryClient]);

  useEffect(() => {
    function refreshLocalZen() {
      try {
        setLocalZen(getGuestBalance());
        setLocalZenError(false);
      } catch {
        setLocalZen(null);
        setLocalZenError(true);
      }
    }
    refreshLocalZen();
    window.addEventListener("zenkai:guest-updated", refreshLocalZen);
    window.addEventListener("zenkai:zen-updated", refreshLocalZen);
    window.addEventListener("storage", refreshLocalZen);
    return () => {
      window.removeEventListener("zenkai:guest-updated", refreshLocalZen);
      window.removeEventListener("zenkai:zen-updated", refreshLocalZen);
      window.removeEventListener("storage", refreshLocalZen);
    };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stock =
    profile.data && now !== null
      ? boosterStock(profile.data.boosters_stored, profile.data.stock_updated_at, now)
      : null;
  const busy =
    phase === "opening" ||
    phase === "tearing" ||
    phase === "reveal" ||
    returningToBoosters;
  const packInfo = PACKS.find((p) => p.id === pack) ?? PACKS[0];
  if (!packInfo) return null;
  const cardBack = getPackCardBack(pack);
  const best = bestRarity(
    displayedPulled.map((p) =>
      awake[p.userCardId] === "transcended" || p.transcended || p.customTranscendance ? "transcendance" : p.card.rarity,
    ),
  );

  function requestTear() {
    tearRequested.current = true;
    finishOpeningWait.current?.();
  }

  async function revealAfterOpening() {
    if (!tearRequested.current) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          window.clearTimeout(timer);
          finishOpeningWait.current = null;
          resolve();
        };
        const timer = window.setTimeout(finish, 600);
        finishOpeningWait.current = finish;
      });
    }
    tearRequested.current = false;
    setPhase("tearing");
    await new Promise((resolve) => setTimeout(resolve, 1800));
    setPhase("reveal");
  }

  async function open(count: number, category: string = pack) {
    if (busy) return;
    if (category === "zenkai") {
      toast.error("Le Booster Zenkai nécessite une prise en charge sécurisée du Zen par le serveur.");
      return;
    }
    if (!session || true) {
      if (!session && !guest) {
        navigate({ to: "/auth" });
        return;
      }
      const localPack = PACKS.find((item) => item.id === category);
      if (!localPack) {
        toast.error("Ce type de booster n’est pas disponible en mode Invité.");
        return;
      }
      let localDraw: PulledCard[];
      let ownedIdsBeforeOpen: string[];
      try {
        ownedIdsBeforeOpen = getGuestCollection().map((row) => row.card_id);
        localDraw = sortBoosterCardsByRarity(markNewBoosterCards(
          createLocalGuestDraw(cards, localPack.id, count),
          ownedIdsBeforeOpen,
        ));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Tirage invité impossible.");
        return;
      }
      if (!localDraw.length) {
        toast.error("Aucune carte disponible dans ce pack pour le tirage local.");
        return;
      }
      try {
        recordBoosterOpen(null, count, ownedIdsBeforeOpen, localDraw.map((item) => item.card.id));
        recordSecretDraw(count, localDraw);
      }
      catch { toast.error("Tirage effectué, mais progression des missions et XP locales indisponible."); }

      tearRequested.current = false;
      setPhase("opening");
      setPulled([]);
      setAwake(
        Object.fromEntries(
          localDraw
            .filter((item) => item.transcended)
            .map((item) => [item.userCardId, "transcended" as const]),
        ),
      );
      const started = Date.now();
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 600 - (Date.now() - started))),
      );
      setPulled(localDraw);
      setOpened(count);
      window.scrollTo({ top: 0, behavior: "smooth" });
      await revealAfterOpening();
      return;
    }
    tearRequested.current = false;
    setPhase("opening");
    setPulled([]);
    setAwake({});
    let ownedIdsBeforeOpen: string[];
    try {
      const current = await queryClient.fetchQuery({ ...collectionQuery(session.user.id), staleTime: 0 });
      ownedIdsBeforeOpen = current.map((row) => row.card_id);
    } catch (reason) {
      setPhase("idle");
      toast.error(reason instanceof Error ? `Collection indisponible : ${reason.message}` : "Collection indisponible. Réessaie.");
      return;
    }
    const started = Date.now();
    let response: Awaited<ReturnType<typeof supabase.rpc<"open_boosters">>>;
    try {
      response = await supabase.rpc("open_boosters", { _category: category, _count: count });
    } catch (error) {
      setPhase("idle");
      toast.error(error instanceof Error
        ? `Réponse du serveur indisponible : ${error.message}. Vérifie ta collection avant de réessayer.`
        : "Réponse du serveur indisponible. Vérifie ta collection avant de réessayer.");
      void queryClient.invalidateQueries({ queryKey: ["collection", session.user.id] });
      void queryClient.invalidateQueries({ queryKey: ["profile", session.user.id] });
      return;
    }
    const { data, error } = response;
    const openedAt = new Date();
    await new Promise((r) => setTimeout(r, Math.max(0, 600 - (Date.now() - started))));

    if (error || !data?.length) {
      setPhase("idle");
      toast.error(
        error?.message.includes("not_enough_boosters")
          ? "Pas assez de boosters en stock."
          : error
            ? `Réponse du serveur indisponible : ${error.message}. Vérifie ta collection avant de réessayer.`
            : "Le serveur n'a retourné aucune carte. Vérifie ta collection avant de réessayer.",
      );
      void queryClient.invalidateQueries({ queryKey: ["profile", session.user.id] });
      void queryClient.invalidateQueries({ queryKey: ["collection", session.user.id] });
      return;
    }
    try { recordBoosterOpen(session.user.id, count, ownedIdsBeforeOpen, data.map((item) => item.card_id), openedAt); }
    catch { toast.error("Booster ouvert, mais progression des missions et XP locales indisponible."); }

    async function failAfterOpen(message: string) {
      setPhase("idle");
      toast.error(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
        queryClient.invalidateQueries({ queryKey: ["collection", userId] }),
        queryClient.invalidateQueries({ queryKey: ["game", userId] }),
        queryClient.invalidateQueries({ queryKey: ["pity", userId] }),
      ]);
    }
    const fetchCopyStates = () => supabase
      .from("user_cards")
      .select("id, transcended")
      .eq("user_id", session.user.id)
      .in("id", data.map((row) => row.user_card_id));
    let copyResult: Awaited<ReturnType<typeof fetchCopyStates>>;
    try {
      copyResult = await fetchCopyStates();
    } catch (reason) {
      await failAfterOpen(reason instanceof Error
        ? `Booster ouvert, mais l’état des cartes n’a pas pu être chargé : ${reason.message}. Consulte ta collection.`
        : "Booster ouvert, mais l’état des cartes n’a pas pu être chargé. Consulte ta collection.");
      return;
    }
    const { data: copyStates, error: copyStatesError } = copyResult;
    if (copyStatesError || !copyStates || copyStates.length !== data.length) {
      await failAfterOpen(copyStatesError
        ? `Booster ouvert, mais l’état des cartes n’a pas pu être chargé : ${copyStatesError.message}. Consulte ta collection.`
        : "Booster ouvert, mais l’état de certaines cartes n’a pas pu être chargé. Consulte ta collection.");
      return;
    }

    const transcendedIds = new Set(copyStates.filter((copy) => copy.transcended).map((copy) => copy.id));
    const byId = new Map(cards.map((c) => [c.id, c]));
    const items = data
        .map((row) => {
          const card = byId.get(row.card_id);
          if (!card) return null;
          return {
            userCardId: row.user_card_id,
            card,
            ...(transcendedIds.has(row.user_card_id) ? { transcended: true } : {}),
          };
        })
        .filter((item): item is PulledCard => item !== null);
    if (items.length !== data.length) {
      setPhase("idle");
      toast.error("Booster ouvert, mais certaines cartes manquent dans le catalogue. Consulte ta collection.");
      void queryClient.invalidateQueries({ queryKey: ["collection", session.user.id] });
      void queryClient.invalidateQueries({ queryKey: ["profile", session.user.id] });
      return;
    }
    try { recordSecretDraw(count, items); }
    catch { toast.error("Booster ouvert, mais progression des succès secrets indisponible."); }
    const marked = sortBoosterCardsByRarity(markNewBoosterCards(items, ownedIdsBeforeOpen));
    setAwake(Object.fromEntries(marked.filter((item) => item.transcended).map((item) => [item.userCardId, "transcended" as const])));
    setPulled(marked);
    setOpened(count);
    queryClient.setQueryData(profileQuery(session.user.id).queryKey, (old) =>
      old && data[0] ? { ...old, boosters_stored: data[0].boosters_left, stock_updated_at: data[0].stock_updated_at } : old,
    );
    queryClient.invalidateQueries({ queryKey: ["collection", session.user.id] });
    queryClient.invalidateQueries({ queryKey: ["game", session.user.id] });
    await queryClient.invalidateQueries({ queryKey: ["pity", session.user.id] });
    window.scrollTo({ top: 0, behavior: "smooth" });

    await revealAfterOpening();
  }

  async function returnToBoosterSelection() {
    setPulled([]);
    setAwake({});
    setOpened(1);
    setNow(Date.now());
    setPhase("idle");

    if (!userId) return;
    setReturningToBoosters(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileQuery(userId).queryKey }),
        queryClient.invalidateQueries({ queryKey: ["collection", userId] }),
        queryClient.invalidateQueries({ queryKey: ["game", userId] }),
        queryClient.invalidateQueries({ queryKey: ["pity", userId] }),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Actualisation des données impossible : ${error.message}`
          : "Actualisation des données impossible. Réessaie.",
      );
    } finally {
      setReturningToBoosters(false);
    }
  }

  const onAwaken = (id: string, r: "transcended" | "failed") => setAwake((a) => ({ ...a, [id]: r }));
  const pityCount = userId && !pity.isError && pity.data !== undefined
    ? Math.max(0, Math.min(PITY_LIMIT, pity.data))
    : null;

  function selectFilter(filter: PackFilter) {
    setPackFilter(filter);
    if (filter === "zen") setPack("zenkai");
    if (filter === "free" && pack === "zenkai") setPack("shonen");
  }

  return (
    <div className="booster-hub mx-auto flex w-full max-w-7xl flex-col items-center px-4 pb-12 pt-6">
      {(phase === "reveal" || phase === "summary") && <h1 className="sr-only">Ouverture du booster</h1>}
      {(phase === "idle" || phase === "opening" || phase === "tearing") && (
        <>
          <p className="game-eyebrow"><Sparkles className="size-3.5" /> LE HUB DES COLLECTIONNEURS</p>
          <h1 className="mt-2 text-center text-3xl font-black sm:text-4xl">
            ZENKAI <span className="text-accent">Boosters</span>
          </h1>
          <p className="mt-3 max-w-md text-center text-sm text-muted-foreground">
            {CARDS_PER_BOOSTER} vraies cartes anime par booster. Choisis ton pack.
          </p>

          {phase === "idle" && (
            <div className="mt-8 grid w-full min-w-0 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <section className="min-w-0">
                <div className="flex flex-wrap items-center gap-4">
                  <h2 className="text-xl font-black sm:text-2xl">Choisis ton booster</h2>
                  <div role="group" aria-label="Filtrer les boosters" className="flex flex-wrap gap-2">
                    {([["free", "Gratuits"], ["zen", "Boosters Zen"], ["all", "Tous"]] as const).map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={packFilter === value} onClick={() => selectFilter(value)}
                        className={cn("rounded-full px-4 py-2 text-xs font-bold transition-colors", packFilter === value ? "bg-amber-400 text-black shadow-[0_0_20px_-6px_rgba(251,191,36,0.65)]" : "border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground")}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {packFilter !== "free" && (
                  <p className="mt-4 flex items-center gap-2 text-xs text-amber-400" role={localZenError ? "alert" : undefined}>
                    <Gem className="size-4" aria-hidden />
                    {localZenError ? "Solde local indisponible" : localZen === null ? "Chargement du solde…" : `${localZen.toLocaleString("fr-FR")} Zen disponibles (local)`}
                  </p>
                )}
                <div role="radiogroup" aria-label="Catégorie de booster" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
                  {PACKS.filter((p) => packFilter === "all" || (packFilter === "zen" ? p.id === "zenkai" : p.id !== "zenkai")).map((p) => (
                    <PackOption key={p.id} info={p} selected={pack === p.id} onSelect={() => {
                      setPack(p.id);
                      setIsPackChoiceOpen(true);
                    }} />
                  ))}
                </div>
              </section>
              <aside aria-label="Détails du booster" className="h-fit min-w-0 rounded-2xl border border-amber-400/15 bg-surface p-4 shadow-xl lg:sticky lg:top-24">
                <div className="flex items-center gap-3">
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg">
                    <BoosterArtwork src={PACK_ARTWORK_BY_PACK[pack]} alt={`Pochette ${packInfo.label}`} />
                  </div>
                  <div className="min-w-0"><h2 className="font-bold">{packInfo.label}</h2><p className="mt-1 text-xs text-muted-foreground">{packInfo.hint}</p></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/5 bg-black/20 p-3"><strong>{CARDS_PER_BOOSTER}</strong><p className="text-[10px] text-muted-foreground">cartes par booster</p></div>
                  <div className="rounded-xl border border-white/5 bg-black/20 p-3"><strong>{pack === "zenkai" ? "Taux ×10" : "Taux standard"}</strong><p className="text-[10px] text-muted-foreground">{pack === "zenkai" ? "Mythique & Transcendance" : "par carte"}</p></div>
                  <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                    <strong>{pack === "zenkai" || pityCount === null ? "—" : PITY_LIMIT - pityCount}</strong>
                    <p className="text-[10px] text-muted-foreground">{pack === "zenkai" ? "Garantie non définie" : "avant Mythique sûre"}</p>
                    {pack !== "zenkai" && pityCount !== null && <div role="progressbar" aria-label="Garantie Mythique" aria-valuemin={0} aria-valuemax={PITY_LIMIT} aria-valuenow={pityCount} className="mt-2 h-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-400" style={{ width: `${pityCount / PITY_LIMIT * 100}%` }} /></div>}
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/20 p-3"><strong>{stock ? `${stock.count}/${STOCK_CAP}` : "—"}</strong><p className="text-[10px] text-muted-foreground">{guest ? "stock non suivi" : "boosters en stock"}</p></div>
                </div>
                <div className="mt-4 [&>button]:w-full">
                  <BoosterPreviewDialog cards={cards} pack={pack} packLabel={packInfo.label} open={isPackPreviewOpen} onOpenChange={setIsPackPreviewOpen} ownedCardIds={ownedCardIds} ownershipError={previewCollection.isError} onRetryOwnership={() => { void previewCollection.refetch(); }} />
                </div>
                <div className="mt-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Chance par booster <span className="font-normal normal-case tracking-normal">· par carte</span></h3>
                  <ul className="mt-3 space-y-2">
                    {(["commune", "non_commune", "rare", "epique", "legendaire", "mythique", "transcendance"] as const).map((rarity) => {
                      const rate = effectiveDropRate(rarity, pack);
                      return <li key={rarity} className="grid grid-cols-[minmax(0,1fr)_minmax(40px,1fr)_auto] items-center gap-2 text-[10px]">
                        <span className="truncate text-muted-foreground">{RARITY[rarity].label}</span>
                        <span aria-hidden className="h-1 overflow-hidden rounded-full bg-white/10"><span className={cn("block h-full min-w-px rounded-full", RARITY[rarity].bg)} style={{ width: `${rate}%` }} /></span>
                        <span className="tabular-nums">{String(rate).replace(".", ",")} %</span>
                      </li>;
                    })}
                  </ul>
                </div>
                <div role="radiogroup" aria-label="Quantité de boosters" className="mt-4 flex gap-2">
                  {OPEN_COUNTS.map((n) => (
                    <Button key={n} role="radio" aria-checked={quantity === n} variant={quantity === n ? "hero" : "glass"} className="min-w-0 flex-1 px-1" onClick={() => setQuantity(n)}>{n}x</Button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
                  {[1, 10].map((count) => <Button key={count} size="lg" className="h-auto min-h-11 whitespace-normal px-2" disabled={!ready || busy} onClick={() => open(count)}>{pack === "zenkai" ? `Acheter x${count}` : `Ouvrir x${count}`}</Button>)}
                </div>
                <Button size="lg" className={cn("mt-3 h-auto min-h-11 w-full whitespace-normal rounded-full bg-amber-400 px-3 text-center font-bold text-black hover:bg-amber-300 sm:flex", quantity === 5 ? "flex" : "hidden")} disabled={!ready || busy} onClick={() => open(quantity)}>
                  {pack === "zenkai" ? `Acheter et ouvrir · ${(quantity * ZENKAI_BOOSTER_COST).toLocaleString("fr-FR")} Zen` : `Ouvrir · Gratuit${stock ? ` (${stock.count} restants)` : ""}`}
                </Button>
                {stock && <p className="mt-2 text-center text-xs text-muted-foreground"><Clock className="mr-1 inline size-3" />{stock.nextInMs === null ? "Stock plein" : `Prochain gratuit dans ${formatCountdown(stock.nextInMs)}`} · {game.data?.bonus_boosters ?? 0} bonus</p>}
                {game.data && Object.entries(game.data.reward_packs).filter(([, count]) => count > 0).map(([key, count]) => <Button key={key} variant="transcend" className="mt-2 w-full" disabled={busy} onClick={() => open(1, `reward:${key}`)}><Package /> {REWARD_LABELS[key]} ×{count}</Button>)}
                {pack === "zenkai" && <p className="mt-2 text-xs text-muted-foreground">Achat indisponible : les règles Zen doivent être ajoutées au serveur.</p>}
                {guest && <p className="mt-2 text-xs text-muted-foreground">Mode invité : tirages simulés, cartes non sauvegardées.</p>}
              </aside>
              <Dialog open={isPackChoiceOpen} onOpenChange={setIsPackChoiceOpen}>
                <DialogContent className="z-[999] border-amber-400/30 bg-slate-950">
                  <DialogHeader className="pr-8">
                    <DialogTitle>Ouvrir {packInfo.label}</DialogTitle>
                    <DialogDescription>
                      {!ready ? "Chargement de la session…" : pack === "zenkai" ? "L'achat en Zen nécessite une prise en charge côté serveur." : guest ? "Simulation invitée : les cartes ne sont pas sauvegardées." : "Boosters gratuits : le stock du compte connecté s'applique."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    {[1, 10].map((count) => (
                      <Button key={count} variant="hero" className="min-h-12" disabled={!ready || busy || pack === "zenkai"} onClick={() => {
                        setIsPackChoiceOpen(false);
                        void open(count, pack);
                      }}>
                        Ouvrir x{count} · {pack === "zenkai" ? `${(count * ZENKAI_BOOSTER_COST).toLocaleString("fr-FR")} Zen` : "Gratuit"}
                      </Button>
                    ))}
                    <Button type="button" variant="link" className="min-h-11" onClick={() => {
                      setIsPackChoiceOpen(false);
                      setIsPackPreviewOpen(true);
                    }}>Voir les cartes du pack</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </>
      )}

      {phase !== "idle" && guest && <p className="text-center text-xs text-muted-foreground">Simulation invitée : les cartes révélées ne sont pas sauvegardées.</p>}
      {phase !== "idle" && <section className={cn("opening-stage flex min-h-[350px] w-full items-center justify-center", phase === "opening" || phase === "tearing" ? "fixed inset-0 z-[1000] overflow-y-auto bg-background px-4" : "relative mt-0 bg-transparent")}>
        {(phase === "tearing" || phase === "reveal" || phase === "summary") && <OpeningAura rarity={tearBeam} stage={phase} />}
        {phase === "reveal" ? (
          <CardReveal
            cards={displayedPulled}
            awakened={awake}
            onAwaken={onAwaken}
            onDone={() => setPhase("summary")}
            backTheme={{ image: cardBack }}
          />
        ) : phase === "summary" ? (
          <Summary
            items={displayedPulled}
            opened={opened}
            awake={awake}
            onAwaken={onAwaken}
            best={best}
            signedIn={!!session}
            onReturnToBoosters={returnToBoosterSelection}
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
              <BoosterPack
                state={phase === "tearing" ? "tearing" : "opening"}
                accent={packInfo.accent}
                category={packInfo.label}
                artwork={PACK_ARTWORK_BY_PACK[pack]}
                backImage={cardBack}
                beam={tearBeam}
                onTear={requestTear}
              />
              {phase === "opening" && <p className="text-center text-xs text-muted-foreground">Appuie ou glisse horizontalement pour déchirer le booster, ou laisse l'animation continuer.</p>}
          </div>
        )}
      </section>}

    </div>
  );
}

function PackOption({ info, selected, onSelect }: { info: (typeof PACKS)[number]; selected: boolean; onSelect: () => void }) {
  const exclusive = info.id === "zenkai";
  return (
    <button type="button" role="radio" aria-label={info.label} aria-checked={selected} onClick={onSelect}
      className="group min-w-0 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
      <div className={cn("relative mx-auto aspect-[2/3] w-full overflow-hidden rounded-xl transition-transform duration-300 motion-safe:group-hover:[transform:perspective(900px)_rotateY(-4deg)_translateY(-4px)]", selected && "ring-2 ring-amber-400 shadow-[0_0_24px_-8px_rgba(251,191,36,0.7)]")}>
        <BoosterArtwork src={PACK_ARTWORK_BY_PACK[info.id]} alt={`Booster ${info.label}`} className="rounded-xl" />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-3 pt-8 text-sm font-bold text-white">{info.label}</span>
      </div>
      <span className={cn("mt-3 block text-xs font-semibold", exclusive ? "text-amber-400" : "text-muted-foreground")}>{exclusive ? "500 Zen" : "Gratuit"}</span>
      {exclusive && <span className="mt-1 block text-[10px] text-amber-300">Mythique &amp; Transcendance ×10</span>}
    </button>
  );
}

function Summary({
  items, opened, awake, onAwaken, best, signedIn, onReturnToBoosters,
}: {
  items: PulledCard[];
  opened: number;
  awake: Awake;
  onAwaken: (id: string, r: "transcended" | "failed") => void;
  best: Rarity | null;
  signedIn: boolean;
  onReturnToBoosters: () => void;
}) {
  return (
    <div className="relative flex w-full flex-col items-center">
      <Button variant="glass" className="mb-4 self-start" onClick={onReturnToBoosters}>← Boosters</Button>
      <h2 className="text-xl font-black sm:text-2xl">{opened === 1 ? "Récapitulatif" : `Récapitulatif — ${items.length} cartes`}</h2>
      {best && (
        <p className="mt-1 text-sm text-muted-foreground">
          Meilleure rareté : <span className={cn("font-semibold", RARITY[best].text)}>{RARITY[best].label}</span>
        </p>
      )}
      <div className="mx-auto mt-4 grid w-full max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {[...items].sort((a, b) => {
          const aRarity = a.transcended || a.customTranscendance || awake[a.userCardId] === "transcended" ? "transcendance" : a.card.rarity;
          const bRarity = b.transcended || b.customTranscendance || awake[b.userCardId] === "transcended" ? "transcendance" : b.card.rarity;
          return rarityRank(aRarity) - rarityRank(bRarity);
        }).map((p, i) => (
          <SummaryCard
            key={p.userCardId}
            item={p}
            delay={(i % CARDS_PER_BOOSTER) * 90}
            state={awake[p.userCardId]}
            onAwaken={onAwaken}
          />
        ))}
      </div>
      <Button variant="hero" size="lg" className="mt-6 rounded-full" onClick={onReturnToBoosters}>
        Retour aux boosters
      </Button>
      {signedIn && (
        <Link to="/collection" className="mt-6 text-sm font-semibold text-primary hover:underline">Voir ma collection</Link>
      )}
    </div>
  );
}

function SummaryCard({ item, delay, state, onAwaken }: { item: PulledCard; delay: number; state?: "transcended" | "failed" | undefined; onAwaken: (id: string, r: "transcended" | "failed") => void }) {
  const card: Card = item.card;
  return (
    <div className="relative flex animate-card-in flex-col items-center gap-2" style={{ animationDelay: `${delay}ms` }}>
      <InspectableCard card={card} transcended={state === "transcended" || item.transcended === true} customTranscendance={item.customTranscendance === true} />
      {item.isNew && <NewCardBadge />}
    </div>
  );
}
