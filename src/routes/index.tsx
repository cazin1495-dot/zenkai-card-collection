import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Clock, Layers, Package, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BoosterPack } from "@/components/BoosterPack";
import { BoosterArtwork } from "@/components/BoosterArtwork";
import { BoosterOdds } from "@/components/BoosterOdds";
import { BoosterPreviewDialog } from "@/components/BoosterPreviewDialog";
import { OpeningAura } from "@/components/OpeningAura";
import { CardReveal } from "@/components/CardReveal";
import { InspectableCard } from "@/components/Transcendance";
import { gameQuery } from "@/lib/game";
import { REWARD_LABELS } from "@/lib/economy";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cardsQuery, pityQuery, profileQuery } from "@/lib/queries";
import { createLocalGuestDraw } from "@/lib/guest";
import { sortBoosterCardsByRarity } from "@/lib/booster-order";
import {
  bestRarity,
  boosterStock,
  CARDS_PER_BOOSTER,
  formatCountdown,
  OPEN_COUNTS,
  PACK_ARTWORK,
  PACKS,
  RARITY,
  STOCK_CAP,
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

function BoostersPage() {
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
  const [isPackPreviewOpen, setIsPackPreviewOpen] = useState(false);
  const [pulled, setPulled] = useState<PulledCard[]>([]);
  const [opened, setOpened] = useState(1);
  const [awake, setAwake] = useState<Awake>({});
  const [returningToBoosters, setReturningToBoosters] = useState(false);

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
    returningToBoosters ||
    (!!userId && profile.isLoading);
  const packInfo = PACKS.find((p) => p.id === pack) ?? PACKS[0];
  if (!packInfo) return null;
  const best = bestRarity(
    pulled.map((p) =>
      awake[p.userCardId] === "transcended" || p.transcended || p.customTranscendance ? "transcendance" : p.card.rarity,
    ),
  );

  async function open(count: number, category: string = pack) {
    if (busy) return;
    if (!session) {
      if (!guest) {
        navigate({ to: "/auth" });
        return;
      }
      const localPack = PACKS.find((item) => item.id === category);
      if (!localPack) {
        toast.error("Ce type de booster n’est pas disponible en mode Invité.");
        return;
      }
      const localDraw = sortBoosterCardsByRarity(createLocalGuestDraw(cards, localPack.id, count));
      if (!localDraw.length) {
        toast.error("Aucune carte disponible dans ce pack pour le tirage local.");
        return;
      }

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
      await new Promise((resolve) => setTimeout(resolve, 600));
      setPhase("tearing");
      await new Promise((resolve) => setTimeout(resolve, 1800));
      setPhase(count === 1 ? "reveal" : "summary");
      return;
    }
    if (stock && stock.count + (game.data?.bonus_boosters ?? 0) < count && !category.startsWith("reward:")) return;
    setPhase("opening");
    setPulled([]);
    setAwake({});
    const started = Date.now();
    const { data, error } = await supabase.rpc("open_boosters", { _category: category, _count: count });
    await new Promise((r) => setTimeout(r, Math.max(0, 600 - (Date.now() - started))));

    if (error || !data?.length) {
      setPhase(pulled.length ? "summary" : "idle");
      toast.error(
        error?.message.includes("not_enough_boosters")
          ? "Pas assez de boosters en stock."
          : "Impossible d'ouvrir le booster. Réessaie dans un instant.",
      );
      queryClient.invalidateQueries({ queryKey: ["profile", session.user.id] });
      return;
    }

    const { data: copyStates, error: copyStatesError } = await supabase
      .from("user_cards")
      .select("id, transcended")
      .eq("user_id", session.user.id)
      .in("id", data.map((row) => row.user_card_id));
    if (copyStatesError || copyStates.length !== data.length) {
      setPhase("idle");
      toast.error(
        copyStatesError
          ? `Booster ouvert, mais l’état des cartes n’a pas pu être chargé : ${copyStatesError.message}`
          : "Booster ouvert, mais l’état de certaines cartes n’a pas pu être chargé.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", session.user.id] }),
        queryClient.invalidateQueries({ queryKey: ["collection", session.user.id] }),
        queryClient.invalidateQueries({ queryKey: ["game", session.user.id] }),
        queryClient.invalidateQueries({ queryKey: ["pity", session.user.id] }),
      ]);
      return;
    }

    const transcendedIds = new Set(copyStates.filter((copy) => copy.transcended).map((copy) => copy.id));
    const byId = new Map(cards.map((c) => [c.id, c]));
    const items = sortBoosterCardsByRarity(
      data
        .map((row) => {
          const card = byId.get(row.card_id);
          if (!card) return null;
          return {
            userCardId: row.user_card_id,
            card,
            ...(transcendedIds.has(row.user_card_id) ? { transcended: true } : {}),
          };
        })
        .filter((item): item is PulledCard => item !== null),
    );
    setAwake(Object.fromEntries(items.filter((item) => item.transcended).map((item) => [item.userCardId, "transcended" as const])));
    setPulled(items);
    setOpened(count);
    queryClient.setQueryData(profileQuery(session.user.id).queryKey, (old) =>
      old && data[0] ? { ...old, boosters_stored: data[0].boosters_left, stock_updated_at: data[0].stock_updated_at } : old,
    );
    queryClient.invalidateQueries({ queryKey: ["collection", session.user.id] });
    queryClient.invalidateQueries({ queryKey: ["game", session.user.id] });
    await queryClient.invalidateQueries({ queryKey: ["pity", session.user.id] });
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Show the actual draw's maximum aura before splitting the seam.
    await new Promise((r) => setTimeout(r, 600));
    setPhase("tearing");
    await new Promise((r) => setTimeout(r, 1800));
    setPhase(count === 1 ? "reveal" : "summary");
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

  const tearBeam = useMemo(
    () => bestOpeningRarity(pulled.map((p) => (p.transcended || p.customTranscendance ? "transcendance" : p.card.rarity))),
    [pulled],
  );
  const onAwaken = (id: string, r: "transcended" | "failed") => setAwake((a) => ({ ...a, [id]: r }));

  return (
    <div className="booster-hub mx-auto flex max-w-[100vw] flex-col items-center overflow-x-hidden px-4 pb-12 pt-6 sm:px-6">
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

          <div role="radiogroup" aria-label="Catégorie de booster" className="hub-pack-selector mt-5 flex w-full max-w-full flex-wrap justify-center gap-2">
            {PACKS.map((p) => (
              <Button variant="ghost"
                key={p.id}
                role="radio"
                aria-checked={pack === p.id}
                disabled={busy}
                onClick={() => setPack(p.id)}
                className={cn(
                  "hub-pack-option block h-auto flex-1 basis-28 rounded-md border bg-foreground/5 px-2 py-2 text-left transition-all",
                  pack === p.id ? "border-[var(--accent)] bg-surface-raised" : "border-border opacity-70 hover:opacity-100",
                )}
                style={{ ["--accent" as string]: p.accent, boxShadow: pack === p.id ? `0 0 24px -6px ${p.accent}` : undefined }}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold sm:text-xs">
                  <span className="size-2.5 rounded-full" style={{ background: p.accent }} /> {p.label}
                </span>
                <span className="mt-1 block truncate text-[9px] text-muted-foreground">{p.hint}</span>
              </Button>
            ))}
          </div>
        </>
      )}

      <section className={cn("opening-stage relative flex min-h-[350px] w-full items-center justify-center bg-transparent", phase === "reveal" || phase === "summary" ? "mt-0" : "mt-2")}>
        {(phase === "tearing" || phase === "reveal" || phase === "summary") && <OpeningAura rarity={tearBeam} stage={phase} />}
        {phase === "reveal" ? (
          <CardReveal
            cards={pulled}
            awakened={awake}
            onAwaken={onAwaken}
            onDone={() => setPhase("summary")}
            backTheme={{ image: "/image_39f4fe98.jpg" }}
          />
        ) : phase === "summary" ? (
          <Summary
            items={pulled}
            opened={opened}
            awake={awake}
            onAwaken={onAwaken}
            best={best}
            signedIn={!!session}
            onReturnToBoosters={returnToBoosterSelection}
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            {phase === "idle" ? (
              <div
                className="group flex w-48 flex-col items-center justify-center"
                style={{ ["--accent" as string]: packInfo.accent }}
              >
                <span className="pack-category-badge pack-category-badge-flow mt-6 mb-4">
                  {packInfo.label}
                </span>
                <div className="mx-auto h-80 w-48 overflow-hidden rounded-xl">
                  <BoosterArtwork
                    src={PACK_ARTWORK}
                    alt={`Booster ${packInfo.label}`}
                    className="h-full w-full scale-[1.22] rounded-xl object-cover drop-shadow-[0_15px_35px_rgba(168,85,247,0.35)] transition-transform duration-300 group-hover:scale-[1.26] group-active:scale-[1.22]"
                  />
                </div>
              </div>
            ) : (
              <BoosterPack
                state={phase === "tearing" ? "tearing" : "opening"}
                accent={packInfo.accent}
                category={packInfo.label}
                artwork={PACK_ARTWORK}
                beam={tearBeam}
              />
            )}
            <Button
              variant="ghost"
              aria-label="Ouvrir le Booster"
              disabled={
                !ready || busy || (!!stock && stock.count + (game.data?.bonus_boosters ?? 0) < 1)
              }
              onClick={() => open(1)}
              className="opening-pack-button mt-6 flex-col gap-3 h-auto rounded-none p-0 hover:bg-transparent disabled:opacity-100"
              style={{ ["--accent" as string]: packInfo.accent }}
            >
              <span className="rounded-full border border-[var(--accent)] bg-surface/80 px-5 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-[0_0_20px_-8px_var(--accent)]">
                Ouvrir le Booster
              </span>
            </Button>
            {phase === "idle" && (
              <BoosterPreviewDialog
                cards={cards}
                pack={pack}
                packLabel={packInfo.label}
                open={isPackPreviewOpen}
                onOpenChange={setIsPackPreviewOpen}
              />
            )}
          </div>
        )}
      </section>

      {phase !== "reveal" && <BoosterOdds counter={userId ? pity.data : 0} failed={!!userId && pity.isError} />}

      <div className={cn("mt-6 flex flex-col items-center gap-3", phase === "reveal" && "hidden")}>
        {session && stock && (
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground">
            <Package className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">{stock.count} / {STOCK_CAP}</span> boosters gratuits · {game.data?.bonus_boosters ?? 0} bonus
            <span aria-hidden>·</span>
            {stock.nextInMs === null ? "Stock plein" : (<><Clock className="size-3.5" /> +1 dans {formatCountdown(stock.nextInMs)}</>)}
          </p>
        )}
        {phase === "summary" && <p className="text-xs text-muted-foreground">Pack sélectionné : {packInfo.label}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          {OPEN_COUNTS.map((n) => (
            <Button
              key={n}
              variant={n === 1 ? "hero" : "glass"}
              size="lg"
              className="rounded-full"
              onClick={() => open(n)}
              disabled={!ready || busy || (!!stock && stock.count + (game.data?.bonus_boosters ?? 0) < n)}
            >
              {phase === "opening" ? <Sparkles className="animate-spin" /> : <Layers />} Ouvrir x{n}
            </Button>
          ))}
        </div>
        {game.data && Object.entries(game.data.reward_packs).filter(([, count]) => count > 0).map(([key, count]) => <Button key={key} variant="transcend" disabled={busy} onClick={() => open(1, `reward:${key}`)}><Package /> {REWARD_LABELS[key]} ×{count}</Button>)}
        {ready && !session && (
          <p className="text-xs text-muted-foreground">
            {guest
              ? "Mode Invité local : tirages simulés, cartes non sauvegardées."
              : "Connecte-toi pour ouvrir des boosters et garder tes cartes."}
          </p>
        )}
      </div>

    </div>
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
      <h2 className="text-xl font-black sm:text-2xl">{opened === 1 ? "Récapitulatif" : `Récapitulatif — ${items.length} cartes`}</h2>
      {best && (
        <p className="mt-1 text-sm text-muted-foreground">
          Meilleure rareté : <span className={cn("font-semibold", RARITY[best].text)}>{RARITY[best].label}</span>
        </p>
      )}
      <div className="mx-auto mt-4 grid w-full max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {items.map((p, i) => (
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
    <div className="flex animate-card-in flex-col items-center gap-2" style={{ animationDelay: `${delay}ms` }}>
      <InspectableCard card={card} transcended={state === "transcended"} customTranscendance={item.customTranscendance === true} />
    </div>
  );
}
