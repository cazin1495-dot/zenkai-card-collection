import { getGuestState, updateGuestState, type GuestState } from "./guest-collection";
import { isTranscendanceCatalogCard, type Card, type PulledCard } from "./cards";
import { addXp } from "./level";

type QuestId = "open3" | "open10" | "recycle5" | "unique25" | "mythic" | "transcendance";
type QuestState = {
  day: string;
  boosters: number;
  recycled: number;
  dailyClaimed: QuestId[];
  achievementClaimed: QuestId[];
  unique: number;
  mythic: boolean;
  transcendance: boolean;
  albums: string[];
  discovered?: string[];
};
type Copy = { card_id: string; transcended: boolean; customTranscendance?: boolean | undefined };

export const QUESTS: { id: QuestId; label: string; target: number; reward: number; xp: number; daily: boolean }[] = [
  { id: "open3", label: "Ouvrir 3 boosters aujourd'hui", target: 3, reward: 120, xp: 50, daily: true },
  { id: "open10", label: "Ouvrir 10 boosters aujourd'hui", target: 10, reward: 350, xp: 100, daily: true },
  { id: "recycle5", label: "Recycler 5 doublons aujourd'hui", target: 5, reward: 150, xp: 75, daily: true },
  { id: "unique25", label: "Posséder 25 cartes uniques", target: 25, reward: 250, xp: 100, daily: false },
  { id: "mythic", label: "Obtenir une carte Mythique", target: 1, reward: 400, xp: 150, daily: false },
  { id: "transcendance", label: "Obtenir une carte Transcendance", target: 1, reward: 1000, xp: 300, daily: false },
];

export const SECRET_QUESTS = [
  { id: "night", name: "Collectionneur Nocturne", action: "Ouvrir un booster entre 00h00 et 04h59.", zen: 500, xp: 250, title: "Oiseau de Nuit" },
  { id: "recycle", name: "Maître Alchimiste", action: "Recycler 50 cartes en doublon au total.", zen: 300, xp: 150 },
  { id: "zero", name: "Tout ou Rien", action: "Tomber à 0 Zen après un achat.", zen: 500, xp: 300, title: "Joueur Sans Filet" },
  { id: "miracle", name: "Double Miracle", action: "Obtenir au moins 2 cartes Mythiques ou Transcendance dans un tirage x10.", zen: 800, xp: 500, title: "Béni des Dieux" },
  { id: "clicker", name: "Le Cliqueteur Fou", action: "Cliquer 10 fois de suite sur le logo Zenkai.", zen: 500, xp: 200 },
  { id: "word", name: "Chercheur de Faille", action: "Taper zenkai au clavier hors d'un champ de saisie.", zen: 600, xp: 350 },
  { id: "mirror", name: "Vœu à 11h11", action: "Ouvrir un booster à une heure miroir.", zen: 1111, xp: 400 },
  { id: "dragon", name: "Le Rituel des 7 Boules", action: "Posséder 7 cartes uniques Dragon Ball.", zen: 500, xp: 250, title: "Invocateur de Shenron" },
  { id: "konami", name: "Le Code Konami", action: "Saisir le code Konami au clavier hors d'un champ de saisie.", zen: 1500, xp: 500, title: "Légende Rétro" },
  { id: "crew", name: "L'Équipage au Complet", action: "Posséder 10 cartes uniques One Piece.", zen: 900, xp: 400, title: "Roi des Pirates" },
] as const;
export type SecretQuestId = (typeof SECRET_QUESTS)[number]["id"];
export type SecretQuestState = { unlocked: SecretQuestId[]; claimed: SecretQuestId[]; recycled: number; clickerResetDone?: boolean; clickerManualResetDone?: boolean };

export function readSecretQuests(raw: unknown): SecretQuestState {
  if (raw === undefined) return { unlocked: [], claimed: [], recycled: 0 };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Succès secrets invalides.");
  const state = raw as Record<string, unknown>;
  const validIds = (value: unknown): value is SecretQuestId[] => Array.isArray(value) &&
    value.every((id) => SECRET_QUESTS.some((quest) => quest.id === id)) && new Set(value).size === value.length;
  const unlocked = state["unlocked"];
  const claimed = state["claimed"];
  if (!validIds(unlocked) || !validIds(claimed) ||
      claimed.some((id) => !unlocked.includes(id)) ||
      typeof state["recycled"] !== "number" || !Number.isSafeInteger(state["recycled"]) || state["recycled"] < 0 ||
      (state["clickerResetDone"] !== undefined && typeof state["clickerResetDone"] !== "boolean") ||
      (state["clickerManualResetDone"] !== undefined && typeof state["clickerManualResetDone"] !== "boolean")) {
    throw new Error("Succès secrets invalides.");
  }
  return { unlocked, claimed, recycled: state["recycled"], ...(state["clickerResetDone"] === true ? { clickerResetDone: true } : {}), ...(state["clickerManualResetDone"] === true ? { clickerManualResetDone: true } : {}) };
}

