import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuests } from "@/hooks/use-quests";
import { getGuestCollection } from "@/lib/guest-collection";
import { cardsQuery, collectionQuery } from "@/lib/queries";
import { availableQuestCount, claimDailyLogin, claimQuest, DAILY_LOGIN_REWARDS, observeQuestCollection, QUESTS, questProgress } from "@/lib/quests";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "@/lib/transcendance-cards";

export function useMissionData(userId: string | null, enabled = true) {
  const [observationError, setObservationError] = useState(false);
  const { state, error, daily, dailyError } = useQuests(userId);
  const client = useQueryClient();
  const catalog = useQuery(cardsQuery);
  const online = useQuery({ ...collectionQuery(userId ?? ""), enabled: enabled && !!userId });
  const local = useQuery({ queryKey: ["guest-collection"], queryFn: getGuestCollection, enabled: enabled && !userId });
  const copies = enabled ? (userId ? online.data : local.data) : undefined;
  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey: ["guest-collection"] }); };
    window.addEventListener("zenkai:guest-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("zenkai:guest-updated", refresh); window.removeEventListener("storage", refresh); };
  }, [client]);
  useEffect(() => {
    if (!catalog.data || !copies) return;
    try {
      observeQuestCollection(userId, [...catalog.data, ...CUSTOM_TRANSCENDANCE_CARDS.map(customTranscendanceAsCard)], copies);
      setObservationError(false);
    } catch { setObservationError(true); }
  }, [catalog.data, copies, userId]);
  const ready = state ? availableQuestCount(state) : 0;
  return { state, ready, daily, dailyError, error: error || observationError || catalog.isError || (userId ? online.isError : local.isError) };
}

export function MissionsPanel({ accountId }: { accountId: string | null }) {
  const [scope, setScope] = useState<"account" | "local">("account");
  const userId = scope === "account" ? accountId : null;
  const { state, error, daily, dailyError } = useMissionData(userId);
  return <section className="mt-7 space-y-5">
        <section aria-label="Bonus de connexion journalier" className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-950/40 via-violet-950/30 to-background p-4 sm:p-5">
          <h2 className="text-lg font-bold text-amber-200">Bonus de Connexion Journalier · Série : {daily?.streak ?? "…"}/7 jours</h2>
          <p className="mt-1 text-xs text-muted-foreground">Une récompense locale par jour, partagée sur cet appareil.</p>
          {dailyError && <p role="alert" className="mt-3 text-sm text-destructive">Bonus de connexion indisponible. Vérifie le stockage et la date de l’appareil.</p>}
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DAILY_LOGIN_REWARDS.map((reward, index) => {
              const day = index + 1;
              const claimed = daily && (daily.claimed ? day <= daily.streak : day < daily.day);
              const available = daily && !daily.claimed && day === daily.day;
              return <div key={day} className={`min-w-0 rounded-xl border p-1 text-center sm:p-3 ${available ? "border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.45)]" : claimed ? "border-emerald-400/40 bg-emerald-950/20" : "border-white/10 bg-white/5"}`}>
                <p className="break-words text-[10px] font-bold text-amber-200 sm:text-xs">Jour {day}{day === 7 && " · Coffret Ultime"}</p>
                <p className="mt-2 text-[10px] font-bold sm:text-sm">{reward.zen.toLocaleString("fr-FR")} Zen</p>
                <p className="text-[10px] text-muted-foreground sm:text-xs">+{reward.xp} XP</p>
                <p className="mt-2 flex flex-wrap items-center justify-center gap-0.5 text-[9px] text-muted-foreground sm:gap-1 sm:text-xs">
                  {claimed ? <><Check className="size-3 text-emerald-400" />Réclamé</> : available ? "Disponible" : <><Lock className="size-3" />Verrouillé</>}
                </p>
              </div>;
            })}
          </div>
          <Button className="mt-4" variant="hero" disabled={!daily || daily.claimed} onClick={() => {
            try {
              const reward = claimDailyLogin();
              toast.success(`Bonus Jour ${reward.day} réclamé : +${reward.zen.toLocaleString("fr-FR")} Zen & +${reward.xp} XP ★`);
            } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Bonus indisponible."); }
          }}>{daily?.claimed ? "Réclamé aujourd'hui" : "Réclamer le bonus du jour"}</Button>
        </section>
        <div><h2 className="text-xl font-bold">Missions quotidiennes &amp; succès</h2><p className="mt-1 text-sm text-muted-foreground">Zen et XP locaux sur cet appareil. Les tirages invités sont des simulations non sauvegardées. Réinitialisation à minuit (heure locale).</p></div>
        {accountId && <div role="group" aria-label="Progression des missions" className="flex gap-2">
          <Button size="sm" variant={scope === "account" ? "hero" : "glass"} aria-pressed={scope === "account"} onClick={() => setScope("account")}>Compte connecté</Button>
          <Button size="sm" variant={scope === "local" ? "hero" : "glass"} aria-pressed={scope === "local"} onClick={() => setScope("local")}>Collection locale</Button>
        </div>}
        {error && <p role="alert" className="text-sm text-destructive">Progression ou collection indisponible. Vérifie le stockage et la connexion.</p>}
        {([true, false] as const).map((daily) => <section key={String(daily)} className="space-y-2">
          <h3 className="font-bold text-amber-300">{daily ? "Missions du jour" : "Succès collection"}</h3>
          {QUESTS.filter((quest) => quest.daily === daily).map((quest) => {
            const progress = state ? Math.min(questProgress(state, quest.id), quest.target) : 0;
            const claimed = state && (daily ? state.dailyClaimed : state.achievementClaimed).includes(quest.id);
            return <div key={quest.id} className="flex items-center justify-between gap-3 rounded-xl border border-violet-400/20 bg-violet-950/20 p-3">
              <div><p className="text-sm font-semibold">{quest.label}</p><p className="text-xs text-muted-foreground">{progress} / {quest.target} · +{quest.reward.toLocaleString("fr-FR")} Zen locaux · +{quest.xp} XP</p></div>
              <Button size="sm" variant={progress >= quest.target && !claimed ? "hero" : "glass"} disabled={!state || !!claimed || progress < quest.target} onClick={() => {
                try { const reward = claimQuest(userId, quest.id); toast.success(`Récompense réclamée ! +${reward} Zen locaux · +${quest.xp} XP`); }
                catch (reason) { toast.error(reason instanceof Error ? reason.message : "Récompense indisponible."); }
              }}>{claimed ? "Réclamée" : "Réclamer"}</Button>
            </div>;
          })}
        </section>)}
  </section>;
}
