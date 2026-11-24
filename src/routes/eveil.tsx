import { updateGuestState } from "@/lib/guest-collection";
import { syncDailyMissionDay } from "@/lib/game";
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Gift, Trophy, Clock, Coins, Package, Recycle, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePlayerProfileUsername } from "@/hooks/use-player-profile-username";
import { supabase } from "@/integrations/supabase/client";
import { gameQuery, onlineMissionQuery, parseOnlineGameState, type GameState } from "@/lib/game";
import { MAX_LEVEL, MILESTONES, xpRequired, REWARD_LABELS } from "@/lib/economy";
import { formatCountdown } from "@/lib/cards";
import { LocalLevel } from "@/components/LocalLevel";
import { MissionsPanel } from "@/components/MissionsPanel";
import { useQuests } from "@/hooks/use-quests";
import { availableQuestCount, claimAllQuests } from "@/lib/quests";

function safeLocalGet(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function addLocalMissionXp(amount: number) {
  if (typeof window === "undefined" || amount <= 0) return;
  const key = "zenkai_guest_xp_v1";
  const prev = Number(localStorage.getItem(key) || "0");
  localStorage.setItem(key, String(prev + amount));
  window.dispatchEvent(new Event("zenkai-guest-updated"));
}
export const Route = createFileRoute("/eveil")({
  head: () => ({ meta: [
    { title: "Missions & Niveaux — ZENKAI" },
    { name: "description", content: "Réclame tes missions et succès, gagne des Zen locaux et progresse en XP." },
    { property: "og:title", content: "Missions & Niveaux — ZENKAI" },
    { property: "og:description", content: "Tes récompenses quotidiennes et les dix paliers de progression ZENKAI." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: MissionsPage,
});

export function MissionsPage() {
  const { session } = useAuth();
  const usernameStatus = usePlayerProfileUsername();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const game = useQuery({ ...onlineMissionQuery(userId), enabled: !!session, refetchInterval: 30_000 });
  const accountQuests = useQuests(session?.user.id ?? null);
  const guestQuests = useQuests(null);
  const [pending, setPending] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  syncDailyMissionDay();
  const localDailyState = {
    mission_opened: Number(safeLocalGet("zenkai_beta_opened", "0")),
    mission_recycled: Number(safeLocalGet("zenkai_beta_recycled", "0")),
    mission_claims: JSON.parse(safeLocalGet("zenkai_beta_claims", "[]")) as string[],
    mission_started_at: new Date().toISOString(),
    level: 1,
    xp: 0,
    coins: 0,
    bonus_boosters: 0,
    reward_packs: {} as Record<string, number>,
  };
  const state = game.data ? { ...game.data, ...localDailyState } : localDailyState;
  const todaySeed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, "")) || 1;
  const missionPool = [
    { id: "login", title: "Présence quotidienne", icon: LogIn, progress: 1, goal: 1, reward: "+100 Zen", xp: 0, zen: 100 },
    { id: "open_2", title: "Ouvrir 2 boosters", icon: Package, progress: state?.mission_opened ?? 0, goal: 2, reward: "+25 XP · +50 Zen", xp: 25, zen: 50 },
    { id: "open_3", title: "Ouvrir 3 boosters", icon: Package, progress: state?.mission_opened ?? 0, goal: 3, reward: "+35 XP · +75 Zen", xp: 35, zen: 75 },
    { id: "open_5", title: "Ouvrir 5 boosters", icon: Package, progress: state?.mission_opened ?? 0, goal: 5, reward: "+60 XP · +120 Zen", xp: 60, zen: 120 },
    { id: "recycle_1", title: "Recycler 1 doublon", icon: Recycle, progress: state?.mission_recycled ?? 0, goal: 1, reward: "+20 XP · +50 Zen", xp: 20, zen: 50 },
    { id: "recycle_2", title: "Recycler 2 doublons", icon: Recycle, progress: state?.mission_recycled ?? 0, goal: 2, reward: "+30 XP · +75 Zen", xp: 30, zen: 75 },
    { id: "recycle_4", title: "Recycler 4 doublons", icon: Recycle, progress: state?.mission_recycled ?? 0, goal: 4, reward: "+50 XP · +110 Zen", xp: 50, zen: 110 },
  ];
  const openVariants = missionPool.slice(1, 4);
  const thirdVariants = missionPool.slice(4);
  const missions = [
    missionPool.at(0),
    openVariants.at(todaySeed % openVariants.length),
    thirdVariants.at((todaySeed * 3 + 1) % thirdVariants.length),
  ].filter((mission): mission is NonNullable<typeof mission> => mission !== undefined);
  const localReady = (guestQuests.state ? availableQuestCount(guestQuests.state) : 0) +
    (session && accountQuests.state ? availableQuestCount(accountQuests.state) : 0);
  const onlineReady = state ? missions.filter((mission) => mission.progress >= mission.goal && !state.mission_claims.includes(mission.id)).length : 0;
  const totalReady = localReady + onlineReady;
  async function claim(id: string) {
    if (pending) return;
    syncDailyMissionDay();
    const mission = missions.find((m) => m.id === id);
    if (!mission || mission.progress < mission.goal) {
      toast.error("Mission pas encore terminée.");
      return;
    }
    const claims: string[] = JSON.parse(safeLocalGet("zenkai_beta_claims", "[]"));
    if (claims.includes(id)) {
      toast.error("Récompense déjà réclamée aujourd'hui.");
      return;
    }
    setPending(id);
    try {
      const zenGain = mission.zen ?? 50;
      const xpGain = mission.xp ?? 0;
      const nextClaims = [...claims, id];
      window.localStorage.setItem("zenkai_beta_claims", JSON.stringify(nextClaims));
      updateGuestState((st) => ({ state: { ...st, zen: st.zen + zenGain }, result: true }));
      if (xpGain > 0) addLocalMissionXp(xpGain);
      await queryClient.invalidateQueries();
      toast.success(`Récompense réclamée : +${zenGain} Zen${xpGain > 0 ? ` · +${xpGain} XP` : ""} !`);
    } finally {
      setPending(null);
    }
  }
  async function claimAll() {
    if (pending) return;
    syncDailyMissionDay();
    const claims: string[] = JSON.parse(safeLocalGet("zenkai_beta_claims", "[]"));
    const ready = missions.filter((m) => m.progress >= m.goal && !claims.includes(m.id));
    const localReadyCount = localReady;
    if (!ready.length && !localReadyCount) {
      toast.error("Aucune mission disponible à réclamer.");
      return;
    }
    setPending("all");
    try {
      let totalZen = 0;
      let totalXp = 0;
      const nextClaims = [...claims];
      for (const m of ready) {
        nextClaims.push(m.id);
        totalZen += m.zen ?? 50;
        totalXp += m.xp ?? 0;
      }
      if (ready.length > 0) {
        window.localStorage.setItem("zenkai_beta_claims", JSON.stringify(nextClaims));
        updateGuestState((st) => ({ state: { ...st, zen: st.zen + totalZen }, result: true }));
        if (totalXp > 0) addLocalMissionXp(totalXp);
      }
      if (localReadyCount > 0) claimAllQuests(session ? [session.user.id, null] : [null]);
      await queryClient.invalidateQueries();
      toast.success(`Missions réclamées !${totalZen > 0 ? ` +${totalZen} Zen` : ""}${totalXp > 0 ? ` · +${totalXp} XP` : ""}`);
    } finally {
      setPending(null);
    }
  }
  const remaining = state && now !== null ? Math.max(0, new Date(state.mission_started_at).getTime() + 86400000 - now) : null;
  const xpGoal = Math.max(1, xpRequired(state?.level ?? 1) || 100);
  return <div className="game-page mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <p className="game-eyebrow"><Trophy className="size-4" /> PROGRESSION DU JOUEUR</p>
    <h1 className="mt-3 text-3xl font-black sm:text-4xl">Missions & Niveaux</h1>
    <section aria-label="Profil local" className="mt-6 rounded-xl border border-amber-400/25 bg-violet-950/20 p-5"><LocalLevel /></section>
    <div className="mt-6">
      <Button variant="hero" className="min-h-11" disabled={!!pending || totalReady === 0 || !guestQuests.state || guestQuests.error || (!!session && (!accountQuests.state || accountQuests.error || !state))} onClick={claimAll}>
        {pending === "all" ? "Réclamation en cours…" : `Tout réclamer (${totalReady})`}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">Missions locales et du compte en ligne ; le bonus de connexion reste séparé.</p>
      {session && game.isError && <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-destructive">Missions en ligne indisponibles : vérifie la connexion avant de tout réclamer.<Button type="button" variant="glass" size="sm" onClick={() => game.refetch()}>Réessayer</Button></div>}
      {(guestQuests.error || (session && accountQuests.error)) && <p role="alert" className="mt-2 text-sm text-destructive">Missions locales indisponibles : vérifie le stockage avant de tout réclamer.</p>}
    </div>
    <MissionsPanel accountId={session?.user.id ?? null} claimingAll={pending === "all"} />
    <details className="mt-10 border-t border-border pt-5">
    <summary className="cursor-pointer text-lg font-bold">Progression et missions du compte en ligne</summary>
    <p className="mt-2 text-sm text-muted-foreground">Cette progression serveur, ses Coins et ses récompenses sont distincts du niveau, des missions et des Zen locaux ci-dessus.</p>
    
    {game.isError && <div role="alert" className="mt-5 flex items-center gap-3 text-sm text-destructive">Le profil n’a pas pu être chargé.<Button variant="glass" size="sm" onClick={() => game.refetch()}>Réessayer</Button></div>}
    {session && !state && !game.isError && <p className="mt-6 text-sm text-muted-foreground">Chargement du profil…</p>}
    {state && <section className="mt-7 border-y border-border py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs uppercase text-muted-foreground">{usernameStatus.username ?? (usernameStatus.isError ? "Pseudo indisponible" : "Choisir un pseudo")}</p><h2 className="mt-2 font-display text-2xl font-bold">Niveau {state.level}<span className="ml-2 text-sm text-muted-foreground">/ {MAX_LEVEL}</span></h2></div>
        <div className="flex items-center gap-5 text-sm font-semibold"><span className="flex items-center gap-2 text-rarity-legendaire"><Coins className="size-4" />{(state.coins ?? 0).toLocaleString("fr-FR")}</span><span className="flex items-center gap-2 text-accent"><Package className="size-4" />{state.bonus_boosters} bonus</span></div>
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