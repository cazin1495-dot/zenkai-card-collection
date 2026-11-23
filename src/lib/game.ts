import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { levelProgress } from "@/lib/level";

export type GameState = { username: string; coins: number; xp: number; level: number; bonus_boosters: number; boosters_stored: number; stock_updated_at: string; reward_packs: Record<string, number>; cosmetics: Record<string, string | number | boolean>; mission_started_at: string; mission_opened: number; mission_recycled: number; mission_claims: string[] };

export function parseOnlineGameState(data: unknown): GameState {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("État du compte invalide.");
  const { username, coins, xp, level, bonus_boosters, boosters_stored, stock_updated_at,
    mission_started_at, mission_opened, mission_recycled, mission_claims, reward_packs, cosmetics: cosmeticData } = data as Record<string, unknown>;
  const number = (item: unknown): item is number => typeof item === "number" && Number.isSafeInteger(item) && item >= 0;
  const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item);
  const rewards = (item: unknown): item is Record<string, number> => record(item) && Object.values(item).every(number);
  const cosmetics = (item: unknown): item is Record<string, string | number | boolean> => record(item) &&
    Object.values(item).every((entry) => typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean");
  if (
    typeof username !== "string" || !number(coins) || !number(xp) ||
    !number(level) || level < 1 || !number(bonus_boosters) ||
    !number(boosters_stored) || typeof stock_updated_at !== "string" ||
    typeof mission_started_at !== "string" || !number(mission_opened) ||
    !number(mission_recycled) || !Array.isArray(mission_claims) ||
    !mission_claims.every((item: unknown) => typeof item === "string") ||
    !rewards(reward_packs) || !cosmetics(cosmeticData)
  ) throw new Error("État du compte invalide.");
  return {
    username, coins, xp, level, bonus_boosters, boosters_stored, stock_updated_at,
    mission_started_at, mission_opened, mission_recycled, mission_claims,
    reward_packs, cosmetics: cosmeticData,
  };
}

export const onlineMissionQuery = (userId: string) => queryOptions({
  queryKey: ["online-missions", userId],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("game_state");
    if (error) throw error;
    return parseOnlineGameState(data);
  },
  staleTime: 2_000,
});

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
      mission_opened: (() => { syncDailyMissionDay(); return Number(localStorage.getItem("zenkai_beta_opened") || "0"); })(),
      mission_recycled: Number(localStorage.getItem("zenkai_beta_recycled") || "0"),
      mission_claims: JSON.parse(localStorage.getItem("zenkai_beta_claims") || "[]"),
    };
  },
  staleTime: 2_000,
});


const DAILY_DAY_KEY = "zenkai_beta_daily_day_v1";
export function syncDailyMissionDay() {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(DAILY_DAY_KEY) !== today) {
    localStorage.setItem(DAILY_DAY_KEY, today);
    localStorage.setItem("zenkai_beta_opened", "0");
    localStorage.setItem("zenkai_beta_recycled", "0");
    localStorage.setItem("zenkai_beta_claims", "[]");
  }
}
export function recordDailyBoosterOpen(count = 1) {
  if (typeof window === "undefined") return;
  syncDailyMissionDay();
  const prev = Number(localStorage.getItem("zenkai_beta_opened") || "0");
  localStorage.setItem("zenkai_beta_opened", String(prev + Math.max(1, count)));
}
export function recordDailyRecycle(count = 1) {
  if (typeof window === "undefined") return;
  syncDailyMissionDay();
  const prev = Number(localStorage.getItem("zenkai_beta_recycled") || "0");
  localStorage.setItem("zenkai_beta_recycled", String(prev + Math.max(1, count)));
}
