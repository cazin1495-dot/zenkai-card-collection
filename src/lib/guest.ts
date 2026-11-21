import { inPack, type Card, type PackId, type PulledCard } from "./cards";

/** Unpersisted visual-only draws for development guest sessions. */
export function createLocalGuestDraw(cards: Card[], pack: PackId, count: number): PulledCard[] {
  const candidates = cards.filter((card) => inPack(card, pack));
  if (!candidates.length) return [];

  return Array.from({ length: count }, (_, index) => {
    const card = candidates[Math.floor(Math.random() * candidates.length)];
    if (!card) throw new Error("Impossible de sélectionner une carte pour le tirage invité.");
    return {
      userCardId: `guest-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      card,
    };
  });
}
