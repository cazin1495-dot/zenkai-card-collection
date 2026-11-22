import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { levelProgress, xpForNextLevel } from "@/lib/level";

export type GameState = { username: string; coins: number; xp: number; level: number; bonus_boosters: number; boosters_stored: number; stock_updated_at: string; reward_packs: Record<string, number>; cosmetics: Record<string, string | number | boolean>; mission_started_at: string; mission_opened: number; mission_recycled: number; mission_claims: string[] };

export const gameQuery = (userId: string) => queryOptions({
  queryKey: ["game", userId],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("game_state");
    if (error) throw error;
    const state = data as unknown as GameState;
    const localXp = Number(localStorage.getItem("zenkai_beta_xp") || "0");
    const prog = levelProgress(localXp);
    return {
      ...state,
      level: prog.level,
      xp: prog.progress,
      mission_opened: Number(localStorage.getItem("zenkai_beta_opened") || "0"),
      mission_recycled: Number(localStorage.getItem("zenkai_beta_recycled") || "0"),
      mission_claims: JSON.parse(localStorage.getItem("zenkai_beta_claims") || "[]"),
    };
  },
  staleTime: 2_000,
});
