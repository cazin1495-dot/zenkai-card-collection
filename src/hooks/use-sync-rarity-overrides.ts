import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserRarityOverrides, normalizeCatalogCard, subscribeUserRarityOverrides } from "@/lib/cards";
import { cardsQuery } from "@/lib/queries";

export function useSyncRarityOverrides(queryClient: QueryClient) {
  useEffect(() => {
    const refresh = () => {
      try {
        const overrides = getUserRarityOverrides();
        queryClient.setQueryData(cardsQuery.queryKey, (cards) =>
          cards?.map((card) => normalizeCatalogCard(card, overrides)),
        );
      } catch (error) {
        console.error(error);
        toast.error("Impossible de charger les raretés locales. Vérifie le stockage du navigateur.");
      }
    };
    refresh();
    return subscribeUserRarityOverrides(refresh);
  }, [queryClient]);
}
