export const GUEST_ZEN_KEY = "zenkai_guest_zen";
export const INITIAL_ZEN = 500;
export const GUEST_SHARDS_KEY = GUEST_ZEN_KEY;
export const INITIAL_SHARDS = INITIAL_ZEN;

export function getGuestZen(): number {
  if (typeof window === "undefined") return INITIAL_ZEN;
  const raw = window.localStorage.getItem(GUEST_ZEN_KEY);
  if (raw === null) return INITIAL_ZEN;
  const stored = Number(raw);
  if (Number.isFinite(stored) && stored >= 0) return stored;
  throw new Error("Solde invité invalide.");
}

export function setGuestZen(value: number): number {
  const next = Math.max(0, Math.floor(value));
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GUEST_ZEN_KEY, String(next));
    window.dispatchEvent(new Event("zenkai:zen-updated"));
  }
  return next;
}

export const getGuestShards = getGuestZen;
export const setGuestShards = setGuestZen;
