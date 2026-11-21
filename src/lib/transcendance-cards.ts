import type { Card, Genre, PackId } from "./cards";

export type CustomTranscendanceCard = {
  id: string;
  name: string;
  anime: string;
  image_url: string;
  pack_ids: PackId[];
  rarity: "Transcendance";
  series_number: string;
};

/** Dedicated Transcendance cards stay outside the standard database catalogue. */
export const CUSTOM_TRANSCENDANCE_CARDS: CustomTranscendanceCard[] = [
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
];

const GENRES: readonly Genre[] = ["shonen", "seinen", "shojo", "sport"];

export function customTranscendanceAsCard(card: CustomTranscendanceCard): Card {
  const category = GENRES.find((genre) => card.pack_ids.includes(genre)) ?? null;
  const role = card.pack_ids.find((pack) => pack === "antagoniste" || pack === "protagoniste") ?? null;
  return {
    id: card.id,
    name: card.name,
    title: card.anime,
    rarity: "mythique",
    description: "Carte Transcendance exclusive.",
    sort_order: -1,
    category,
    series: card.anime,
    role,
    image_url: card.image_url,
    transcendance_series_number: card.series_number,
  };
}
