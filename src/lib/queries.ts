import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCards } from "./cards.functions";

export const cardsQuery = queryOptions({
  queryKey: ["cards"],
  queryFn: () => getCards(),
  staleTime: Infinity,
});

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, last_booster_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const collectionQuery = (userId: string) =>
  queryOptions({
    queryKey: ["collection", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_cards")
        .select("card_id, obtained_at")
        .eq("user_id", userId)
        .order("obtained_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
