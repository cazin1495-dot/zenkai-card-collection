import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Clock, Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/AnimeCard";
import { BoosterPack } from "@/components/BoosterPack";
import { CardReveal } from "@/components/CardReveal";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cardsQuery, profileQuery } from "@/lib/queries";
import {
  BOOSTER_COOLDOWN_MS,
  cooldownRemaining,
  formatCountdown,
  RARITY,
  RARITY_ORDER,
  type Card,
} from "@/lib/cards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Boosters — Zenkai" },
      {
        name: "description",
        content: "Ouvre un booster gratuit toutes les 10 minutes et découvre 3 cartes anime.",
      },
      { property: "og:title", content: "Boosters — Zenkai" },
      {
        property: "og:description",
        content: "Ouvre un booster gratuit toutes les 10 minutes et découvre 3 cartes anime.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(cardsQuery),
  component: BoostersPage,
});

const DROP_RATES: Record<string, string> = {
  commune: "60 %",
  rare: "27 %",
  epique: "10 %",
  legendaire: "3 %",
};

type Phase = "idle" | "opening" | "reveal" | "summary";

function BoostersPage() {
  const { data: cards } = useSuspenseQuery(cardsQuery);
  const { session, ready } = useAuth();
  const userId = session?.user.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useQuery({ ...profileQuery(userId ?? ""), enabled: !!userId });

  const [now, setNow] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pulled, setPulled] = useState<Card[]>([]);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = now === null ? 0 : cooldownRemaining(profile.data?.last_booster_at, now);
  const onCooldown = !!userId && remaining > 0;
  const busy = phase === "opening" || phase === "reveal" || (!!userId && profile.isLoading);

  async function openBooster() {
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    if (onCooldown || busy) return;

    setPhase("opening");
    const started = Date.now();
    const { data, error } = await supabase.rpc("open_booster");
    const wait = Math.max(0, 700 - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));

    if (error || !data?.length) {
      setPhase(pulled.length ? "summary" : "idle");
      if (error?.message.includes("cooldown_active")) {
        toast.error("Patience ! Ton prochain booster n'est pas encore prêt.");
      } else {
        toast.error("Impossible d'ouvrir le booster. Réessaie dans un instant.");
      }
      queryClient.invalidateQueries({ queryKey: ["profile", session.user.id] });
      return;
    }

    const byId = new Map(cards.map((c) => [c.id, c]));
    setPulled(data.map((row) => byId.get(row.card_id)).filter((c): c is Card => !!c));
    setPhase("reveal");

    const nextAt = data[0]?.next_booster_at;
    const openedAt = nextAt
      ? new Date(new Date(nextAt).getTime() - BOOSTER_COOLDOWN_MS).toISOString()
      : new Date().toISOString();
    queryClient.setQueryData(profileQuery(session.user.id).queryKey, (old) =>
      old ? { ...old, last_booster_at: openedAt } : old,
    );
    queryClient.invalidateQueries({ queryKey: ["collection", session.user.id] });
    queryClient.invalidateQueries({ queryKey: ["profile", session.user.id] });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const best = pulled.reduce<Card | null>(
    (acc, c) =>
      !acc || RARITY_ORDER.indexOf(c.rarity) < RARITY_ORDER.indexOf(acc.rarity) ? c : acc,
    null,
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
      {phase !== "idle" && phase !== "opening" && <h1 className="sr-only">Ouverture du booster</h1>}
      {(phase === "idle" || phase === "opening") && (
        <>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Gift className="size-3.5 text-primary" /> Un booster gratuit toutes les 10 minutes
          </p>
          <h1 className="text-center text-3xl font-black sm:text-5xl">
            Ouvre ton <span className="text-gradient-primary">booster</span>
          </h1>
          <p className="mt-3 max-w-md text-center text-sm text-muted-foreground">
            3 cartes au hasard. Trouveras-tu la légendaire ?
          </p>
        </>
      )}

      <section
        className={cn(
          "relative flex min-h-[440px] w-full items-center justify-center",
          phase === "idle" || phase === "opening" ? "mt-8" : "mt-0",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
        />
        {phase === "reveal" ? (
          <CardReveal cards={pulled} onDone={() => setPhase("summary")} />
        ) : phase === "summary" ? (
          <div className="relative flex w-full flex-col items-center">
            <h2 className="mb-5 text-xl font-black sm:text-2xl">Récapitulatif</h2>
            <div className="grid w-full max-w-2xl grid-cols-3 gap-3 sm:gap-6">
              {pulled.map((card, i) => (
                <div
                  key={`${card.id}-${i}`}
                  className="animate-card-in"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <AnimeCard card={card} />
                </div>
              ))}
            </div>
            {best && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Meilleure carte :{" "}
                <span className={cn("font-semibold", RARITY[best.rarity].text)}>
                  {best.name} ({RARITY[best.rarity].label})
                </span>
              </p>
            )}
            {session && (
              <Link
                to="/collection"
                className="mt-2 text-sm font-semibold text-primary hover:underline"
              >
                Voir ma collection
              </Link>
            )}
          </div>
        ) : (
          <BoosterPack shaking={phase === "opening"} />
        )}
      </section>

      <div className={cn("mt-8 flex flex-col items-center gap-3", phase === "reveal" && "hidden")}>
        <Button
          variant="hero"
          size="xl"
          onClick={openBooster}
          disabled={!ready || busy || onCooldown}
        >
          {onCooldown ? (
            <>
              <Clock /> Prochain booster dans {formatCountdown(remaining)}
            </>
          ) : phase === "opening" ? (
            <>
              <Sparkles className="animate-spin" /> Ouverture…
            </>
          ) : (
            <>
              <Gift /> Ouvrir un booster gratuit
            </>
          )}
        </Button>
        {ready && !session && (
          <p className="text-xs text-muted-foreground">
            Connecte-toi pour garder tes cartes dans ta collection.
          </p>
        )}
      </div>

      <ul className="mt-14 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {(["commune", "rare", "epique", "legendaire"] as const).map((r) => (
          <li
            key={r}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3"
          >
            <span className={cn("size-3 rounded-full", RARITY[r].bg, RARITY[r].glow)} />
            <div>
              <p className={cn("text-sm font-semibold", RARITY[r].text)}>{RARITY[r].label}</p>
              <p className="text-xs text-muted-foreground">{DROP_RATES[r]}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
