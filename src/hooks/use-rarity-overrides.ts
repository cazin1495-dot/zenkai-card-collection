import { useMemo, useSyncExternalStore } from "react";
import { getUserRarityOverridesSnapshot, parseUserRarityOverrides, subscribeUserRarityOverrides } from "@/lib/cards";

export function useRarityOverrides() {
  const raw = useSyncExternalStore(subscribeUserRarityOverrides, getUserRarityOverridesSnapshot, () => null);
  return useMemo(() => parseUserRarityOverrides(raw), [raw]);
}
