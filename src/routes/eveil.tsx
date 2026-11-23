import { updateGuestState } from "@/lib/guest-collection";
import { addGuestXp } from "@/lib/guest-level";
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
    mission_opened: Number(localStorage.getItem("zenkai_beta_opened") || "0"),
    mission_recycled: Number(localStorage.getItem("zenkai_beta_recycled") || "0"),
    mission_claims: JSON.parse(localStorage.getItem("zenkai_beta_claims") || "[]") as string[],
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
    { id: "cards_10", title: "Obtenir 10 cartes aujourd'hui", icon: Package, progress: Number(localStorage.getItem("zenkai_beta_daily_cards") || "0"), goal: 10, reward: "+35 XP · +80 Zen", xp: 35, zen: 80 },
    { id: "zenkai_1", title: "Ouvrir 1 Booster Zenkai", icon: Package, progress: Number(localStorage.getItem("zenkai_beta_daily_zenkai_pack") || "0"), goal: 1, reward: "+50 XP · +150 Zen", xp: 50, zen: 150 },
  ];
  const openVariants = [missionPool[1], missionPool[2], missionPool[3]];
  const thirdVariants = [missionPool[4], missionPool[5], missionPool[6], missionPool[7], missionPool[8]];
  const missions = [
    missionPool[0],
    openVariants[todaySeed % openVariants.length],
    thirdVariants[(todaySeed * 3 + 1) % thirdVariants.length],
  ];
  const localReady = (guestQuests.state ? availableQuestCount(guestQuests.state) : 0) +
    (session && accountQuests.state ? availableQuestCount(accountQuests.state) : 0);
  const onlineReady = state ? missions.filter((mission) => mission.progress >= mission.goal && !state.mission_claims.includes(mission.id)).length : 0;
  const totalReady = localReady + onlineReady;
  async function claim(id: string) {
    if (pending) return;
    setPending(id);
    try {
      const { data, error } = await supabase.rpc("claim_mission", { _mission: id });
      if (error) throw error;
      queryClient.setQueryData(onlineMissionQuery(userId).queryKey, parseOnlineGameState(data));
      void queryClient.invalidateQueries({ queryKey: gameQuery(userId).queryKey });
      toast.success("Récompense ajoutée à ton profil.");
    } catch { toast.error("Cette récompense n’est pas disponible. Actualise tes missions."); await game.refetch(); }
    finally { setPending(null); }
  }
  async function claimAll() {
    if (pending) return;
    setPending("all");
    let local = { count: 0, xp: 0, zen: 0 };
    let onlineCount = 0;
    let onlineXp = 0;
    let coins = 0;
    let boosters = 0;
    const packs: Record<string, number> = {};
    try {
      let online: GameState | undefined;
      if (session) {
        const fresh = await game.refetch({ throwOnError: true });
        if (!fresh.data) throw new Error("État des missions en ligne indisponible.");
        online = fresh.data;
      }
      local = claimAllQuests(session ? [null, session.user.id] : [null]);
      if (online) {
        const snapshot = online;
        const pendingMissions = missions.filter((mission) => {
          const progress = mission.id === "open" ? snapshot.mission_opened : mission.id === "recycle" ? snapshot.mission_recycled : 1;
          return progress >= mission.goal && !snapshot.mission_claims.includes(mission.id);
        });
        for (const mission of pendingMissions) {
          const { data, error } = await supabase.rpc("claim_mission", { _mission: mission.id });
          if (error) throw error;
          const next = parseOnlineGameState(data);
          coins += next.coins - online.coins;
          boosters += next.bonus_boosters - online.bonus_boosters;
          for (const [key, count] of Object.entries(next.reward_packs)) {
            const gained = count - (online.reward_packs[key] ?? 0);
            if (gained) packs[key] = (packs[key] ?? 0) + gained;
          }
          online = next;
          onlineCount++;
          onlineXp += mission.xp;
          queryClient.setQueryData(onlineMissionQuery(userId).queryKey, next);
        }
      }
      if (!local.count && !onlineCount) {
        toast.error("Aucune mission disponible. La progression a peut-être changé.");
        return;
      }
      toast.success(`Missions réclamées : +${local.zen.toLocaleString("fr-FR")} Zen locaux · +${local.xp} XP locaux${session ? ` · +${coins.toLocaleString("fr-FR")} Coins · +${onlineXp} XP en ligne · ${boosters} booster(s) bonus${Object.entries(packs).map(([key, count]) => ` · ${count} ${REWARD_LABELS[key] ?? key}`).join("")}` : ""}`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message :
        reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string" ? reason.message : "Erreur du serveur ou du stockage.";
      toast.error(`Réclamation interrompue : ${message}. Confirmé : ${local.count} mission(s) locale(s), +${local.zen.toLocaleString("fr-FR")} Zen, +${local.xp} XP ; ${onlineCount} mission(s) en ligne, +${coins.toLocaleString("fr-FR")} Coins, +${onlineXp} XP, ${boosters} booster(s) bonus${Object.entries(packs).map(([key, count]) => `, ${count} ${REWARD_LABELS[key] ?? key}`).join("")}. Vérifie les missions avant de réessayer.`);
    } finally {
      try {
        if (session) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: onlineMissionQuery(userId).queryKey }),
            queryClient.invalidateQueries({ queryKey: gameQuery(userId).queryKey }),
            queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
          ]);
        }
      } catch {
        toast.error("Actualisation des missions impossible. Vérifie ton profil avant de réessayer.");
      } finally { setPending(null); }
    }
  }
  const remaining = state && now !== null ? Math.max(0, new Date(state.mission_started_at).getTime() + 86400000 - now) : null;
  const xpGoal = xpRequired(state?.level ?? 1);
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