import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Clock, Layers, Package, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/AnimeCard";
import { BoosterPack } from "@/components/BoosterPack";
import { BoosterOdds } from "@/components/BoosterOdds";
import { OpeningAura } from "@/components/OpeningAura";
import { CardReveal } from "@/components/CardReveal";
import { TranscendButton } from "@/components/Transcendance";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cardsQuery, pityQuery, profileQuery } from "@/lib/queries";
import {
  bestRarity,
  boosterStock,
  CARDS_PER_BOOSTER,
  formatCountdown,
  OPEN_COUNTS,
  PACKS,
  RARITY,
  rarityRank,
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
  const { session, ready } = useAuth();
  const userId = session?.user.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useQuery({ ...profileQuery(userId ?? ""), enabled: !!userId });
  const pity = useQuery({ ...pityQuery(userId ?? ""), enabled: !!userId });

  const [now, setNow] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pack, setPack] = useState<PackId>("shonen");
  const [pulled, setPulled] = useState<PulledCard[]>([]);
  const [opened, setOpened] = useState(1);
  const [awake, setAwake] = useState<Awake>({});

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stock =
    profile.data && now !== null
      ? boosterStock(profile.data.boosters_stored, profile.data.stock_updated_at, now)
      : null;
  const busy = phase === "opening" || phase === "tearing" || phase === "reveal" || (!!userId && profile.isLoading);
  const packInfo = PACKS.find((p) => p.id === pack) ?? PACKS[0];
  if (!packInfo) return null;
  const best = bestRarity(pulled.map((p) => (awake[p.userCardId] === "transcended" ? "transcendance" : p.card.rarity)));

  async function open(count: number) {
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    if (busy || (stock && stock.count < count)) return;
    setPhase("opening");
    setPulled([]);
    setAwake({});
    const started = Date.now();
    const { data, error } = await supabase.rpc("open_boosters", { _category: pack, _count: count });
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

    const byId = new Map(cards.map((c) => [c.id, c]));
    const items = data
      .map((row) => ({ userCardId: row.user_card_id, card: byId.get(row.card_id) }))
      .filter((p): p is PulledCard => !!p.card);
    setPulled(items);
    setOpened(count);
    queryClient.setQueryData(profileQuery(session.user.id).queryKey, (old) =>
      old && data[0] ? { ...old, boosters_stored: data[0].boosters_left, stock_updated_at: data[0].stock_updated_at } : old,
    );
    queryClient.invalidateQueries({ queryKey: ["collection", session.user.id] });
    await queryClient.invalidateQueries({ queryKey: ["pity", session.user.id] });
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Show the actual draw's maximum aura before splitting the seam.
    await new Promise((r) => setTimeout(r, 600));
    setPhase("tearing");
    await new Promise((r) => setTimeout(r, 2000));
    setPhase(count === 1 ? "reveal" : "summary");
  }

  const tearBeam = useMemo(() => bestOpeningRarity(pulled.map((p) => p.card.rarity)), [pulled]);
  const onAwaken = (id: string, r: "transcended" | "failed") => setAwake((a) => ({ ...a, [id]: r }));

  return (
    <div className="booster-hub mx-auto flex max-w-6xl flex-col items-center px-4 pb-12 pt-6 sm:px-6">
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

          <div role="radiogroup" aria-label="Catégorie de booster" className="hub-pack-selector mt-5 grid w-full max-w-4xl grid-cols-3 gap-2 sm:grid-cols-6">
            {PACKS.map((p) => (
              <Button variant="ghost"
                key={p.id}
                role="radio"
                aria-checked={pack === p.id}
                disabled={busy}
                onClick={() => setPack(p.id)}
                className={cn(
                  "hub-pack-option block h-auto min-w-0 rounded-md border bg-foreground/5 px-2 py-2 text-left transition-all",
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

      <section className={cn("opening-stage relative flex min-h-[350px] w-full items-center justify-center", phase === "reveal" || phase === "summary" ? "mt-0" : "mt-2")}>
        {(phase === "tearing" || phase === "reveal" || phase === "summary") && <OpeningAura rarity={tearBeam} stage={phase} />}
        {phase === "reveal" ? (
          <CardReveal cards={pulled} awakened={awake} onAwaken={onAwaken} onDone={() => setPhase("summary")} />
        ) : phase === "summary" ? (
          <Summary items={pulled} opened={opened} awake={awake} onAwaken={onAwaken} best={best} signedIn={!!session} />
        ) : (
          <Button variant="ghost" aria-label="Ouvrir ce booster" disabled={!ready || busy || (!!stock && stock.count < 1)} onClick={() => open(1)} className="h-auto rounded-none p-0 hover:bg-transparent disabled:opacity-100">
          <BoosterPack
            state={phase === "tearing" ? "tearing" : phase === "opening" ? "opening" : "idle"}
            accent={packInfo.accent}
            beam={phase === "opening" || phase === "tearing" ? tearBeam : null}
          />
          </Button>
        )}
      </section>

      {phase !== "reveal" && <BoosterOdds counter={userId ? pity.data : 0} failed={!!userId && pity.isError} />}

      <div className={cn("mt-6 flex flex-col items-center gap-3", phase === "reveal" && "hidden")}>
        {session && stock && (
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground">
            <Package className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">{stock.count} / {STOCK_CAP}</span> boosters
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
              disabled={!ready || busy || (!!stock && stock.count < n)}
            >
              {phase === "opening" ? <Sparkles className="animate-spin" /> : <Layers />} Ouvrir x{n}
            </Button>
          ))}
        </div>
        {phase === "summary" && (
          <Button variant="link" size="sm" onClick={() => setPhase("idle")}>Changer de pack</Button>
        )}
        {ready && !session && <p className="text-xs text-muted-foreground">Connecte-toi pour ouvrir des boosters et garder tes cartes.</p>}
      </div>

    </div>
  );
}

function Summary({
  items, opened, awake, onAwaken, best, signedIn,
}: {
  items: PulledCard[];
  opened: number;
  awake: Awake;
  onAwaken: (id: string, r: "transcended" | "failed") => void;
  best: Rarity | null;
  signedIn: boolean;
}) {
  const rank = (p: PulledCard) => rarityRank(awake[p.userCardId] === "transcended" ? "transcendance" : p.card.rarity);
  const sorted = [...items].sort((a, b) => rank(a) - rank(b));
  const highlights = opened === 1 ? items : (sorted.filter((p) => rank(p) <= rarityRank("epique")).slice(0, 10).length ? sorted.filter((p) => rank(p) <= rarityRank("epique")).slice(0, 10) : sorted.slice(0, 5));

  return (
    <div className="relative flex w-full flex-col items-center">
      <h2 className="text-xl font-black sm:text-2xl">{opened === 1 ? "Récapitulatif" : `Récapitulatif — ${items.length} cartes`}</h2>
      {best && (
        <p className="mt-1 text-sm text-muted-foreground">
          Meilleure rareté : <span className={cn("font-semibold", RARITY[best].text)}>{RARITY[best].label}</span>
        </p>
      )}
      {opened > 1 && <h3 className="mt-6 text-sm font-bold uppercase tracking-widest text-muted-foreground">Meilleures cartes</h3>}
      <div className="mt-4 grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {highlights.map((p, i) => (
          <SummaryCard key={p.userCardId} item={p} delay={i * 90} state={awake[p.userCardId]} onAwaken={onAwaken} />
        ))}
      </div>
      {opened > 1 && (
        <>
          <h3 className="mt-10 text-sm font-bold uppercase tracking-widest text-muted-foreground">Tout le tirage</h3>
          <div className="mt-4 grid w-full max-w-5xl grid-cols-5 gap-2 sm:grid-cols-10">
            {sorted.map((p) => (
              <AnimeCard key={p.userCardId} card={p.card} compact transcended={awake[p.userCardId] === "transcended"} />
            ))}
          </div>
        </>
      )}
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
      <AnimeCard card={card} transcended={state === "transcended"} />
      {card.rarity === "mythique" && !state && (
        <TranscendButton size="xs" userCardId={item.userCardId} card={card} onResult={(r) => onAwaken(item.userCardId, r)} />
      )}
      {state === "failed" && <p className="text-[11px] text-muted-foreground">Éveil échoué</p>}
    </div>
  );
}
