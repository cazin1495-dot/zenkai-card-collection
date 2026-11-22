import { getGuestState, type GuestState } from "./guest-collection";

export const XP_PER_LEVEL = 600;

export function xpRequiredForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  const step = safeLevel - 1;
  return 600 + step * 250 + Math.floor((step * (step - 1)) / 2) * 50;
}

export function levelProgress(xp: number) {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  let required = xpRequiredForLevel(level);
  while (remaining >= required) {
    remaining -= required;
    level += 1;
    required = xpRequiredForLevel(level);
  }
  return { level, progress: remaining, required };
}

export function getPlayerXp() { return getGuestState().xp; }

export function addXp(state: GuestState, amount: number): GuestState {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Gain d'XP invalide.");
  const xp = state.xp + amount;
  const levels = levelProgress(xp).level - levelProgress(state.xp).level;
  const zen = state.zen + levels * 100;
  if (!Number.isSafeInteger(xp) || !Number.isSafeInteger(zen)) throw new Error("XP ou solde local invalide.");
  return { ...state, xp, zen };
}
