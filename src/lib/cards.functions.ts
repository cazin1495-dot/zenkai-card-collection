import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isTranscendanceCatalogCard, type Card, type CatalogRarity } from "./cards";

function jjkRarityFromRank(index: number): CatalogRarity {
  if (index < 3) return "mythique";
  if (index < 8) return "legendaire";
  if (index < 13) return "epique";
  if (index < 17) return "rare";
  if (index < 21) return "non_commune";
  return "commune";
}

const ANTAGONIST_IDS = new Set();

async function fetchJjkCharacters(): Promise<Card[]> {
  try {
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
    const res = await fetch("https://anilist.co", {
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

/** Public card catalog (readable by everyone). */
export const getCards = createServerFn({ method: "GET" }).handler(async (): Promise<Card[]> => {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const [{ data, error }, jjkCards] = await Promise.all([
    client
      .from("cards")
      .select("id, name, title, rarity, description, sort_order, category, series, role, image_url, quote, popularity, voice_audio_url, subtitle_text")
      .eq("active", true)
      .order("sort_order"),
    fetchJjkCharacters(),
  ]);
  if (error) throw new Error(error.message);

  const baseCards = (data ?? [])
    .filter(card => !isTranscendanceCatalogCard(card))
    .map(card => ({
      ...card,
      voiceAudioUrl: card.voice_audio_url,
      subtitleText: card.subtitle_text,
    })) as Card[];

  const existingIds = new Set(baseCards.map(c => c.id));
  const mergedJjk = jjkCards.filter(c => !existingIds.has(c.id));

  return [...baseCards, ...mergedJjk];
});
