import { getGuestState, updateGuestState } from "./guest-collection";
import { INITIAL_ZEN } from "./shards";

export const BETA_END = "2026-11-29T15:30:00+01:00";
export const BETA_ACCESS_KEY = "zenkai_beta_access_v2";
export const BETA_WIPE_KEY = "zenkai_beta_wipe_v2";
const END_MS = Date.parse(BETA_END);

export function betaEnded(now = Date.now()) {
  return now >= END_MS;
}

export function betaCountdown(now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((END_MS - now) / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${Math.floor(seconds / 86400)}j ${pad(Math.floor(seconds / 3600) % 24)}h ${pad(Math.floor(seconds / 60) % 60)}m ${pad(seconds % 60)}s`;
}

export function hasBetaAccess() {
  return localStorage.getItem(BETA_ACCESS_KEY) === "granted";
}

export function claimBetaAccess(code: string, now = Date.now()) {
  if (betaEnded(now)) throw new Error("La bêta est terminée.");
  if (!["ZENKAI-BETA7", "ZENKAI7"].includes(code.trim().toUpperCase())) throw new Error("Code bêta invalide.");
  updateGuestState((state) => ({
    state: state.betaWelcomeClaimed ? state : { ...state, zen: state.zen + 500, betaWelcomeClaimed: true },
    result: undefined,
  }));
  localStorage.setItem(BETA_ACCESS_KEY, "granted");
}

export function hasBetaWelcome() {
  return getGuestState().betaWelcomeClaimed === true;
}

export function resetGuestBetaProgress(now = Date.now()) {
  if (betaEnded(now)) throw new Error("La bêta est terminée.");
  const keys = [
    "zenkai_guest_collection", "zenkai_guest_zen", "zenkai_player_xp",
    "zenkai_market_auctions", "zenkai_daily_login", "zenkai_player_profile",
    "zenkai:favorite-cards", "zenkai_quests", "zenkai_secrets", "zenkai_beta_welcomed",
  ];
  for (const key of keys) localStorage.removeItem(key);
  localStorage.setItem("zenkai_guest_collection", JSON.stringify({
    rows: [], zen: INITIAL_ZEN, xp: 0,
    plus: { active: false, avatar: null, welcomeClaimed: false },
    betaWelcomeClaimed: true,
  }));
}

export function wipeBetaProgress(now = Date.now()) {
  if (!betaEnded(now)) throw new Error("La bêta n'est pas terminée.");
  if (localStorage.getItem(BETA_WIPE_KEY) === "done") return;
  const exact = new Set([
    "zenkai_guest_collection", "zenkai_guest_zen", "zenkai_player_xp",
    "zenkai_market_auctions", "zenkai_daily_login", "zenkai_player_profile",
    "zenkai:favorite-cards", "zenkai:local-guest", BETA_ACCESS_KEY,
  ]);
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
  for (const key of keys) {
    if (key && (exact.has(key) || key.startsWith("zenkai:plus:") || key.startsWith("zenkai:friends:"))) {
      localStorage.removeItem(key);
    }
  }
  localStorage.setItem(BETA_WIPE_KEY, "done");
}
