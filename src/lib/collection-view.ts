import { getCardMarketPrice, rarityRank, type Card, type Rarity } from "./cards";

type Copy = { card_id: string; obtained_at: string; transcended: boolean };
export type CollectionSort = "recent" | "rarest" | "commonest" | "value" | "duplicates";
export type CollectionEntry = {
  card: Card;
  rarity: Rarity;
  count: number;
  latest: number;
  transcended: boolean;
  customTranscendance: boolean;
};

export function collectionEntries(
  cards: Card[],
  copies: readonly Copy[],
  customIds: ReadonlySet<string>,
) {
  const grouped = new Map<string, Copy[]>();
  for (const copy of copies) {
    const group = grouped.get(copy.card_id) ?? [];
    group.push(copy);
    grouped.set(copy.card_id, group);
  }
  return cards.flatMap((card): CollectionEntry[] => {
    const owned = grouped.get(card.id) ?? [];
    const customTranscendance = customIds.has(card.id);
    const entry = (group: Copy[], transcended: boolean): CollectionEntry => ({
      card,
      rarity: transcended || customTranscendance ? "transcendance" : card.rarity,
      count: group.length,
      latest: group.reduce((latest, copy) => {
        const time = Date.parse(copy.obtained_at);
        return Number.isFinite(time) ? Math.max(latest, time) : latest;
      }, -Infinity),
      transcended,
      customTranscendance,
    });
    if (customTranscendance) return [entry(owned, false)];
    const base = owned.filter((copy) => !copy.transcended);
    const awakened = owned.filter((copy) => copy.transcended);
    return [
      ...(base.length || !owned.length ? [entry(base, false)] : []),
      ...(awakened.length ? [entry(awakened, true)] : []),
    ];
  });
}

export function sortCollectionEntries(entries: CollectionEntry[], sort: CollectionSort) {
  return [...entries].sort((a, b) => {
    if (sort === "rarest" || sort === "commonest") {
      const rarity = rarityRank(a.rarity) - rarityRank(b.rarity);
      if (rarity) return sort === "rarest" ? rarity : -rarity;
      return (b.card.popularity ?? 0) - (a.card.popularity ?? 0);
    }
    if (sort === "value") {
      const value = getCardMarketPrice({ ...b.card, rarity: b.rarity }) -
        getCardMarketPrice({ ...a.card, rarity: a.rarity });
      if (value) return value;
      return (b.card.popularity ?? 0) - (a.card.popularity ?? 0);
    }
    if (sort === "duplicates" && a.count !== b.count) return b.count - a.count;
    if (a.latest === b.latest) return 0;
    return a.latest > b.latest ? -1 : 1;
  });
}
