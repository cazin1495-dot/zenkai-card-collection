import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DEMON_SLAYER_MYTHIC_CARDS } from "@/lib/cards";
import { getGuestState } from "@/lib/guest-collection";
import { ensureGuestAuctions, getGuestMarket, settleGuestMarket } from "@/lib/guest-market";
import { cardsQuery } from "@/lib/queries";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "@/lib/transcendance-cards";

export function AuctionEffects() {
  const cards = useQuery(cardsQuery);
  const catalog = useMemo(
    () =>
      cards.data || cards.isError
        ? [
            ...(cards.data ?? DEMON_SLAYER_MYTHIC_CARDS),
            ...CUSTOM_TRANSCENDANCE_CARDS.map(customTranscendanceAsCard),
          ]
        : [],
    [cards.data, cards.isError],
  );

  useEffect(() => {
    let blocked = false;
    const advance = () => {
      if (blocked) return;
      try {
        if (getGuestState().market === undefined) return;
        const now = Date.now();
        const market = getGuestMarket();
        if (
          market.listings.some(
            (item) =>
              (item.endAt !== null && now >= item.endAt) ||
              (item.rivalAt !== null && now >= item.rivalAt) ||
              (item.seller === "guest" && item.npcAt !== null && now >= item.npcAt),
          )
        ) {
          settleGuestMarket(now).forEach((message) =>
            message.includes(" a surenchéri sur ") ? toast.info(message) : toast.success(message),
          );
        }
        if (catalog.length) ensureGuestAuctions(catalog, now);
      } catch (reason) {
        blocked = true;
        toast.error(reason instanceof Error ? reason.message : "Suivi des enchères impossible.");
      }
    };
    const retry = () => {
      blocked = false;
      advance();
    };
    advance();
    const timer = window.setInterval(advance, 1000);
    window.addEventListener("focus", retry);
    window.addEventListener("storage", retry);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", retry);
      window.removeEventListener("storage", retry);
    };
  }, [catalog]);
  return null;
}
