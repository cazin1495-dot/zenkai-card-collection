import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { applyRemoteRarityOverrides, getRarityOverridesRevision, getUserRarityOverrides, normalizeCatalogCard, subscribeUserRarityOverrides } from "@/lib/cards";
import { cardsQuery } from "@/lib/queries";
import { fetchRarityOverrides } from "@/lib/rarity-overrides";

export function useSyncRarityOverrides(queryClient: QueryClient) {
  useEffect(() => {
    const refresh = () => {
      const overrides = getUserRarityOverrides();
      queryClient.setQueryData(cardsQuery.queryKey, (cards) =>
        cards?.map((card) => normalizeCatalogCard(card, overrides)),
      );
    };
    refresh();
    const unsubscribe = subscribeUserRarityOverrides(refresh);
    let active = true;
    let loading = false;
    let reportedError = false;
    const sync = async () => {
      if (loading) return;
      loading = true;
      const revision = getRarityOverridesRevision();
      try {
        const overrides = await fetchRarityOverrides();
        if (active && revision === getRarityOverridesRevision()) {
          applyRemoteRarityOverrides(overrides);
          reportedError = false;
        }
      } catch (error) {
        if (active && !reportedError) {
          console.error(error);
          toast.error("Impossible de synchroniser les raretés globales. Les dernières valeurs disponibles sont affichées.");
          reportedError = true;
        }
      } finally {
        loading = false;
      }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 5_000);
    const onFocus = () => void sync();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      unsubscribe();
    };
  }, [queryClient]);
}
