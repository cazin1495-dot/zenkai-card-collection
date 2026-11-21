import { describe, expect, it } from "vitest";
import { CUSTOM_TRANSCENDANCE_CARDS } from "./transcendance-cards";

describe("dedicated Transcendance catalogue", () => {
  it("contains the seven configured Transcendance cards with their pack assignments", () => {
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
    ]);
  });
});
