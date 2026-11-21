import { useMemo, useSyncExternalStore } from "react";

const FAVORITES_KEY = "zenkai:favorite-cards";
const FAVORITES_UPDATED = "zenkai:favorite-cards-updated";

function snapshot() {
  return window.localStorage.getItem(FAVORITES_KEY);
}

function parseFavorites(raw: string | null): string[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
    throw new Error("Liste de cartes favorites invalide.");
  }
  return parsed;
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === FAVORITES_KEY || event.key === null) onChange();
  };
  window.addEventListener(FAVORITES_UPDATED, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FAVORITES_UPDATED, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFavoriteCards() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const favoriteCardIds = useMemo(() => parseFavorites(raw), [raw]);

  function toggleFavorite(cardId: string) {
    const current = parseFavorites(snapshot());
    const added = !current.includes(cardId);
    const next = added ? [...current, cardId] : current.filter((id) => id !== cardId);
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(FAVORITES_UPDATED));
    return added;
  }

  return { favoriteCardIds, toggleFavorite };
}
