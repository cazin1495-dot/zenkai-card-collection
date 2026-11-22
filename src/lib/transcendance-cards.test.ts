import { describe, expect, it } from "vitest";
import { inPack, isTranscendanceCatalogCard } from "./cards";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard, customTranscendanceInPack } from "./transcendance-cards";

describe("dedicated Transcendance catalogue", () => {
  it("contains the configured Transcendance cards with their pack assignments", () => {
    expect(CUSTOM_TRANSCENDANCE_CARDS).toEqual([
      {
        id: "goku-ui-transcendance",
        name: "Goku Ultra Instinct",
        anime: "Dragon Ball Super",
        image_url: "/goku%20ui.png",
        pack_ids: ["shonen"],
        rarity: "Transcendance",
        series_number: "ZEN-001-TR",
      },
      {
        id: "goku-black-rose-transcendance",
        name: "Goku Black Rosé",
        anime: "Dragon Ball Super",
        image_url: "/blackj%20goku%20rose.jpg",
        pack_ids: ["antagoniste", "shonen"],
        rarity: "Transcendance",
        series_number: "ZEN-002-TR",
      },
      {
        id: "naruto-baryon-transcendance",
        name: "Naruto Mode Baryon",
        anime: "Naruto Shippuden",
        image_url: "/naruto%20bayron.jpg",
        pack_ids: ["shonen", "protagoniste"],
        rarity: "Transcendance",
        series_number: "ZEN-003-TR",
      },
      {
        id: "borushiki-transcendance",
        name: "Borushiki",
        anime: "Boruto",
        image_url: "/borushiki.jpg",
        pack_ids: ["shonen", "protagoniste"],
        rarity: "Transcendance",
        series_number: "ZEN-004-TR",
      },
      {
        id: "ichigo-bankai-transcendance",
        name: "Ichigo Kurosaki (Bankai)",
        anime: "Bleach",
        image_url: "/ichigo%20bankai.webp",
        pack_ids: ["shonen", "protagoniste"],
        rarity: "Transcendance",
        series_number: "ZEN-005-TR",
      },
      {
        id: "sukuna-fuga-transcendance",
        name: "Ryomen Sukuna (Fuga)",
        anime: "Jujutsu Kaisen",
        image_url: "/sukuna%20eveil%201.jpg",
        pack_ids: ["antagoniste", "shonen"],
        rarity: "Transcendance",
        series_number: "ZEN-006-TR",
      },
      {
        id: "luffy-gear-5-transcendance",
        name: "Monkey D. Luffy (Gear 5)",
        anime: "One Piece",
        image_url: "/luffy%20gear%205.jpg",
        pack_ids: ["shonen", "protagoniste"],
        rarity: "Transcendance",
        series_number: "ZEN-007-TR",
      },
      {
        id: "trans-gon",
        name: "Gon Freecss · Serment Absolu",
        anime: "Hunter x Hunter",
        title: "Hunter x Hunter · Sacrifice Ultime",
        description: "Tout le potentiel d'une vie libéré en un seul instant d'ombre et de lumière.",
        popularity: 99500,
        image_url: "/gon%20adulte.webp",
        pack_ids: ["shonen", "protagoniste"],
        rarity: "Transcendance",
        series_number: "ZEN-008-TR",
      },
      {
        id: "trans-deku",
        name: "Izuku Midoriya · Vigilante",
        anime: "My Hero Academia",
        title: "My Hero Academia · Héros Solitaire",
        description: "Portant seul le poids du One For All dans l'ombre, déterminé à protéger tout le monde.",
        popularity: 99400,
        image_url: "/deku%20vigilante.jpg",
        pack_ids: ["shonen", "protagoniste"],
        rarity: "Transcendance",
        series_number: "ZEN-009-TR",
      },
      {
        id: "trans-bakugo",
        name: "Katsuki Bakugo · Dynamight",
        anime: "My Hero Academia",
        title: "My Hero Academia · Explosion Ultime",
        description: "La fureur explosive d'un génie du combat prêt à tout surpasser pour la victoire.",
        popularity: 99350,
        image_url: "/katchan.jpg",
        image_position: "center",
        image_scale: 0.92,
        pack_ids: ["shonen", "protagoniste"],
        rarity: "Transcendance",
        series_number: "ZEN-010-TR",
      },
      {
        id: "trans-shigaraki",
        name: "Shigaraki Transcendant",
        anime: "My Hero Academia",
        title: "My Hero Academia · Héritier de la Destruction",
        description: "Animé par la désintégration, Shigaraki menace de réduire le monde des héros en cendres.",
        image_url: "/shigaraki.jpg",
        image_position: "center",
        image_scale: 0.92,
        pack_ids: ["shonen", "antagoniste"],
        rarity: "Transcendance",
        series_number: "ZEN-011-TR",
      },
    ]);
  });

  it("classifies and routes Gon as a dedicated Transcendance card", () => {
    const gon = CUSTOM_TRANSCENDANCE_CARDS.find((card) => card.id === "trans-gon");
    if (!gon) throw new Error("Gon Transcendance absent.");
    const card = customTranscendanceAsCard(gon);
    expect(card).toMatchObject({
      id: "trans-gon", name: gon.name, title: gon.title, description: gon.description,
      series: "Hunter x Hunter", category: "shonen", role: "protagoniste",
      popularity: 99500, image_url: "/gon%20adulte.webp",
    });
    expect(isTranscendanceCatalogCard(card)).toBe(true);
    for (const pack of ["shonen", "protagoniste", "zenkai"] as const) {
      expect(customTranscendanceInPack(gon, pack)).toBe(true);
      expect(inPack(card, pack)).toBe(true);
    }
    expect(customTranscendanceInPack(gon, "antagoniste")).toBe(false);
    expect(inPack(card, "antagoniste")).toBe(false);
  });

  it("classifies and routes Deku as a dedicated Transcendance card", () => {
    const deku = CUSTOM_TRANSCENDANCE_CARDS.find((card) => card.id === "trans-deku");
    if (!deku) throw new Error("Deku Transcendance absent.");
    const card = customTranscendanceAsCard(deku);
    expect(card).toMatchObject({
      id: "trans-deku", name: deku.name, title: deku.title, description: deku.description,
      series: "My Hero Academia", category: "shonen", role: "protagoniste",
      popularity: 99400, image_url: "/deku%20vigilante.jpg",
    });
    expect(isTranscendanceCatalogCard(card)).toBe(true);
    for (const pack of ["shonen", "protagoniste", "zenkai"] as const) {
      expect(customTranscendanceInPack(deku, pack)).toBe(true);
      expect(inPack(card, pack)).toBe(true);
    }
    expect(customTranscendanceInPack(deku, "antagoniste")).toBe(false);
    expect(inPack(card, "antagoniste")).toBe(false);
  });

  it("classifies and routes Bakugo as a dedicated Transcendance card", () => {
    const bakugo = CUSTOM_TRANSCENDANCE_CARDS.find((card) => card.id === "trans-bakugo");
    if (!bakugo) throw new Error("Bakugo Transcendance absent.");
    const card = customTranscendanceAsCard(bakugo);
    expect(card).toMatchObject({
      id: "trans-bakugo", name: bakugo.name, title: bakugo.title, description: bakugo.description,
      series: "My Hero Academia", category: "shonen", role: "protagoniste",
      popularity: 99350, image_url: "/katchan.jpg", image_position: "center", image_scale: 0.92,
    });
    expect(isTranscendanceCatalogCard(card)).toBe(true);
    for (const pack of ["shonen", "protagoniste", "zenkai"] as const) {
      expect(customTranscendanceInPack(bakugo, pack)).toBe(true);
      expect(inPack(card, pack)).toBe(true);
    }
    expect(customTranscendanceInPack(bakugo, "antagoniste")).toBe(false);
    expect(inPack(card, "antagoniste")).toBe(false);
  });

  it("routes Shigaraki as a My Hero Academia antagonist", () => {
    const shigaraki = CUSTOM_TRANSCENDANCE_CARDS.find((card) => card.id === "trans-shigaraki");
    if (!shigaraki) throw new Error("Shigaraki Transcendance absent.");
    const card = customTranscendanceAsCard(shigaraki);
    expect(card).toMatchObject({
      series: "My Hero Academia", category: "shonen", role: "antagoniste",
      image_url: "/shigaraki.jpg", image_position: "center", image_scale: 0.92,
    });
    expect(isTranscendanceCatalogCard(card)).toBe(true);
    for (const pack of ["shonen", "antagoniste", "zenkai"] as const) {
      expect(customTranscendanceInPack(shigaraki, pack)).toBe(true);
      expect(inPack(card, pack)).toBe(true);
    }
    expect(customTranscendanceInPack(shigaraki, "protagoniste")).toBe(false);
    expect(inPack(card, "protagoniste")).toBe(false);
  });

});