export function getSecretQuests() { return readSecretQuests(getGuestState().secrets); }

function creditSecrets(state: GuestState, ids: readonly SecretQuestId[]): GuestState {
  const secrets = readSecretQuests(state.secrets);
  const pending = [...new Set(ids)].filter((id) => !secrets.claimed.includes(id));
  if (!pending.length) return state;
  const rewards = SECRET_QUESTS.filter((quest) => pending.includes(quest.id));
  if (rewards.length !== pending.length) throw new Error("Succès secret inconnu.");
  const withXp = addXp(state, rewards.reduce((sum, quest) => sum + quest.xp, 0));
  return {
    ...withXp,
    zen: withXp.zen + rewards.reduce((sum, quest) => sum + quest.zen, 0),
    secrets: { ...secrets, unlocked: [...new Set([...secrets.unlocked, ...pending])], claimed: [...secrets.claimed, ...pending] },
  };
}

export function withUnlockedSecrets(state: GuestState, ids: readonly SecretQuestId[]): GuestState {
  const secrets = readSecretQuests(state.secrets);
  return creditSecrets(state, ids.filter((id) => !secrets.unlocked.includes(id)));
}

export function creditPendingSecrets() {
  const current = getSecretQuests();
  if (current.unlocked.every((id) => current.claimed.includes(id))) return;
  updateGuestState((state) => {
    const secrets = readSecretQuests(state.secrets);
    return { state: creditSecrets(state, secrets.unlocked), result: undefined };
  });
}

export function unlockSecret(id: SecretQuestId) {
  const current = getSecretQuests();
  if (current.unlocked.includes(id)) return;
  updateGuestState((state) => ({ state: withUnlockedSecrets(state, [id]), result: undefined }));
}

export function recordSecretDraw(count: number, pulled: readonly PulledCard[]) {
  if (count === 10 && pulled.filter((item) => item.transcended || item.customTranscendance ||
    isTranscendanceCatalogCard(item.card) || item.card.rarity === "mythique").length >= 2) {
    unlockSecret("miracle");
  }
}

export const DAILY_LOGIN_KEY = "zenkai_daily_login";
export const DAILY_LOGIN_REWARDS = [
  { zen: 100, xp: 50 }, { zen: 150, xp: 75 }, { zen: 200, xp: 100 },
  { zen: 250, xp: 125 }, { zen: 350, xp: 150 }, { zen: 500, xp: 200 },
  { zen: 1000, xp: 400 },
] as const;

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function today() { return localDate(new Date()); }

export function getDailyLogin() {
  const raw = window.localStorage.getItem(DAILY_LOGIN_KEY);
  if (raw === null) return { streak: 0, day: 1, claimed: false };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Bonus de connexion invalide.");
  const { streak, lastClaimDate } = value as Record<string, unknown>;
  if (typeof streak !== "number" || !Number.isInteger(streak) || streak < 1 || streak > 7 ||
      typeof lastClaimDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(lastClaimDate)) {
    throw new Error("Bonus de connexion invalide.");
  }
  const year = Number(lastClaimDate.slice(0, 4));
  const month = Number(lastClaimDate.slice(5, 7));
  const day = Number(lastClaimDate.slice(8, 10));
  const date = new Date(year, month - 1, day, 12);
  if (localDate(date) !== lastClaimDate || lastClaimDate > today()) throw new Error("Date du bonus de connexion invalide.");
  if (lastClaimDate === today()) return { streak, day: streak, claimed: true };
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const next = lastClaimDate === localDate(yesterday) && streak < 7 ? streak + 1 : 1;
  return { streak: next - 1, day: next, claimed: false };
}

