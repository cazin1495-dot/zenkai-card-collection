import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isCatalogRarity, type CatalogRarity } from "./cards";

type RarityDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      card_rarity_overrides: {
        Row: { card_key: string; rarity: string; updated_at: string };
        Insert: { card_key: string; rarity: string; updated_at?: string };
        Update: { card_key?: string; rarity?: string; updated_at?: string };
        Relationships: [];
      };
    };
  };
};

const rarityClient = supabase as SupabaseClient<RarityDatabase>;

export function normalizeRarityLookupKey(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function fetchRarityOverrides(): Promise<Record<string, CatalogRarity>> {
  const pageSize = 1000;
  const result: Record<string, CatalogRarity> = {};
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await rarityClient.from("card_rarity_overrides")
      .select("card_key, rarity").order("card_key").range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Chargement des raretés globales : ${error.message}`);
    for (const row of data) {
      if (!row.card_key.trim() || !isCatalogRarity(row.rarity)) {
        throw new Error(`Rareté globale invalide pour la carte ${row.card_key}.`);
      }
      result[row.card_key] = row.rarity;
    }
    if (data.length < pageSize) return result;
  }
}

export async function saveRarityOverride(cardKey: string, rarity: CatalogRarity, cardName?: string) {
  const { error } = await rarityClient.from("card_rarity_overrides").upsert(
    { card_key: cardKey, rarity, updated_at: new Date().toISOString() },
    { onConflict: "card_key" },
  );
  if (error) throw new Error(`Enregistrement de la rareté globale : ${error.message}`);
}
