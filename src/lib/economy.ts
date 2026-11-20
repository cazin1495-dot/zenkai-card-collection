import type { BaseRarity } from "./cards";
export const BOOSTER_COST = 100;
export const INITIAL_COINS = 500;
export const MAX_LEVEL = 150;
export const RECYCLE_MULTIPLIERS: Record<BaseRarity, number> = { commune: 0.1, non_commune: 0.25, rare: 0.5, epique: 1.5, legendaire: 4, mythique: 10, transcendance: 50 };
export function recycleValue(rarity: BaseRarity, popularity: number) { return Math.ceil(RECYCLE_MULTIPLIERS[rarity] * Math.max(1, Math.min(100, popularity))); }
export function xpRequired(level: number) { return level * 150 + (level - 1) ** 2 * 50; }
export const MILESTONES = [
  [15, "Initié", "300 Coins · Booster Rare"], [30, "Guerrier Éveillé", "500 Coins · Booster Épique · Cadre Argent"],
  [45, "Chasseur d’Élite", "800 Coins · Booster Épique · +1 slot Vitrine"], [60, "Maître du Ki", "1 000 Coins · Booster Légendaire"],
  [75, "Super Guerrier", "Sceau Mythique · Cadre Or"], [90, "Légende Vivante", "1 500 Coins · Booster Légendaire · +1 slot Vitrine"],
  [105, "Héros Transcendé", "Bannière personnalisable image/GIF"], [120, "Demi-Dieu", "Sceau Mythique · Aura profil"],
  [135, "Seigneur Cosmique", "2 500 Coins · Booster Divin Mythique"], [150, "Divinité Zenkai", "Couronne · Aura cosmique · Bannière exclusive · Booster Divin ×2 Transcendance"],
] as const;
export const REWARD_LABELS: Record<string, string> = { rare: "Booster Rare", epique: "Booster Épique", legendaire: "Booster Légendaire", sceau_mythique: "Sceau Mythique", divin_mythique: "Booster Divin Mythique", divin_transcendance: "Booster Divin · Transcendance 0,04 %" };