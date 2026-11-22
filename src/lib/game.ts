import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GameState = { username: string; coins: number; xp: number; level: number; bonus_boosters: number; boosters_stored: number; stock_updated_at: string; reward_packs: Record<string, number>; cosmetics: Record<string, string | number | boolean>; mission_started_at: string; mission_opened: number; mission_recycled: number; mission_claims: string[] };

export const gameQuery = (userId: string) => queryOptions({
  queryKey: ["game", userId],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("game_state");
    if (error) throw error;
    const state = data as unknown as GameState;
    return {
      ...state,
      level: 1,
      xp: 0,
      mission_opened: 0,
      mission_recycled: 0,
      mission_claims: [],
    };
  },
  staleTime: 10_000,
});
