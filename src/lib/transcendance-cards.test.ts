import { describe, expect, it } from "vitest";
import { CUSTOM_TRANSCENDANCE_CARDS } from "./transcendance-cards";

describe("dedicated Transcendance catalogue", () => {
  it("contains the six configured Transcendance cards with their pack assignments", () => {
    expect(CUSTOM_TRANSCENDANCE_CARDS).toEqual([
      {
        id: "goku-ui-transcendance",
        name: "Goku Ultra Instinct",
        anime: "Dragon Ball Super",
        image_url: "/goku%20ui.png",
        pack_ids: ["shonen"],
        rarity: "Transcendance",
      },
      {
        id: "goku-black-rose-transcendance",
        name: "Goku Black Rosé",
        anime: "Dragon Ball Super",
        image_url: "/blackj%20goku%20rose.jpg",
        pack_ids: ["antagoniste", "shonen"],
        rarity: "Transcendance",
      },
      {
        id: "naruto-baryon-transcendance",
        name: "Naruto Mode Baryon",
        anime: "Naruto Shippuden",
        image_url: "/naruto%20bayron.jpg",
        pack_ids: ["shonen", "protagoniste"],
        rarity: "Transcendance",
      },
      {
        id: "borushiki-transcendance",
        name: "Borushiki",
        anime: "Boruto",
        image_url: "/borushiki.jpg",
        pack_ids: ["shonen", "protagoniste"],
        rarity: "Transcendance",
      },
      {
        id: "ichigo-bankai-transcendance",
        name: "Ichigo Kurosaki (Bankai)",
        anime: "Bleach",
        image_url: "/ichigo%20bankai.webp",
        pack_ids: ["shonen", "protagoniste"],
        rarity: "Transcendance",
      },
      {
        id: "sukuna-fuga-transcendance",
        name: "Ryomen Sukuna (Fuga)",
        anime: "Jujutsu Kaisen",
        image_url: "/sukuna%20eveil%201.jpg",
        pack_ids: ["antagoniste", "shonen"],
        rarity: "Transcendance",
      },
    ]);
  });
});
