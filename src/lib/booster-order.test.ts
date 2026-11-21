import { describe, expect, it } from "vitest";
import type { PulledCard } from "./cards";
import { markNewBoosterCards, sortBoosterCardsByRarity } from "./booster-order";

function pulled(
  userCardId: string,
  rarity: PulledCard["card"]["rarity"],
  transcended = false,
  customTranscendance = false,
): PulledCard {
  return {
    userCardId,
    ...(transcended ? { transcended: true } : {}),
    ...(customTranscendance ? { customTranscendance: true } : {}),
    card: {
      id: userCardId,
      name: userCardId,
      title: userCardId,
      rarity,
      description: "",
      sort_order: 0,
    },
  };
}

describe("booster reveal order", () => {
  it("orders custom Transcendance after the standard card rarities", () => {
    const cards = [
      pulled("transcendance", "mythique", false, true),
      pulled("rare", "rare"),
      pulled("commune", "commune"),
      pulled("non_commune", "non_commune"),
      pulled("mythique", "mythique"),
      pulled("epique", "epique"),
      pulled("legendaire", "legendaire"),
      pulled("commune-2", "commune"),
      pulled("rare-2", "rare"),
      pulled("non_commune-2", "non_commune"),
    ];

    expect(sortBoosterCardsByRarity(cards).map(({ userCardId }) => userCardId)).toEqual([
      "commune",
      "commune-2",
      "non_commune",
      "non_commune-2",
      "rare",
      "rare-2",
      "epique",
      "legendaire",
      "mythique",
      "transcendance",
    ]);
  });

  it("sorts a whole batch by rarity while preserving draw order for ties", () => {
    const cards = [
      pulled("b1-rare", "rare"),
      pulled("b1-commune", "commune"),
      pulled("b1-mythique", "mythique"),
      pulled("b1-non-commune", "non_commune"),
      pulled("b1-epique", "epique"),
      pulled("b2-legendaire", "legendaire"),
      pulled("b2-commune", "commune"),
      pulled("b2-rare", "rare"),
      pulled("b2-epique", "epique"),
      pulled("b2-non-commune", "non_commune"),
    ];

    expect(sortBoosterCardsByRarity(cards).map(({ userCardId }) => userCardId)).toEqual([
      "b1-commune",
      "b2-commune",
      "b1-non-commune",
      "b2-non-commune",
      "b1-rare",
      "b2-rare",
      "b1-epique",
      "b2-epique",
      "b2-legendaire",
      "b1-mythique",
    ]);
  });

  it("orders a transcended Mythique copy above every base rarity", () => {
    const cards = [
      pulled("common", "commune"),
      pulled("uncommon", "non_commune"),
      pulled("rare", "rare"),
      pulled("epic", "epique"),
      pulled("transcended", "mythique", true),
    ];

    expect(sortBoosterCardsByRarity(cards).at(-1)?.userCardId).toBe("transcended");
  });

  it("marks the first occurrence in draw order only, even when sorting changes reveal order", () => {
    const first = pulled("first", "mythique", true);
    const second = { ...pulled("second", "mythique"), card: first.card };
    const owned = pulled("owned", "rare");
    const marked = markNewBoosterCards([first, second, owned], ["owned"]);
    expect(marked.map((item) => item.isNew)).toEqual([true, false, false]);
    expect(sortBoosterCardsByRarity(marked).map((item) => [item.userCardId, item.isNew])).toEqual([
      ["owned", false], ["second", false], ["first", true],
    ]);
  });
});
