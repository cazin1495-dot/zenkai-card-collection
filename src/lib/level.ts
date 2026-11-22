import { getGuestState, type GuestState } from "./guest-collection";

export const XP_PER_LEVEL = 600;

export function levelProgress(xp: number) {
  return { level: Math.floor(xp / XP_PER_LEVEL) + 1, progress: xp % XP_PER_LEVEL };
}

export function getPlayerXp() { return getGuestState().xp; }

export function addXp(state: GuestState, amount: number): GuestState {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Gain d'XP invalide.");
  const xp = state.xp + amount;
  const levels = Math.floor(xp / XP_PER_LEVEL) - Math.floor(state.xp / XP_PER_LEVEL);
  const zen = state.zen + levels * 100;
  if (!Number.isSafeInteger(xp) || !Number.isSafeInteger(zen)) throw new Error("XP ou solde local invalide.");
  return { ...state, xp, zen };
}
