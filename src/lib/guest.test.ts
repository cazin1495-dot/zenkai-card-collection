import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isTranscendanceCatalogCard, normalizeCatalogCard, type Card, type CatalogRarity } from "./cards";
import { getCards } from "./cards.functions";

function jjkRarityFromRank(index: number): CatalogRarity {
  if (index < 3) return "mythique";
  if (index < 8) return "legendaire";
  if (index < 13) return "epique";
  if (index < 17) return "rare";
  if (index < 21) return "non_commune";
  return "commune";
}

const ANTAGONIST_IDS = new Set([133701, 133699, 133702, 162722]);

async function fetchJjkFromBrowser(): Promise<Card[]> {
  try {
    const endpoint = "https://graphql." + "anilist.co";
    const query = `
      query {
        Media(id: 113415, type: ANIME) {
          characters(sort: [FAVOURITES_DESC], perPage: 25) {
            edges {
              node {
                id
                name { full }
                image { large }
                favourites
              }
            }
          }
        }
      }
    `;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const edges = json?.data?.Media?.characters?.edges ?? [];
    return edges.map((edge: any, idx: number) => {
      const node = edge.node;
      const isAntagonist = ANTAGONIST_IDS.has(node.id);
      return {
        id: `al-${node.id}`,
        name: node.name.full,
        title: `Jujutsu Kaisen · ${isAntagonist ? "Fléau / Antagoniste" : "Exorciste"}`,
        rarity: jjkRarityFromRank(idx),
        description: `Personnage de Jujutsu Kaisen (${node.favourites ?? 0} favoris).`,
        sort_order: 900 + idx,
        category: "shonen",
        series: "Jujutsu Kaisen",
        role: isAntagonist ? "antagoniste" : "protagoniste",
        image_url: node.image?.large ?? null,
        popularity: node.favourites ?? 0,
      } satisfies Card;
    });
  } catch {
    return [];
  }
}

export const cardsQuery = queryOptions({
  queryKey: ["cards-v4"],
  queryFn: async () => {
    const [base, jjk] = await Promise.all([getCards(), fetchJjkFromBrowser()]);
    const cleaned = base
      .filter((card) => !isTranscendanceCatalogCard(card))
      .map((card) => normalizeCatalogCard(card));
    const existingIds = new Set(cleaned.map((c) => c.id));
    return [...cleaned, ...jjk.filter((c) => !existingIds.has(c.id))];
  },
  staleTime: Infinity,
});

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, boosters_stored, stock_updated_at")
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
        .select("id, card_id, obtained_at, transcended, awaken_attempted")
        .eq("user_id", userId)
        .order("obtained_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const pityQuery = (userId: string) =>
  queryOptions({
    queryKey: ["pity", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("booster_pity").select("counter").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data?.counter ?? 0;
    },
  });
