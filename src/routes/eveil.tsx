import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Gift, Trophy, Clock, Coins, Package, Recycle, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { gameQuery, type GameState } from "@/lib/game";
import { MAX_LEVEL, MILESTONES, xpRequired, REWARD_LABELS } from "@/lib/economy";
import { formatCountdown } from "@/lib/cards";
import { LocalLevel } from "@/components/LocalLevel";
import { MissionsPanel } from "@/components/MissionsPanel";

export const Route = createFileRoute("/eveil")({
  head: () => ({ meta: [
    { title: "Missions & Niveaux — ZENKAI" },
    { name: "description", content: "Réclame tes missions et succès, gagne des Zen locaux et progresse en XP." },
    { property: "og:title", content: "Missions & Niveaux — ZENKAI" },
    { property: "og:description", content: "Tes récompenses quotidiennes et les dix paliers de progression ZENKAI." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: MissionsPage,
});

function MissionsPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const game = useQuery({ ...gameQuery(userId), enabled: !!session, refetchInterval: 30_000 });
  const [pending, setPending] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const state = game.data;
  const missions = [
    { id: "login", title: "Se connecter", icon: LogIn, progress: session ? 1 : 0, goal: 1, reward: "+100 Coins" },
    { id: "open", title: "Ouvrir 3 boosters", icon: Package, progress: state?.mission_opened ?? 0, goal: 3, reward: "+30 XP · +50 Coins" },
    { id: "recycle", title: "Recycler 2 doublons", icon: Recycle, progress: state?.mission_recycled ?? 0, goal: 2, reward: "+25 XP · +50 Coins" },
  ];
  async function claim(id: string) {
    if (pending) return;
    setPending(id);
    try {
      const { data, error } = await supabase.rpc("claim_mission", { _mission: id });
      if (error) throw error;
      queryClient.setQueryData(gameQuery(userId).queryKey, data as unknown as GameState);
      toast.success("Récompense ajoutée à ton profil.");
    } catch { toast.error("Cette récompense n’est pas disponible. Actualise tes missions."); await game.refetch(); }
    finally { setPending(null); }
  }
  const remaining = state && now !== null ? Math.max(0, new Date(state.mission_started_at).getTime() + 86400000 - now) : null;
  const xpGoal = xpRequired(state?.level ?? 1);
  return <div className="game-page mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <p className="game-eyebrow"><Trophy className="size-4" /> PROGRESSION DU JOUEUR</p>
    <h1 className="mt-3 text-3xl font-black sm:text-4xl">Missions & Niveaux</h1>
    <section aria-label="Profil local" className="mt-6 rounded-xl border border-amber-400/25 bg-violet-950/20 p-5"><LocalLevel /></section>
    <MissionsPanel accountId={session?.user.id ?? null} />
    <details className="mt-10 border-t border-border pt-5">
    <summary className="cursor-pointer text-lg font-bold">Progression et missions du compte en ligne</summary>
    <p className="mt-2 text-sm text-muted-foreground">Cette progression serveur, ses Coins et ses récompenses sont distincts du niveau, des missions et des Zen locaux ci-dessus.</p>
    {!session && <Button variant="hero" className="mt-6" asChild><Link to="/auth">Connexion</Link></Button>}
    {game.isError && <div role="alert" className="mt-5 flex items-center gap-3 text-sm text-destructive">Le profil n’a pas pu être chargé.<Button variant="glass" size="sm" onClick={() => game.refetch()}>Réessayer</Button></div>}
    {session && !state && !game.isError && <p className="mt-6 text-sm text-muted-foreground">Chargement du profil…</p>}
    {state && <section className="mt-7 border-y border-border py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs uppercase text-muted-foreground">{state.username}</p><h2 className="mt-2 font-display text-2xl font-bold">Niveau {state.level}<span className="ml-2 text-sm text-muted-foreground">/ {MAX_LEVEL}</span></h2></div>
        <div className="flex items-center gap-5 text-sm font-semibold"><span className="flex items-center gap-2 text-rarity-legendaire"><Coins className="size-4" />{state.coins.toLocaleString("fr-FR")}</span><span className="flex items-center gap-2 text-accent"><Package className="size-4" />{state.bonus_boosters} bonus</span></div>
      </div>
      <div role="progressbar" aria-label="Progression XP" aria-valuemin={0} aria-valuemax={xpGoal} aria-valuenow={Math.min(state.xp, xpGoal)} className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gradient-primary transition-all" style={{ width: `${state.level === MAX_LEVEL ? 100 : Math.min(100, state.xp / xpGoal * 100)}%` }} /></div>
      <p className="mt-2 text-xs text-muted-foreground">{state.level === MAX_LEVEL ? "Divinité Zenkai · Niveau maximum" : `${state.xp.toLocaleString("fr-FR")} / ${xpGoal.toLocaleString("fr-FR")} XP`}</p>
    </section>}
    <section className="py-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Missions quotidiennes</h2><p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="size-3.5" />Reset dans {remaining === null ? "24 h" : formatCountdown(remaining)}</p></div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">{missions.map(mission => {
        const claimed = state?.mission_claims.includes(mission.id) ?? false;
        return <div key={mission.id} className="rounded-md border border-border bg-foreground/5 p-5">
          <mission.icon className="size-5 text-accent" /><h3 className="mt-4 text-sm font-semibold">{mission.title}</h3><p className="mt-2 text-xs font-semibold text-rarity-legendaire">{mission.reward}</p>
          <div className="mt-4 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{Math.min(mission.goal, mission.progress)} / {mission.goal}</span><Button variant={claimed ? "ghost" : "glass"} size="sm" disabled={!state || !!pending || claimed || mission.progress < mission.goal} onClick={() => claim(mission.id)}>{claimed ? <><Check className="size-3" />Reçue</> : pending === mission.id ? "En cours…" : "Réclamer"}</Button></div>
        </div>;
      })}</div>
      <div className="mt-5 flex items-center gap-3 border-b border-border pb-6 text-sm"><Gift className="size-5 text-rarity-legendaire" /><span>3 missions terminées · <strong>+1 Booster gratuit</strong></span><span className="ml-auto text-xs text-muted-foreground">{state?.mission_claims.length ?? 0} / 3</span></div>
    </section>
    {state && Object.values(state.reward_packs).some(count => count > 0) && <section className="pb-8"><h2 className="text-xl font-bold">Récompenses disponibles</h2><div className="mt-4 flex flex-wrap gap-3">{Object.entries(state.reward_packs).filter(([, count]) => count > 0).map(([key, count]) => <Button key={key} variant="transcend" asChild><Link to="/">{REWARD_LABELS[key]} ×{count}<Package className="size-4" /></Link></Button>)}</div></section>}
    <section className="border-t border-border py-8"><h2 className="text-xl font-bold">Les 10 paliers majeurs</h2><p className="mt-2 text-xs text-muted-foreground">Niveau classique · +100 Coins et +1 Booster</p><div className="mt-5 grid gap-x-8 sm:grid-cols-2">{MILESTONES.map(([level, title, reward]) => <div key={level} className="flex items-start gap-4 border-b border-border py-5"><span className={`grid size-11 shrink-0 place-items-center rounded-md border border-border text-sm font-bold ${state && state.level >= level ? "bg-accent text-accent-foreground" : "bg-foreground/5 text-muted-foreground"}`}>{level}</span><div className="min-w-0"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reward}</p></div>{state && state.level >= level && <Check className="ml-auto size-4 shrink-0 text-accent" />}</div>)}</div></section>
    </details>
  </div>;
}