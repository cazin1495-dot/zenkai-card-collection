import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InspectableCard } from "@/components/Transcendance";
import { useQuests } from "@/hooks/use-quests";
import { isTranscendanceCatalogCard, RARITY, type Card } from "@/lib/cards";
import { claimAlbum } from "@/lib/quests";

type Copy = { card_id: string; transcended: boolean; customTranscendance?: boolean | undefined };

export function AnimeAlbum({ cards, copies, userId }: { cards: Card[]; copies: readonly Copy[]; userId: string | null }) {
  const { state, error } = useQuests(userId);
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const series = card.series?.trim();
    if (!series) continue;
    const group = groups.get(series) ?? [];
    if (!group.some((item) => item.id === card.id)) group.push(card);
    groups.set(series, group);
  }
  const owned = new Map<string, Copy>();
  for (const copy of copies) {
    const existing = owned.get(copy.card_id);
    if (!existing || copy.transcended || copy.customTranscendance) owned.set(copy.card_id, copy);
  }
  return <div className="mt-6 space-y-6">
    <p className="text-sm text-muted-foreground">Albums calculés à partir du catalogue chargé et de la collection affichée. Les cartes sans série sont exclues. Certaines exclusivités ne sont pas encore obtenables en ligne.</p>
    {error && <p role="alert" className="text-destructive">Récompenses locales indisponibles : vérifie le stockage du navigateur.</p>}
    {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "fr")).map(([series, group]) => {
      const count = group.filter((card) => owned.has(card.id)).length;
      const completed = count === group.length;
      const claimed = state?.albums.includes(series);
      return <section key={series} className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-violet-950/40 to-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2"><h2 className="text-lg font-black text-amber-300">{series}</h2><p className="text-sm">{count} / {group.length} cartes débloquées</p></div>
        <div role="progressbar" aria-label={`Progression ${series}`} aria-valuemin={0} aria-valuemax={group.length} aria-valuenow={count} className="mt-3 h-2 overflow-hidden rounded-full bg-black/50"><div className="h-full bg-gradient-to-r from-violet-500 via-amber-400 to-yellow-200 shadow-[0_0_12px_#fbbf24]" style={{ width: `${count / group.length * 100}%` }} /></div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:grid-cols-8">
          {group.map((card) => {
            const copy = owned.get(card.id);
            const custom = isTranscendanceCatalogCard(card);
            const rarity = custom ? "transcendance" : card.rarity;
            return <div key={card.id} className="min-w-0">
              {copy ? <InspectableCard card={card} transcended={copy.transcended} customTranscendance={copy.customTranscendance || custom} /> : <div className={`relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 ${card.image_scale ? "bg-neutral-950" : "bg-black"}`}>
                {card.image_url && <img src={card.image_url} alt="" loading="lazy" className="h-full w-full object-cover grayscale brightness-[0.3]" style={{ objectPosition: card.image_position ?? "center top", transform: card.image_scale ? `scale(${card.image_scale})` : undefined }} />}
                <Lock aria-hidden className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-white/80" />
              </div>}
              <p className="mt-1 truncate text-xs font-semibold">{card.name}</p>
              <p className={`text-[10px] ${RARITY[rarity].text}`}>{RARITY[rarity].label}{!copy && " · Verrouillée"}</p>
            </div>;
          })}
        </div>
        <Button className="mt-4 h-auto whitespace-normal text-left" variant={completed && !claimed ? "hero" : "glass"} disabled={!state || !completed || !!claimed} onClick={() => {
          try { claimAlbum(userId, series, cards, copies); toast.success(`Album terminé ! +500 Zen locaux · Titre Maître ${series}`); }
          catch (reason) { toast.error(reason instanceof Error ? reason.message : "Récompense indisponible."); }
        }}>{claimed ? `Réclamée · Titre Maître ${series}` : `Réclamer la récompense 100 % (+500 Zen & Titre Maître ${series})`}</Button>
      </section>;
    })}
    {!groups.size && <p className="text-muted-foreground">Aucune série disponible dans le catalogue.</p>}
  </div>;
}
