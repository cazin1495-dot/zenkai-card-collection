import type { Card, Genre, PackId } from "./cards";

export type CustomTranscendanceCard = {
  id: string;
  name: string;
  anime: string;
  title?: string;
  description?: string;
  popularity?: number;
  image_url: string;
  image_position?: string;
  image_scale?: number;
  pack_ids: PackId[];
  rarity: "Transcendance";
  series_number: string;
};

export function customTranscendanceInPack(card: CustomTranscendanceCard, pack: PackId): boolean {
  return pack === "shonen" || pack === "zenkai" || card.pack_ids.includes(pack);
}

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
  {
    id: "trans-meliodas",
    name: "Meliodas • Mode Assaut",
    anime: "Seven Deadly Sins",
    title: "Seven Deadly Sins • Roi des Démons",
    description: "Libérant toute la noirceur de son pouvoir originel, le Capitaine des Seven Deadly Sins retrouve sa puissance terrifiante de chef des Dix Commandements.",
    popularity: 99300,
    image_url: "/meliodas%20demon.jpg",
    image_position: "center",
    image_scale: 0.95,
    pack_ids: ["shonen", "protagoniste"],
    rarity: "Transcendance",
    series_number: "ZEN-012-TR",
  },
];

const GENRES: readonly Genre[] = ["shonen", "seinen", "shojo", "sport"];

export function customTranscendanceAsCard(card: CustomTranscendanceCard): Card {
  const fallback = DEFAULT_TRANSCENDANCE_CARDS.find(
    (d) => d.id === card.id || d.name.trim().toLowerCase() === card.name.trim().toLowerCase()
  );
  const merged = fallback ? { ...fallback, ...card, image_url: card.image_url || fallback.image_url, series_number: card.series_number || fallback.series_number } : card;
  const category = GENRES.find((genre) => merged.pack_ids.includes(genre)) ?? null;
  const role = merged.pack_ids.find((pack) => pack === "antagoniste" || pack === "protagoniste") ?? null;
  return {
    id: merged.id,
    name: merged.name,
    title: merged.title ?? merged.anime,
    rarity: "mythique",
    description: merged.description ?? "Carte Transcendance exclusive.",
    sort_order: -1,
    category,
    series: merged.anime,
    role,
    image_url: merged.image_url,
    ...(merged.image_position !== undefined ? { image_position: merged.image_position } : {}),
    ...(merged.image_scale !== undefined ? { image_scale: merged.image_scale } : {}),
    ...(merged.popularity !== undefined ? { popularity: merged.popularity } : {}),
    transcendance_series_number: merged.series_number ?? "ZEN-001-TR",
  };
}
