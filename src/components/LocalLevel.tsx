import { useLevel } from "@/hooks/use-level";
import { XP_PER_LEVEL } from "@/lib/level";
import { useSecretQuests } from "@/hooks/use-secret-quests";
import { SECRET_QUESTS } from "@/lib/quests";

export function LocalLevel({ compact = false }: { compact?: boolean }) {
  const { xp, error, level, progress } = useLevel();
  const secrets = useSecretQuests();
  if (error) return <p role="alert" className="text-xs text-destructive">XP locale indisponible</p>;
  if (xp === null || level === null || progress === null) return <p className="text-xs text-muted-foreground">Chargement XP…</p>;
  return <div className={compact ? "min-w-20" : "w-full"}>
    <p className={compact ? "text-[10px] font-bold text-amber-300" : "font-bold text-amber-300"}>Niveau {level} <span className="font-normal text-muted-foreground">· {progress} / {XP_PER_LEVEL} XP</span></p>
    <div role="progressbar" aria-label="Progression XP locale" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={progress} className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-gradient-to-r from-violet-500 via-amber-400 to-yellow-200 shadow-[0_0_8px_#fbbf24]" style={{ width: `${progress / XP_PER_LEVEL * 100}%` }} />
    </div>
    {!compact && <p className="mt-1 text-xs text-muted-foreground">{xp.toLocaleString("fr-FR")} XP au total · progression locale sur cet appareil</p>}
    {!compact && secrets.error && <p role="alert" className="mt-1 text-xs text-destructive">Titres locaux indisponibles</p>}
    {!compact && secrets.state && secrets.state.claimed.some((id) => SECRET_QUESTS.some((quest) => quest.id === id && "title" in quest)) &&
      <p className="mt-2 text-xs text-amber-200">Titres débloqués : {SECRET_QUESTS.filter((quest) => secrets.state?.claimed.includes(quest.id) && "title" in quest).map((quest) => "title" in quest ? quest.title : "").join(" · ")}</p>}
  </div>;
}
