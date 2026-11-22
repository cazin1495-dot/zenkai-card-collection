import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalGuestDraw } from "./guest";
import { DEMON_SLAYER_MYTHIC_CARDS, type Card } from "./cards";
import { CUSTOM_TRANSCENDANCE_CARDS, type CustomTranscendanceCard } from "./transcendance-cards";

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

  it.each(["shonen", "protagoniste"] as const)("can draw Gon as an exclusive in %s", (pack) => {
    const gon = CUSTOM_TRANSCENDANCE_CARDS.find((card) => card.id === "trans-gon");
    if (!gon) throw new Error("Gon Transcendance absent.");
    vi.spyOn(Math, "random").mockReturnValue(0).mockReturnValueOnce(0.9996);
    const draw = createLocalGuestDraw(cards.map((card) => ({ ...card, role: "protagoniste" })), pack, 1, [gon]);
    expect(draw[0]).toMatchObject({ card: { id: "trans-gon", image_url: "/gon%20adulte.webp" }, customTranscendance: true });
  });

  it.each(["shonen", "protagoniste"] as const)("can draw Deku as an exclusive in %s", (pack) => {
    const deku = CUSTOM_TRANSCENDANCE_CARDS.find((card) => card.id === "trans-deku");
    if (!deku) throw new Error("Deku Transcendance absent.");
    vi.spyOn(Math, "random").mockReturnValue(0).mockReturnValueOnce(0.9996);
    const draw = createLocalGuestDraw(cards.map((card) => ({ ...card, role: "protagoniste" })), pack, 1, [deku]);
    expect(draw[0]).toMatchObject({ card: { id: "trans-deku", image_url: "/deku%20vigilante.jpg" }, customTranscendance: true });
  });

  it.each(["shonen", "protagoniste"] as const)("can draw Bakugo as an exclusive in %s", (pack) => {
    const bakugo = CUSTOM_TRANSCENDANCE_CARDS.find((card) => card.id === "trans-bakugo");
    if (!bakugo) throw new Error("Bakugo Transcendance absent.");
    vi.spyOn(Math, "random").mockReturnValue(0).mockReturnValueOnce(0.9996);
    const draw = createLocalGuestDraw(cards.map((card) => ({ ...card, role: "protagoniste" })), pack, 1, [bakugo]);
    expect(draw[0]).toMatchObject({ card: { id: "trans-bakugo", image_url: "/katchan.jpg", image_position: "center", image_scale: 0.92 }, customTranscendance: true });
  });

  it.each(["shonen", "antagoniste"] as const)("can draw Shigaraki as an exclusive in %s", (pack) => {
    const shigaraki = CUSTOM_TRANSCENDANCE_CARDS.find((card) => card.id === "trans-shigaraki");
    if (!shigaraki) throw new Error("Shigaraki Transcendance absent.");
    vi.spyOn(Math, "random").mockReturnValue(0).mockReturnValueOnce(0.9996);
    const draw = createLocalGuestDraw(cards.map((card) => ({ ...card, role: "antagoniste" })), pack, 1, [shigaraki]);
    expect(draw[0]).toMatchObject({ card: { id: "trans-shigaraki", image_url: "/shigaraki.jpg" }, customTranscendance: true });
  });

  it("draws Demon Slayer heroes as Mythique rather than exclusive cards", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    for (const hero of DEMON_SLAYER_MYTHIC_CARDS) {
      vi.mocked(Math.random).mockReturnValueOnce(0.9975);
      const draw = createLocalGuestDraw([...cards.map((card) => ({ ...card, role: "protagoniste" as const })), hero], "protagoniste", 1, []);
      expect(draw[0]).toMatchObject({ card: { id: hero.id, rarity: "mythique" } });
      expect(draw[0]?.customTranscendance).toBeUndefined();
    }
  });

});
