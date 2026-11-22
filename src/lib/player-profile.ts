import { z } from "zod";
import { cardArt, cardIdentity, isTranscendanceCatalogCard, rarityRank, type Card } from "./cards";
import { MILESTONES } from "./economy";
import { SECRET_QUESTS, type SecretQuestState } from "./quests";

export const PLAYER_PROFILE_KEY = "zenkai_player_profile";
export const PLAYER_PROFILE_UPDATED = "zenkai:player-profile-updated";

const showcaseSlot = z.string().min(1).nullable();
const profileSchema = z
  .object({
    username: z.string().trim().min(1).max(30),
    bio: z.string().max(160),
    avatarCardId: z.string().min(1).nullable(),
    avatarFrame: z.enum(["steel", "solar", "imperial", "rainbow"]),
    equippedTitle: z.string().min(1).max(200),
    showcaseCardIds: z.tuple([
      showcaseSlot,
      showcaseSlot,
      showcaseSlot,
      showcaseSlot,
      showcaseSlot,
      showcaseSlot,
      showcaseSlot,
      showcaseSlot,
    ]),
    banner: z.enum(["solar", "imperial", "cosmic"]),
  })
  .strict();
const legacyProfileSchema = profileSchema.extend({
  showcaseCardIds: z.tuple([showcaseSlot, showcaseSlot, showcaseSlot, showcaseSlot]),
});

export type PlayerProfile = z.infer<typeof profileSchema>;
export type ProfileCopy = {
  card_id: string;
  transcended: boolean;
  customTranscendance?: boolean | undefined;
};
export type ProfileCard = { card: Card; copy: ProfileCopy };
export type ProfileFrame = PlayerProfile["avatarFrame"];

export const PROFILE_FRAMES: { id: ProfileFrame; name: string; requirement: string }[] = [
  { id: "steel", name: "Classique · Acier", requirement: "Disponible dès le départ" },
  { id: "solar", name: "Or Solaire", requirement: "Niveau local 2" },
  { id: "imperial", name: "Violet Impérial", requirement: "Niveau local 4" },
  {
    id: "rainbow",
    name: "Arc-en-Ciel Transcendance",
    requirement: "Posséder une carte Transcendance",
  },
];

export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  username: "Joueur",
  bio: "",
  avatarCardId: null,
  avatarFrame: "steel",
  equippedTitle: "Novice Zenkai",
  showcaseCardIds: [null, null, null, null, null, null, null, null],
  banner: "solar",
};

export function getPlayerProfile(): PlayerProfile {
  const raw = window.localStorage.getItem(PLAYER_PROFILE_KEY);
  if (raw === null)
    return {
      ...DEFAULT_PLAYER_PROFILE,
      showcaseCardIds: [...DEFAULT_PLAYER_PROFILE.showcaseCardIds],
    };
  const stored: unknown = JSON.parse(raw);
  const parsed = profileSchema.safeParse(stored);
  if (parsed.success) return parsed.data;
  const legacy = legacyProfileSchema.safeParse(stored);
  if (!legacy.success) throw new Error("Profil local invalide.");
  const migrated: PlayerProfile = {
    ...legacy.data,
    showcaseCardIds: [...legacy.data.showcaseCardIds, null, null, null, null],
  };
  window.localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(migrated));
  window.dispatchEvent(new Event(PLAYER_PROFILE_UPDATED));
  return migrated;
}

export function getCustomPlayerUsername() {
  if (window.localStorage.getItem(PLAYER_PROFILE_KEY) === null) return null;
  return getPlayerProfile().username;
}

