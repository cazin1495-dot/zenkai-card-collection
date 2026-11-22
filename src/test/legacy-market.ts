import { updateGuestState } from "@/lib/guest-collection";
import { getGuestMarket } from "@/lib/guest-market";

export function seedLegacyAuction(cardId: string, now: number) {
  const listings = getGuestMarket().listings.map((item) =>
    item.seller === "npc" && item.cardId === cardId
      ? { ...item, kind: "auction" as const, endAt: now + 15 * 60_000 }
      : item,
  );
  updateGuestState((state) => ({ state: { ...state, market: { listings } }, result: undefined }));
}
