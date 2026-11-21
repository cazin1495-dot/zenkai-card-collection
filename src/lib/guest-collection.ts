import {
  getCardRecycleValue,
  isTranscendanceCatalogCard,
  type Card,
  type CatalogRarity,
  type PulledCard,
} from "./cards";
import { GUEST_ZEN_KEY, INITIAL_ZEN } from "./shards";

export type GuestOwnedRow = {
  id: string;
  card_id: string;
  obtained_at: string;
  transcended: boolean;
  awaken_attempted: boolean;
  customTranscendance?: boolean | undefined;
};

export const GUEST_COLLECTION_KEY = "zenkai_guest_collection";
export type GuestPlus = { active: boolean; avatar: string | null; welcomeClaimed: boolean };
export type GuestState = { rows: GuestOwnedRow[]; zen: number; plus: GuestPlus; market?: unknown };
const DEFAULT_PLUS: GuestPlus = { active: false, avatar: null, welcomeClaimed: false };

function isRow(value: unknown): value is GuestOwnedRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row["id"] === "string" &&
    typeof row["card_id"] === "string" &&
    typeof row["obtained_at"] === "string" &&
    Number.isFinite(Date.parse(row["obtained_at"])) &&
    typeof row["transcended"] === "boolean" &&
    typeof row["awaken_attempted"] === "boolean" &&
    (row["customTranscendance"] === undefined || typeof row["customTranscendance"] === "boolean")
  );
}

function readState(): GuestState {
  if (typeof window === "undefined") return { rows: [], zen: INITIAL_ZEN, plus: DEFAULT_PLUS };
  const raw = window.localStorage.getItem(GUEST_COLLECTION_KEY);
  const legacyZen = window.localStorage.getItem(GUEST_ZEN_KEY);
  const parsed: unknown = raw === null ? [] : JSON.parse(raw);
  const state = Array.isArray(parsed)
    ? { rows: parsed, zen: legacyZen === null ? INITIAL_ZEN : Number(legacyZen) }
    : parsed;
  if (!state || typeof state !== "object") throw new Error("Stockage invité invalide.");
  const candidate = state as Record<string, unknown>;
  const rows = candidate["rows"];
  const zen = candidate["zen"];
  const plus = candidate["plus"] ?? DEFAULT_PLUS;
  if (
    !Array.isArray(rows) ||
    !rows.every(isRow) ||
    typeof zen !== "number" ||
    !Number.isSafeInteger(zen) ||
    zen < 0 ||
    new Set(rows.map((row) => row.id)).size !== rows.length
  ) {
    throw new Error("Stockage invité invalide.");
  }
  if (!plus || typeof plus !== "object") throw new Error("État Zenkai+ invité invalide.");
  const data = plus as Record<string, unknown>;
  if (
    typeof data["active"] !== "boolean" ||
    typeof data["welcomeClaimed"] !== "boolean" ||
    (data["avatar"] !== null && typeof data["avatar"] !== "string")
  ) {
    throw new Error("État Zenkai+ invité invalide.");
  }
  return {
    rows,
    zen,
    market: candidate["market"],
    plus: {
      active: data["active"],
      avatar: data["avatar"],
      welcomeClaimed: data["welcomeClaimed"],
    },
  };
}

function writeState(state: GuestState) {
  window.localStorage.setItem(GUEST_COLLECTION_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("zenkai:guest-updated"));
}

export function getGuestState(): GuestState {
  return readState();
}

export function updateGuestState<T>(
  update: (state: GuestState) => { state: GuestState; result: T },
): T {
  const { state, result } = update(readState());
  if (!Number.isSafeInteger(state.zen) || state.zen < 0) throw new Error("Solde invité invalide.");
  writeState(state);
  return result;
}

export function getGuestCollection() {
  return readState().rows;
}
export function getGuestBalance() {
  return readState().zen;
}

export function getGuestPlus() {
  return readState().plus;
}

export function setGuestPlusActive(active: boolean) {
  const state = readState();
  const welcome = active && !state.plus.welcomeClaimed ? 300 : 0;
  const zen = state.zen + welcome;
  if (!Number.isSafeInteger(zen)) throw new Error("Solde invité invalide.");
  writeState({
    ...state,
    zen,
    plus: { ...state.plus, active, welcomeClaimed: state.plus.welcomeClaimed || active },
  });
  return welcome;
}

