import { CARDS_PER_BOOSTER, inPack, isTranscendanceCatalogCard, rarityFromRoll, type Card, type PackId, type PulledCard } from "./cards";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard, customTranscendanceInPack, type CustomTranscendanceCard } from "./transcendance-cards";

/** Unpersisted visual-only draws for local guest sessions. */
export function createLocalGuestDraw(
  cards: Card[],
  pack: PackId,
  boosterCount: number,
  customTranscendanceCards: readonly CustomTranscendanceCard[] = CUSTOM_TRANSCENDANCE_CARDS,
): PulledCard[] {
  const candidates = [...new Map(cards.filter((card) => !isTranscendanceCatalogCard(card) && inPack(card, pack)).map((card) => [card.id, card])).values()];
  if (candidates.length < CARDS_PER_BOOSTER) return [];

  let drawId = 0;
  const ownedSet = new Set<string>();
  const usedIds = new Set<string>();
  let hasEpiquePlus = false;
  return Array.from({ length: boosterCount }, (_, boosterIndex) => {
    const remaining = [...candidates];
    return Array.from({ length: CARDS_PER_BOOSTER }, (_, cardIndex) => {
      const roll = Math.random() * 100;
      let rarity = rarityFromRoll(roll);
      if (boosterCount === 10 && boosterIndex === 9 && cardIndex === 4 && !hasEpiquePlus) {
        rarity = "epique";
      }
      if (rarity === "epique" || rarity === "legendaire" || rarity === "mythique" || rarity === "transcendance") {
        hasEpiquePlus = true;
      }
      let card: Card | undefined;
      let customTranscendance = false;

      if (rarity === "transcendance") {
        const customPool = customTranscendanceCards.filter((candidate) => customTranscendanceInPack(candidate, pack) && !usedIds.has(candidate.id));
        const selectedCustom = customPool.length > 0
          ? customPool[Math.floor(Math.random() * customPool.length)]
          : undefined;
        if (selectedCustom) {
          card = customTranscendanceAsCard(selectedCustom);
          customTranscendance = true;
        } else {
          const mythicPool = remaining.filter((candidate) => candidate.rarity === "mythique");
          const safeMythicPool = mythicPool.length > 0 ? mythicPool : remaining.length > 0 ? remaining : cards;
      card = safeMythicPool[Math.floor(Math.random() * safeMythicPool.length)];
        }
      } else {
        const matchingRarity = remaining.filter((candidate) => candidate.rarity === rarity);
        const pool = matchingRarity.length > 0 ? matchingRarity : remaining.filter((candidate) => candidate.rarity === "commune");
        card = pool[Math.floor(Math.random() * pool.length)]; if (card && ownedSet.has(card.id) && pool.length > 1 && Math.random() < 0.45) { card = pool[Math.floor(Math.random() * pool.length)]; }
      }

      if (!card) {
    const anyPackPool = remaining.length > 0 ? remaining : cards.filter((c) => inPack(c, pack));
    const fallbackPool = anyPackPool.length > 0 ? anyPackPool : cards;
    card = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  }
  if (!card) throw new Error(`Aucune carte disponible pour le pack ${pack}.`);
      usedIds.add(card.id); ownedSet.add(card.id);
      const standardIndex = remaining.findIndex((candidate) => candidate.id === card.id);
      if (standardIndex >= 0) remaining.splice(standardIndex, 1);
      return {
        userCardId: `guest-${Date.now()}-${boosterIndex}-${cardIndex}-${drawId++}`,
        card,
        ...(customTranscendance ? { customTranscendance: true } : {}),
      };
    });
  }).flat();
}
