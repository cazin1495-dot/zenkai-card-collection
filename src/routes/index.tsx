import { addGuestCollectionCards } from "@/lib/guest-collection";
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
import { cardsQuery, pityQuery, profileQuery } from "@/lib/queries";
import { createLocalGuestDraw } from "@/lib/guest";
import { getGuestState, updateGuestState } from "@/lib/guest-collection";
import { recordBoosterOpen, recordSecretDraw } from "@/lib/quests";
import { getGuestBalance, getGuestCollection } from "@/lib/guest-collection";
import { markNewBoosterCards, sortBoosterCardsByRarity } from "@/lib/booster-order";
import {
  bestRarity,
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
  const guestCollection = useQuery({
    queryKey: ["guest-collection"],
    queryFn: getGuestCollection,
    enabled: ready && isPackPreviewOpen,
    staleTime: 0,
    retry: false,
  });
  const ownedCardIds = ready && !guestCollection.isFetching && !guestCollection.isError && guestCollection.data
    ? new Set(guestCollection.data.map((row) => row.card_id))
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
    if (!isPackPreviewOpen || !ready) return;
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["guest-collection"] }); };
    window.addEventListener("zenkai:guest-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("zenkai:guest-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [isPackPreviewOpen, ready, queryClient]);

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

  
  const MAX_BETA_BOOSTERS = 15;
  const REGEN_SECONDS = 600;
  const [betaBoosters, setBetaBoosters] = useState<number>(() => {
    try {
      const raw = localStorage.getItem("zenkai_beta_boosters_v1");
      if (!raw) return MAX_BETA_BOOSTERS;
      const parsed = JSON.parse(raw);
      let count = typeof parsed.count === "number" ? parsed.count : MAX_BETA_BOOSTERS;
      let updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now();
      if (count < MAX_BETA_BOOSTERS) {
        const elapsed = Math.floor((Date.now() - updatedAt) / 1000);
        const gained = Math.floor(elapsed / REGEN_SECONDS);
        if (gained > 0) {
          count = Math.min(MAX_BETA_BOOSTERS, count + gained);
          updatedAt = count >= MAX_BETA_BOOSTERS ? Date.now() : updatedAt + gained * REGEN_SECONDS * 1000;
          localStorage.setItem("zenkai_beta_boosters_v1", JSON.stringify({ count, updatedAt }));
        }
      }
      return count;
    } catch { return MAX_BETA_BOOSTERS; }
  });
  const [nextBoosterSec, setNextBoosterSec] = useState<number>(0);

  useEffect(() => {
    const syncTimer = () => {
      try {
        const raw = localStorage.getItem("zenkai_beta_boosters_v1");
        if (!raw) {
          localStorage.setItem("zenkai_beta_boosters_v1", JSON.stringify({ count: MAX_BETA_BOOSTERS, updatedAt: Date.now() }));
          setBetaBoosters(MAX_BETA_BOOSTERS);
          setNextBoosterSec(0);
          return;
        }
        const parsed = JSON.parse(raw);
        let count = typeof parsed.count === "number" ? parsed.count : MAX_BETA_BOOSTERS;
        let updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now();
        if (count >= MAX_BETA_BOOSTERS) {
          setBetaBoosters(MAX_BETA_BOOSTERS);
          setNextBoosterSec(0);
          return;
        }
        const elapsed = Math.floor((Date.now() - updatedAt) / 1000);
        const gained = Math.floor(elapsed / REGEN_SECONDS);
        if (gained > 0) {
          count = Math.min(MAX_BETA_BOOSTERS, count + gained);
          updatedAt = count >= MAX_BETA_BOOSTERS ? Date.now() : updatedAt + gained * REGEN_SECONDS * 1000;
          localStorage.setItem("zenkai_beta_boosters_v1", JSON.stringify({ count, updatedAt }));
        }
        setBetaBoosters(count);
        if (count >= MAX_BETA_BOOSTERS) {
          setNextBoosterSec(0);
        } else {
          const rem = Math.max(1, REGEN_SECONDS - Math.floor((Date.now() - updatedAt) / 1000));
          setNextBoosterSec(rem);
        }
      } catch {}
    };
    syncTimer();
    const id = window.setInterval(syncTimer, 1000);
    return () => window.clearInterval(id);
  }, []);

  async function open(count: number, category: string = pack) {
    if (busy) return;
    const isZenkaiPack = category === "zenkai";
    const zenkaiCost = count * ZENKAI_BOOSTER_COST;
    if (isZenkaiPack) {
      if (getGuestState().zen < zenkaiCost) {
        toast.error(`Il te faut ${zenkaiCost.toLocaleString("fr-FR")} Zen pour ouvrir x${count} Booster Zenkai.`);
        return;
      }
    } else if (betaBoosters < count) {
      toast.error(`Stock insuffisant (${betaBoosters} / ${MAX_BETA_BOOSTERS} boosters). Attends le timer !`);
      return;
    }
    if (!session && !guest) {
      navigate({ to: "/auth" });
      return;
    }
    const localPack = PACKS.find((item) => item.id === category);
    if (!localPack) {
      toast.error("Ce type de booster n’est pas disponible.");
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
      toast.error(error instanceof Error ? error.message : "Tirage local impossible.");
      return;
    }
    if (!localDraw.length) {
      toast.error("Aucune carte disponible dans ce pack pour le tirage local.");
      return;
    }
    try {
      addGuestCollectionCards(localDraw);
    } catch (error) {
      toast.error(error instanceof Error
        ? `Sauvegarde de la collection impossible : ${error.message}`
        : "Sauvegarde de la collection impossible.");
      return;
    }
    try {
      if (isZenkaiPack) {
        updateGuestState((state) => {
          if (state.zen < zenkaiCost) throw new Error("Solde Zen insuffisant.");
          return { state: { ...state, zen: state.zen - zenkaiCost }, result: true };
        });
      } else {
        const raw = localStorage.getItem("zenkai_beta_boosters_v1");
      const parsed = raw ? JSON.parse(raw) : { count: MAX_BETA_BOOSTERS, updatedAt: Date.now() };
      const nextCount = Math.max(0, betaBoosters - count);
      const nextUpdatedAt = betaBoosters >= MAX_BETA_BOOSTERS ? Date.now() : (parsed.updatedAt || Date.now());
      localStorage.setItem("zenkai_beta_boosters_v1", JSON.stringify({ count: nextCount, updatedAt: nextUpdatedAt }));
      setBetaBoosters(nextCount);
      if (betaBoosters >= MAX_BETA_BOOSTERS) setNextBoosterSec(REGEN_SECONDS);
      }
    } catch (error) {
      toast.error(error instanceof Error
        ? `Cartes sauvegardées, mais stock local indisponible : ${error.message}`
        : "Cartes sauvegardées, mais stock local indisponible.");
    }
    try {
      recordBoosterOpen(null, count, ownedIdsBeforeOpen, localDraw.map((item) => item.card.id));
      recordSecretDraw(count, localDraw);
    } catch {
      toast.error("Tirage sauvegardé, mais progression des missions et succès locaux indisponible.");
    }

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
    void queryClient.invalidateQueries({ queryKey: ["guest-collection"] });
    setOpened(count);
    const prevXp = Number(localStorage.getItem("zenkai_beta_xp") || "0");
    localStorage.setItem("zenkai_beta_xp", String(prevXp + count * 15));
    const prevOp = Number(localStorage.getItem("zenkai_beta_opened") || "0");
    localStorage.setItem("zenkai_beta_opened", String(prevOp + count));
    window.scrollTo({ top: 0, behavior: "smooth" });
    await revealAfterOpening();
  }

  async function returnToBoosterSelection() {
    setPulled([]);
    setAwake({});
    setOpened(1);
    setPhase("idle");

    setReturningToBoosters(true);
    try {
      const updates = [queryClient.invalidateQueries({ queryKey: ["guest-collection"] })];
      if (userId) {
        updates.push(
          queryClient.invalidateQueries({ queryKey: profileQuery(userId).queryKey }),
          queryClient.invalidateQueries({ queryKey: ["game", userId] }),
          queryClient.invalidateQueries({ queryKey: ["pity", userId] }),
        );
      }
      await Promise.all(updates);
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
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-200 shadow-sm">
        <span>🎴 {betaBoosters} / {MAX_BETA_BOOSTERS} boosters</span>
        {betaBoosters < MAX_BETA_BOOSTERS ? (
          <span className="text-amber-300/90">
            • ⏳ +1 dans {String(Math.floor(nextBoosterSec / 60)).padStart(2, "0")}:{String(nextBoosterSec % 60).padStart(2, "0")}
          </span>
        ) : (
          <span className="text-emerald-300/90">• Stock max (1 booster / 10 min)</span>
        )}
      </div>

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
                  <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                    <strong>{betaBoosters}/{MAX_BETA_BOOSTERS}</strong>
                    <p className="text-[10px] text-muted-foreground">boosters en stock</p>
                    {betaBoosters < MAX_BETA_BOOSTERS && <p className="mt-1 text-[10px] text-muted-foreground">+1 dans {formatCountdown(nextBoosterSec * 1000)}</p>}
                  </div>
                </div>
                <div className="mt-4 [&>button]:w-full">
                  <BoosterPreviewDialog cards={cards} pack={pack} packLabel={packInfo.label} open={isPackPreviewOpen} onOpenChange={setIsPackPreviewOpen} ownedCardIds={ownedCardIds} ownershipError={guestCollection.isError} onRetryOwnership={() => { void guestCollection.refetch(); }} />
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
                  {pack === "zenkai" ? `Acheter et ouvrir · ${(quantity * ZENKAI_BOOSTER_COST).toLocaleString("fr-FR")} Zen` : `Ouvrir · Gratuit${profile.data ? ` (${betaBoosters} restants)` : ""}`}
                </Button>
                {profile.data && <p className="mt-2 text-center text-xs text-muted-foreground"><Clock className="mr-1 inline size-3" />{betaBoosters >= MAX_BETA_BOOSTERS ? "Stock plein" : `Prochain gratuit dans ${formatCountdown(nextBoosterSec * 1000)}`} · {game.data?.bonus_boosters ?? 0} bonus</p>}
                {game.data && Object.entries(game.data.reward_packs).filter(([, count]) => count > 0).map(([key, count]) => <Button key={key} variant="transcend" className="mt-2 w-full" disabled={busy} onClick={() => open(1, `reward:${key}`)}><Package /> {REWARD_LABELS[key]} ×{count}</Button>)}
                {pack === "zenkai" && <p className="mt-2 text-xs text-muted-foreground">Achat indisponible : les règles Zen doivent être ajoutées au serveur.</p>}
                {guest && <p className="mt-2 text-xs text-muted-foreground">Mode invité : tirages simulés, cartes sauvegardées dans la collection locale.</p>}
              </aside>
              <Dialog open={isPackChoiceOpen} onOpenChange={setIsPackChoiceOpen}>
                <DialogContent className="z-[999] border-amber-400/30 bg-slate-950">
                  <DialogHeader className="pr-8">
                    <DialogTitle>Ouvrir {packInfo.label}</DialogTitle>
                    <DialogDescription>
                      {!ready ? "Chargement de la session…" : pack === "zenkai" ? "Taux doublés sur tout le catalogue · Paiement en Zen." : "Tirages locaux sauvegardés dans cette collection."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    {[1, 5, 10].map((count) => (
                      <Button key={count} variant="hero" className="min-h-12" disabled={!ready || busy || pack === "zenkai"} onClick={() => {
                        setIsPackChoiceOpen(false);
                        void open(count);
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

      {phase !== "idle" && <p className="text-center text-xs text-muted-foreground">Tirage local sauvegardé dans ta collection.</p>}
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