export function savePlayerProfile(
  profile: PlayerProfile,
  allowed: {
    ownedIds: ReadonlySet<string>;
    avatarIds: ReadonlySet<string>;
    frames: ReadonlySet<ProfileFrame>;
    titles: ReadonlySet<string>;
  },
) {
  const parsed = profileSchema.safeParse(profile);
  if (!parsed.success)
    throw new Error("Vérifie le pseudo (1 à 30 caractères) et la bio (160 caractères maximum).");
  const value = parsed.data;
  if (value.avatarCardId && !allowed.avatarIds.has(value.avatarCardId))
    throw new Error("L'avatar choisi n'est plus dans le catalogue.");
  if (value.showcaseCardIds.some((id) => id !== null && !allowed.ownedIds.has(id)))
    throw new Error("Une carte de la vitrine n'est plus dans cette collection.");
  if (!allowed.frames.has(value.avatarFrame)) throw new Error("Ce cadre n'est pas débloqué.");
  if (!allowed.titles.has(value.equippedTitle)) throw new Error("Ce titre n'est pas débloqué.");
  window.localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(PLAYER_PROFILE_UPDATED));
}

export function profileCards(
  cards: readonly Card[],
  copies: readonly ProfileCopy[],
): ProfileCard[] {
  const catalog = new Map(cards.map((card) => [card.id, card]));
  const result = new Map<string, ProfileCard>();
  for (const copy of copies) {
    const card = catalog.get(copy.card_id);
    if (!card) continue;
    const previous = result.get(card.id);
    if (
      !previous ||
      (!(previous.copy.transcended || previous.copy.customTranscendance) &&
        (copy.transcended || copy.customTranscendance))
    ) {
      result.set(card.id, { card, copy });
    }
  }
  return [...result.values()].sort(
    (a, b) =>
      profileRarityRank(a) - profileRarityRank(b) || a.card.name.localeCompare(b.card.name, "fr"),
  );
}

export function profileRarityRank(item: ProfileCard) {
  return rarityRank(
    item.copy.transcended || item.copy.customTranscendance || isTranscendanceCatalogCard(item.card)
      ? "transcendance"
      : item.card.rarity,
  );
}

export function profilePortrait(item: ProfileCard) {
  return {
    src: cardArt(item.card, item.copy.transcended),
    name: cardIdentity(item.card, item.copy.transcended).name,
  };
}

export function unlockedProfileFrames(
  level: number,
  cards: readonly ProfileCard[],
  copies: readonly ProfileCopy[],
): Set<ProfileFrame> {
  const frames = new Set<ProfileFrame>(["steel"]);
  if (level >= 2) frames.add("solar");
  if (level >= 4) frames.add("imperial");
  if (
    copies.some((copy) => copy.transcended || copy.customTranscendance) ||
    cards.some((item) => profileRarityRank(item) === 0)
  )
    frames.add("rainbow");
  return frames;
}

export function profileTitles(
  level: number,
  albums: readonly string[],
  secrets: SecretQuestState,
  series: readonly string[],
  betaWelcomeClaimed = false,
) {
  const titles = [
    { name: "Novice Zenkai", unlocked: true, requirement: "Disponible dès le départ" },
    { name: "Collectionneur", unlocked: true, requirement: "Disponible dès le départ" },
    { name: "Pionnier Bêta", unlocked: betaWelcomeClaimed, requirement: "Pack de bienvenue bêta" },
    ...MILESTONES.map(([required, name]) => ({
      name,
      unlocked: level >= required,
      requirement: `Niveau local ${required}`,
    })),
    ...SECRET_QUESTS.flatMap((quest) =>
      "title" in quest
        ? [
            {
              name: quest.title,
              unlocked: secrets.claimed.includes(quest.id),
              requirement: "Succès secret",
            },
          ]
        : [],
    ),
    ...[...new Set([...series, ...albums])]
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((name) => ({
        name: `Maître ${name}`,
        unlocked: albums.includes(name),
        requirement: "Récompense d'album réclamée",
      })),
  ];
  return titles.filter(
    (title, index) => titles.findIndex((other) => other.name === title.name) === index,
  );
}

export function completedAlbumCount(cards: readonly Card[], ownedIds: ReadonlySet<string>) {
  const groups = new Map<string, Set<string>>();
  for (const card of cards) {
    const series = card.series?.trim();
    if (!series) continue;
    const ids = groups.get(series) ?? new Set<string>();
    ids.add(card.id);
    groups.set(series, ids);
  }
  return [...groups.values()].filter((ids) => [...ids].every((id) => ownedIds.has(id))).length;
}