export function setGuestPlusAvatar(avatar: string) {
  const state = readState();
  if (!state.plus.active) throw new Error("Active Zenkai+ pour choisir un avatar.");
  writeState({ ...state, plus: { ...state.plus, avatar } });
}

export function plusRecycleBonus(base: number, active: boolean) {
  return active ? Math.ceil(base / 5) : 0;
}

export function addGuestCollectionCards(cards: PulledCard[]) {
  const state = readState();
  const ids = new Set(state.rows.map((row) => row.id));
  const now = Date.now();
  const added = cards.map((item, index) => {
    if (ids.has(item.userCardId)) throw new Error("Identifiant de copie invité déjà utilisé.");
    ids.add(item.userCardId);
    return {
      id: item.userCardId,
      card_id: item.card.id,
      obtained_at: new Date(now + index).toISOString(),
      transcended: item.transcended === true,
      awaken_attempted: false,
      customTranscendance: item.customTranscendance === true,
    };
  });
  writeState({ ...state, rows: [...state.rows, ...added] });
}

export function guestDuplicates(rows: GuestOwnedRow[], cards: Card[]) {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const groups = new Map<string, GuestOwnedRow[]>();
  for (const row of rows) {
    const card = cardsById.get(row.card_id);
    if (!card || row.transcended || row.customTranscendance || isTranscendanceCatalogCard(card))
      continue;
    const group = groups.get(row.card_id) ?? [];
    group.push(row);
    groups.set(row.card_id, group);
  }
  return [...groups.values()].flatMap((group) =>
    [...group]
      .sort((a, b) => Date.parse(a.obtained_at) - Date.parse(b.obtained_at) || a.id.localeCompare(b.id))
      .slice(1),
  );
}

function groupRecycleCopies(copies: GuestOwnedRow[], cards: Card[], active: boolean) {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const groups = new Map<CatalogRarity, { copies: GuestOwnedRow[]; base: number; gain: number }>();
  for (const copy of copies) {
    const card = cardsById.get(copy.card_id)!;
    const group = groups.get(card.rarity) ?? { copies: [], base: 0, gain: 0 };
    group.copies.push(copy);
    group.base += getCardRecycleValue(card);
    group.gain = group.base + plusRecycleBonus(group.base, active);
    groups.set(card.rarity, group);
  }
  return groups;
}

export function guestRecycleGroups(rows: GuestOwnedRow[], cards: Card[], active: boolean) {
  return groupRecycleCopies(guestDuplicates(rows, cards), cards, active);
}

export function recycleGuestCollection(
  copyIds: string[],
  cards: Card[],
  expected?: { rarities?: readonly CatalogRarity[]; total: number },
  bonusActive?: boolean,
) {
  const state = readState();
  const active = bonusActive ?? state.plus.active;
  const eligible = new Map(guestDuplicates(state.rows, cards).map((row) => [row.id, row]));
  const ids = new Set(copyIds);
  if (ids.size !== copyIds.length || ids.size === 0 || [...ids].some((id) => !eligible.has(id))) {
    throw new Error("Les doublons ont changé. Actualise la collection.");
  }
  if (expected?.rarities) {
    const current = guestRecycleGroups(state.rows, cards, active);
    const selected = expected.rarities.flatMap((rarity) => current.get(rarity)?.copies ?? []);
    if (selected.length !== ids.size || selected.some((row) => !ids.has(row.id)))
      throw new Error("Les doublons ont changé. Vérifie la sélection.");
  }
  const selectedRows = [...ids].map((id) => eligible.get(id)!);
  const total = [...groupRecycleCopies(selectedRows, cards, active).values()]
    .reduce((sum, group) => sum + group.gain, 0);
  if (expected && total !== expected.total)
    throw new Error("Le gain a changé. Vérifie la sélection et ton statut Zenkai+.");
  const zen = state.zen + total;
  if (!Number.isSafeInteger(zen)) throw new Error("Solde invité invalide.");
  writeState({ ...state, rows: state.rows.filter((row) => !ids.has(row.id)), zen });
  return total;
}