export function claimDailyLogin() {
  const login = getDailyLogin();
  if (login.claimed) throw new Error("Bonus déjà réclamé aujourd'hui.");
  const reward = DAILY_LOGIN_REWARDS[login.day - 1];
  if (!reward) throw new Error("Récompense de connexion invalide.");
  const previous = window.localStorage.getItem(DAILY_LOGIN_KEY);
  window.localStorage.setItem(DAILY_LOGIN_KEY, JSON.stringify({ streak: login.day, lastClaimDate: today() }));
  try {
    updateGuestState((guest) => {
      const withXp = addXp(guest, reward.xp);
      return { state: { ...withXp, zen: withXp.zen + reward.zen }, result: undefined };
    });
  } catch (error) {
    if (previous === null) window.localStorage.removeItem(DAILY_LOGIN_KEY);
    else window.localStorage.setItem(DAILY_LOGIN_KEY, previous);
    throw error;
  }
  return { day: login.day, ...reward };
}

function key(userId: string | null) { return userId ? `account:${userId}` : "guest"; }
function empty(): QuestState {
  return { day: today(), boosters: 0, recycled: 0, dailyClaimed: [], achievementClaimed: [], unique: 0, mythic: false, transcendance: false, albums: [] };
}
function read(quests: unknown, userId: string | null): QuestState {
  if (quests === undefined) return empty();
  if (!quests || typeof quests !== "object" || Array.isArray(quests)) throw new Error("Données de quêtes invalides.");
  const raw: unknown = (quests as Record<string, unknown>)[key(userId)];
  if (raw === undefined) return empty();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Données de quêtes invalides.");
  const s = raw as Record<string, unknown>;
  const count = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  const strings = (v: unknown) => Array.isArray(v) && v.every((item) => typeof item === "string");
  if (typeof s["day"] !== "string" || !count(s["boosters"]) || !count(s["recycled"]) || !count(s["unique"]) ||
      typeof s["mythic"] !== "boolean" || typeof s["transcendance"] !== "boolean" ||
      !strings(s["dailyClaimed"]) || !strings(s["achievementClaimed"]) || !strings(s["albums"]) ||
      (s["discovered"] !== undefined && !strings(s["discovered"]))) {
    throw new Error("Données de quêtes invalides.");
  }
  const state = raw as QuestState;
  return state.day === today() ? state : { ...state, day: today(), boosters: 0, recycled: 0, dailyClaimed: [] };
}

export function getQuestState(userId: string | null) {
  return read(getGuestState().quests, userId);
}

export function recordQuestActivity(userId: string | null, activity: "boosters" | "recycled", count: number) {
  if (!Number.isSafeInteger(count) || count <= 0) throw new Error("Progression invalide.");
  updateGuestState((guest) => {
    const state = read(guest.quests, userId);
    const value = state[activity] + count;
    if (!Number.isSafeInteger(value)) throw new Error("Progression invalide.");
    let withXp = addXp(guest, count * (activity === "boosters" ? 25 : 5));
    if (activity === "recycled") {
      const secrets = readSecretQuests(guest.secrets);
      const recycled = secrets.recycled + count;
      if (!Number.isSafeInteger(recycled)) throw new Error("Progression invalide.");
      withXp = { ...withXp, secrets: { ...secrets, recycled } };
      if (recycled >= 50) withXp = withUnlockedSecrets(withXp, ["recycle"]);
    }
    return { state: { ...withXp, quests: { ...(guest.quests as Record<string, unknown> | undefined), [key(userId)]: { ...state, [activity]: value } } }, result: undefined };
  });
}

export function recordBoosterOpen(userId: string | null, count: number, previouslyOwned: Iterable<string>, drawn: Iterable<string>, openedAt = new Date()) {
  if (!Number.isSafeInteger(count) || count <= 0) throw new Error("Progression invalide.");
  updateGuestState((guest) => {
    const state = read(guest.quests, userId);
    const known = new Set([...(state.discovered ?? []), ...previouslyOwned]);
    let newCards = 0;
    for (const id of drawn) {
      if (!known.has(id)) { known.add(id); newCards++; }
    }
    const boosters = state.boosters + count;
    if (!Number.isSafeInteger(boosters)) throw new Error("Progression invalide.");
    const ids: SecretQuestId[] = [];
    if (openedAt.getHours() < 5) ids.push("night");
    if (openedAt.getHours() === openedAt.getMinutes()) ids.push("mirror");
    const withXp = withUnlockedSecrets(addXp(guest, count * 25 + newCards * 40), ids);
    return { state: { ...withXp, quests: { ...(guest.quests as Record<string, unknown> | undefined), [key(userId)]: { ...state, boosters, discovered: [...known] } } }, result: undefined };
  });
}

