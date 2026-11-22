import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InspectableCard } from "@/components/Transcendance";
import { useQuests } from "@/hooks/use-quests";
import { isTranscendanceCatalogCard, RARITY, type Card } from "@/lib/cards";
import { claimAlbum } from "@/lib/quests";

type Copy = { card_id: string; transcended: boolean; customTranscendance?: boolean | undefined };

export function AnimeAlbum({
  cards,
  copies,
  userId,
}: {
  cards: Card[];
  copies: readonly Copy[];
  userId: string | null;
}) {
  const { state, error } = useQuests(userId);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
  const selectedGroup = selectedSeries ? groups.get(selectedSeries) : undefined;
  const searchKey = (value: string) =>
    value.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/\p{M}/gu, "");
  const filteredGroups = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .filter(([series]) => searchKey(series).includes(searchKey(search)));
  const count = selectedGroup?.filter((card) => owned.has(card.id)).length ?? 0;
  const completed = !!selectedGroup && count === selectedGroup.length;
  const claimed = selectedSeries !== null && state?.albums.includes(selectedSeries);
  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-muted-foreground">
        Albums calculés à partir du catalogue chargé et de la collection affichée. Les cartes sans
        série sont exclues. Certaines exclusivités ne sont pas encore obtenables en ligne.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          Récompenses locales indisponibles : vérifie le stockage du navigateur.
        </p>
      )}
      {!selectedGroup && (
        <>
          <Input
            type="search"
            aria-label="Rechercher un anime"
            placeholder="Rechercher un anime…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredGroups.map(([series, group]) => {
              const count = group.filter((card) => owned.has(card.id)).length;
              return (
                <button
                  key={series}
                  type="button"
                  onClick={() => setSelectedSeries(series)}
                  className="min-h-24 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-violet-950/40 to-surface p-4 text-left transition-colors hover:border-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  <span className="block font-bold text-amber-300">{series}</span>
                  <span className="mt-2 block text-sm text-muted-foreground">
                    {count} / {group.length} cartes débloquées
                  </span>
                </button>
              );
            })}
          </div>
          {!groups.size ? (
            <p className="text-muted-foreground">Aucune série disponible dans le catalogue.</p>
          ) : (
            !filteredGroups.length && (
              <p className="text-muted-foreground">Aucun anime ne correspond à la recherche.</p>
            )
          )}
        </>
      )}
      {selectedSeries && selectedGroup && (
        <>
          <Button type="button" variant="ghost" onClick={() => setSelectedSeries(null)}>
            ← Retour à la liste des animes
          </Button>
          <section className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-violet-950/40 to-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-black text-amber-300">{selectedSeries}</h2>
              <p className="text-sm">
                {count} / {selectedGroup.length} cartes débloquées
              </p>
            </div>
            <div
              role="progressbar"
              aria-label={`Progression ${selectedSeries}`}
              aria-valuemin={0}
              aria-valuemax={selectedGroup.length}
              aria-valuenow={count}
              className="mt-3 h-2 overflow-hidden rounded-full bg-black/50"
            >
              <div
                className="h-full bg-gradient-to-r from-violet-500 via-amber-400 to-yellow-200 shadow-[0_0_12px_#fbbf24]"
                style={{ width: `${(count / selectedGroup.length) * 100}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:grid-cols-8">
              {selectedGroup.map((card) => {
                const copy = owned.get(card.id);
                const custom = isTranscendanceCatalogCard(card);
                const rarity = custom ? "transcendance" : card.rarity;
                return (
                  <div key={card.id} className="min-w-0">
                    {copy ? (
                      <InspectableCard
                        card={card}
                        transcended={copy.transcended}
                        customTranscendance={copy.customTranscendance || custom}
                      />
                    ) : (
                      <div
                        className={`relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 ${card.image_scale ? "bg-neutral-950" : "bg-black"}`}
                      >
                        {card.image_url && (
                          <img
                            src={card.image_url}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover grayscale brightness-[0.3]"
                            style={{
                              objectPosition: card.image_position ?? "center top",
                              transform: card.image_scale
                                ? `scale(${card.image_scale})`
                                : undefined,
                            }}
                          />
                        )}
                        <Lock
                          aria-hidden
                          className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-white/80"
                        />
                      </div>
                    )}
                    <p className="mt-1 truncate text-xs font-semibold">{card.name}</p>
                    <p className={`text-[10px] ${RARITY[rarity].text}`}>
                      {RARITY[rarity].label}
                      {!copy && " · Verrouillée"}
                    </p>
                  </div>
                );
              })}
            </div>
            <Button
              className="mt-4 h-auto whitespace-normal text-left"
              variant={completed && !claimed ? "hero" : "glass"}
              disabled={!state || !completed || !!claimed}
              onClick={() => {
                try {
                  claimAlbum(userId, selectedSeries, cards, copies);
                  toast.success(`Album terminé ! +500 Zen locaux · Titre Maître ${selectedSeries}`);
                } catch (reason) {
                  toast.error(
                    reason instanceof Error ? reason.message : "Récompense indisponible.",
                  );
                }
              }}
            >
              {claimed
                ? `Réclamée · Titre Maître ${selectedSeries}`
                : `Réclamer la récompense 100 % (+500 Zen & Titre Maître ${selectedSeries})`}
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
