import { describe, expect, it, vi } from "vitest";
import type { Card } from "./cards";
import { createLocalGuestDraw } from "./guest";

const cards: Card[] = [
  {
    id: "shonen-1",
    name: "Hero",
    title: "Hero",
    rarity: "commune",
    description: "",
    sort_order: 1,
    category: "shonen",
  },
  {
    id: "shonen-2",
    name: "Rival",
    title: "Rival",
    rarity: "rare",
    description: "",
    sort_order: 2,
    category: "shonen",
  },
  {
    id: "seinen-1",
    name: "Seinen",
    title: "Seinen",
    rarity: "epique",
    description: "",
    sort_order: 3,
    category: "seinen",
  },
];

describe("local guest booster draws", () => {
  it("creates the requested number of unpersisted cards from the selected pack", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const draw = createLocalGuestDraw(cards, "shonen", 5);

    expect(draw).toHaveLength(5);
    expect(draw.every(({ card }) => card.category === "shonen")).toBe(true);
    expect(new Set(draw.map(({ userCardId }) => userCardId)).size).toBe(5);
    vi.restoreAllMocks();
  });

  it("returns no draw when the selected pack has no cards", () => {
    expect(createLocalGuestDraw(cards, "sport", 1)).toEqual([]);
  });
});
