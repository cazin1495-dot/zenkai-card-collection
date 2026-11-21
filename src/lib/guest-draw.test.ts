import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalGuestDraw } from "./guest";
import type { Card } from "./cards";
import type { CustomTranscendanceCard } from "./transcendance-cards";

const cards: Card[] = (["shonen", "seinen", "shojo", "sport", null] as const).map((category, index) => ({
  id: `card-${index}`, name: `Card ${index}`, title: "", description: "",
  rarity: "commune", sort_order: index,
  category,
}));

describe("universal guest booster", () => {
  afterEach(() => vi.restoreAllMocks());

  it("draws standard cards across genres in Shonen Mix", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(createLocalGuestDraw(cards, "shonen", 1, []).map((item) => item.card.id)).toEqual(cards.map((card) => card.id));
  });

  it("can draw an exclusive card assigned only to another pack", () => {
    const exclusive: CustomTranscendanceCard = {
      id: "sport-exclusive", name: "Sport", anime: "Sport", image_url: "",
      pack_ids: ["sport"], rarity: "Transcendance", series_number: "SPORT-001",
    };
    vi.spyOn(Math, "random").mockReturnValue(0).mockReturnValueOnce(0.9996);
    const draw = createLocalGuestDraw(cards, "shonen", 1, [exclusive]);
    expect(draw[0]).toMatchObject({ card: { id: exclusive.id }, customTranscendance: true });
  });
});