export function observeQuestCollection(userId: string | null, cards: Card[], copies: readonly Copy[]) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const unique = new Set(copies.map((copy) => copy.card_id)).size;
  const mythic = copies.some((copy) => {
    const card = byId.get(copy.card_id);
    return card?.rarity === "mythique" && !copy.customTranscendance && !isTranscendanceCatalogCard(card);
  });
  const transcendance = copies.some((copy) => {
    const card = byId.get(copy.card_id);
    return copy.transcended || copy.customTranscendance || (card && isTranscendanceCatalogCard(card));
  });
  const old = getQuestState(userId);
  const ids = new Set(copies.map((copy) => copy.card_id));
  const seriesCount = (series: string) => [...ids].filter((id) => {
    const name = byId.get(id)?.series?.trim().toLowerCase();
    return name === series || name?.startsWith(`${series} `);
  }).length;
  const secretIds: SecretQuestId[] = [];
  if (seriesCount("dragon ball") >= 7) secretIds.push("dragon");
  if (seriesCount("one piece") >= 10) secretIds.push("crew");
  const secrets = getSecretQuests();
  const alreadyDiscovered = new Set(old.discovered);
  if (old.discovered && [...ids].every((id) => alreadyDiscovered.has(id)) &&
      unique <= old.unique && (!mythic || old.mythic) && (!transcendance || old.transcendance) &&
      secretIds.every((id) => secrets.unlocked.includes(id))) return;
  updateGuestState((guest) => {
    const state = read(guest.quests, userId);
    const known = new Set(state.discovered ?? []);
    let newlyDiscovered = 0;
    for (const id of ids) {
      if (!known.has(id)) { known.add(id); if (state.discovered) newlyDiscovered++; }
    }
    const withXp = withUnlockedSecrets(addXp(guest, newlyDiscovered * 40), secretIds);
    return {
      state: { ...withXp, quests: { ...(guest.quests as Record<string, unknown> | undefined), [key(userId)]: {
        ...state, discovered: [...known], unique: Math.max(state.unique, unique),
        mythic: state.mythic || mythic, transcendance: state.transcendance || !!transcendance,
      } } },
      result: undefined,
    };
  });
}

export function questProgress(state: QuestState, id: QuestId) {
  switch (id) {
    case "open3": case "open10": return state.boosters;
    case "recycle5": return state.recycled;
    case "unique25": return state.unique;
    case "mythic": return Number(state.mythic);
    case "transcendance": return Number(state.transcendance);
  }
}

export function availableQuestCount(state: QuestState) {
  return QUESTS.filter((quest) => questProgress(state, quest.id) >= quest.target &&
    !(quest.daily ? state.dailyClaimed : state.achievementClaimed).includes(quest.id)).length;
}

export function claimQuest(userId: string | null, id: QuestId) {
  const quest = QUESTS.find((item) => item.id === id);
  if (!quest) throw new Error("Quête inconnue.");
  return updateGuestState((guest) => {
    const state = read(guest.quests, userId);
    const field = quest.daily ? "dailyClaimed" : "achievementClaimed";
    if (state[field].includes(id) || questProgress(state, id) < quest.target) throw new Error("Récompense indisponible.");
    const withXp = addXp(guest, quest.xp);
    return {
      state: { ...withXp, zen: withXp.zen + quest.reward, quests: { ...(guest.quests as Record<string, unknown> | undefined), [key(userId)]: { ...state, [field]: [...state[field], id] } } },
      result: quest.reward,
    };
  });
}

export function claimAlbum(userId: string | null, series: string, cards: Card[], copies: readonly Copy[]) {
  const ids = new Set(cards.filter((card) => card.series?.trim() === series).map((card) => card.id));
  const owned = new Set(copies.map((copy) => copy.card_id));
  if (!series || !ids.size || [...ids].some((id) => !owned.has(id))) throw new Error("Album incomplet.");
  return updateGuestState((guest) => {
    const state = read(guest.quests, userId);
    if (state.albums.includes(series)) throw new Error("Récompense déjà réclamée.");
    return {
      state: { ...guest, zen: guest.zen + 500, quests: { ...(guest.quests as Record<string, unknown> | undefined), [key(userId)]: { ...state, albums: [...state.albums, series] } } },
      result: 500,
    };
  });
}
