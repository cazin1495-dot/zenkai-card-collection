import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEMON_SLAYER_MYTHIC_CARDS, getUserRarityOverrides, inPack, isDemonSlayerMythicCardId, isTranscendanceCatalogCard, normalizeCatalogCard, type Card, type CatalogRarity, type PackId } from "./cards";
import { getCards } from "./cards.functions";

export { CUSTOM_RARITY } from "./cards";

const parseIds = (str: string) => str.split(",").map(Number);

// JJK — Mythique : Gojo, Sukuna, Toji, Yuta, Geto, Nanami, Itadori, Megumi
const JJK_MYTHIC_IDS = parseIds("127691,133701,162722,129571,133699,133704,127212,126635");
// JJK — Antagonistes : Sukuna, Geto, Mahito, Toji, Jogo, Hanami
const JJK_ANTAGONIST_IDS = parseIds("133701,133699,133702,162722,156847,156846");

// One Piece — Mythique : Luffy, Zoro, Law, Ace, Shanks, Sanji, Robin, Barbe Blanche, Hancock, Kaido, Barbe Noire
const OP_MYTHIC_IDS = parseIds("40,62,13767,2072,727,305,61,16448,14756,125667,14251,36757");
// One Piece — Légendaire (Or) : Vivi Nefertari
const OP_LEGENDARY_IDS = parseIds("729");
// One Piece — Antagonistes : Doflamingo, Crocodile, Katakuri, Kaido, Buggy, Barbe Noire
const OP_ANTAGONIST_IDS = parseIds("19986,2745,123779,125667,2460,14251");

const HXH_MYTHIC_IDS = parseIds("27,30,31,28,23277,57,23338,23278");
const HXH_LEGENDARY_IDS = parseIds("33,3200,27996,58193,4423,23337");
const HXH_ANTAGONIST_IDS = parseIds("31,23277,57,23278,33,3200,26165,24558,24560,58,12300");

const MHA_MYTHIC_IDS = parseIds("89028,88892,89220,89224,89226,126378,128299,148985");
const MHA_LEGENDARY_IDS = parseIds("89221,89225,126158,125619,89589,126357,225724");
const MHA_ANTAGONIST_IDS = parseIds("89226,126378,125619,89589,126357,125956,225724,126067");

function rarityFromNonMythicRank(nonMythicRank: number): CatalogRarity {
  if (nonMythicRank < 4) return "legendaire";
  if (nonMythicRank < 9) return "epique";
  if (nonMythicRank < 13) return "rare";
  if (nonMythicRank < 16) return "non_commune";
  return "commune";
}

async function fetchAnimeCharacters(
  mediaId: number,
  seriesName: string,
  mythicIds: number[],
  legendaryIds: number[],
  antagonistIds: number[],
  sortOffset: number,
  antagonistLabel: string,
  protagonistLabel: string,
): Promise<Card[]> {
  try {
    const endpoint = Array.of("https:", "", "graphql" + ".anilist" + ".co").join("/");
    const query = `
      query {
        Media(id: ${mediaId}, type: ANIME) {
          characters(sort: FAVOURITES_DESC, perPage: 25) {
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
    if (!res.ok) return new Array<Card>();
    const json = await res.json();
    const edges = json?.data?.Media?.characters?.edges ?? new Array<any>();

    let nonSpecialCounter = 0;
    return edges.map((edge: any, idx: number) => {
      const node = edge.node;
      let rarity: CatalogRarity;

      if (mythicIds.includes(node.id)) {
        rarity = "mythique";
      } else if (legendaryIds.includes(node.id)) {
        rarity = "legendaire";
      } else {
        rarity = rarityFromNonMythicRank(nonSpecialCounter++);
      }

      const isAntagonist = antagonistIds.includes(node.id);

      return {
        id: `al-${node.id}`,
        name: node.name.full,
        title: `${seriesName} · ${isAntagonist ? antagonistLabel : protagonistLabel}`,
        rarity,
        description: `Personnage de ${seriesName} (${node.favourites ?? 0} favoris).`,
        sort_order: sortOffset + idx,
        category: "shonen",
        series: seriesName,
        role: isAntagonist ? "antagoniste" : "protagoniste",
        image_url: node.image?.large ?? null,
        popularity: node.favourites ?? 0,
      } satisfies Card;
    });
  } catch {
    return new Array<Card>();
  }
}

const HSR_ROSTER: Array<{ name: string; title: string; rarity: CatalogRarity; role: "protagoniste" | "antagoniste"; wikiTitle: string }> = Array.of(
  { name: "Firefly", title: "Chasseuse de Stellaron · SAM", rarity: "mythique" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Firefly" },
  { name: "Acheron", title: "Émanatrice du Néant · Nihilité", rarity: "mythique" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Acheron" },
  { name: "Kafka", title: "Chasseuse de Stellaron · Domination", rarity: "mythique" as CatalogRarity, role: "antagoniste" as const, wikiTitle: "Kafka" },
  { name: "Aventurine", title: "Dix Cœurs de Pierre · Préservation", rarity: "mythique" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Aventurine" },
  { name: "Dan Heng • Imbibitor Lunae", title: "Grand Ancien Vidyadhara · Destruction", rarity: "mythique" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Dan_Heng_•_Imbibitor_Lunae" },
  { name: "Jingliu", title: "Championne de l'Épée · Luofu", rarity: "mythique" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Jingliu" },
  { name: "Sunday", title: "Chef de la Famille · Harmonie", rarity: "mythique" as CatalogRarity, role: "antagoniste" as const, wikiTitle: "Sunday" },
  { name: "Robin", title: "Chanteuse Galactique · Harmonie", rarity: "mythique" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Robin" },

  { name: "Blade", title: "Chasseur de Stellaron · Épée Brisée", rarity: "legendaire" as CatalogRarity, role: "antagoniste" as const, wikiTitle: "Blade" },
  { name: "Sparkle", title: "Folle Masquée · Élation", rarity: "legendaire" as CatalogRarity, role: "antagoniste" as const, wikiTitle: "Sparkle" },
  { name: "Feixiao", title: "Générale Arbitre · La Chasse", rarity: "legendaire" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Feixiao" },
  { name: "Jing Yuan", title: "Général des Chevaliers des Nuages", rarity: "legendaire" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Jing_Yuan" },
  { name: "Black Swan", title: "Gardienne de Mémoire · Souvenir", rarity: "legendaire" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Black_Swan" },
  { name: "Ruan Mei", title: "Membre #81 de la Société des Génies", rarity: "legendaire" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Ruan_Mei" },
  { name: "Seele", title: "Feu Sauvage · Papillon de Belobog", rarity: "legendaire" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Seele" },

  { name: "Bronya", title: "Gardienne Suprême de Belobog", rarity: "epique" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Bronya" },
  { name: "March 7th", title: "Astral Express · Glace Éternelle", rarity: "epique" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "March_7th" },
  { name: "Silver Wolf", title: "Hackeuse Géniale · Punklorde", rarity: "epique" as CatalogRarity, role: "antagoniste" as const, wikiTitle: "Silver_Wolf" },
  { name: "Welt", title: "Ancien Souverain d'Anti-Entropie", rarity: "epique" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Welt" },
  { name: "Himeko", title: "Navigatrice de l'Astral Express", rarity: "epique" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Himeko" },

  { name: "Boothill", title: "Ranger de la Galaxie · Cyborg", rarity: "rare" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Boothill" },
  { name: "Gallagher", title: "Barman de Penacony · Abondance", rarity: "rare" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Gallagher" },
  { name: "Tingyun", title: "Ambassadrice de la Commission", rarity: "rare" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Tingyun" },
  { name: "Clara", title: "Protégée de Svarog · Belobog", rarity: "rare" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Clara" },

  { name: "Gepard", title: "Capitaine de la Garde d'Argent", rarity: "non_commune" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Gepard" },
  { name: "Pela", title: "Officière du Renseignement · Garde d'Argent", rarity: "non_commune" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Pela" },
  { name: "Herta", title: "Marionnette #83 · Société des Génies", rarity: "commune" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Herta" },
  { name: "Asta", title: "Astronome en Chef · Station Herta", rarity: "commune" as CatalogRarity, role: "protagoniste" as const, wikiTitle: "Asta" },
);

async function fetchHsrFromBrowser(): Promise<Card[]> {
  try {
    const titles = HSR_ROSTER.map((c) => c.wikiTitle).join("|");
    const host = Array.of("honkai-star-rail", "fandom", "com").join(".");
    const apiUrl = new URL(`https://${host}/api.php`);
    apiUrl.searchParams.set("action", "query");
    apiUrl.searchParams.set("prop", "pageimages");
    apiUrl.searchParams.set("pithumbsize", "500");
    apiUrl.searchParams.set("format", "json");
    apiUrl.searchParams.set("origin", "*");
    apiUrl.searchParams.set("titles", titles);

    const res = await fetch(apiUrl.toString());
    const json = res.ok ? await res.json() : null;
    const pages: Record<string, any> = json?.query?.pages ?? {};

    const imageByTitle = new Map<string, string>();
    Object.values(pages).forEach((page: any) => {
      if (page?.title && page?.thumbnail?.source) {
        imageByTitle.set(page.title.toLowerCase(), page.thumbnail.source);
      }
    });

    return HSR_ROSTER.map((item, idx) => {
      const normalizedKey = item.wikiTitle.replace(/_/g, " ").toLowerCase();
      return {
        id: `hsr-${idx + 1}`,
        name: item.name,
        title: `Honkai: Star Rail · ${item.title}`,
        rarity: item.rarity,
        description: `${item.name} — ${item.title}.`,
        sort_order: 1100 + idx,
        category: "shonen",
        series: "Honkai: Star Rail",
        role: item.role,
        image_url: imageByTitle.get(normalizedKey) ?? null,
        popularity: 20000 - idx * 500,
      } satisfies Card;
    });
  } catch {
    return new Array<Card>();
  }
}

export const cardsQuery = queryOptions({
  queryKey: ["cards-v24"],
  queryFn: async () => {
    const base = await getCards();
    const jjk = await fetchAnimeCharacters(113415, "Jujutsu Kaisen", JJK_MYTHIC_IDS, new Array<number>(), JJK_ANTAGONIST_IDS, 900, "Fléau / Antagoniste", "Exorciste");
    const op = await fetchAnimeCharacters(21, "One Piece", OP_MYTHIC_IDS, OP_LEGENDARY_IDS, OP_ANTAGONIST_IDS, 1000, "Pirate / Antagoniste", "Pirate / Protagoniste");
    const hxh = await fetchAnimeCharacters(11061, "Hunter x Hunter", HXH_MYTHIC_IDS, HXH_LEGENDARY_IDS, HXH_ANTAGONIST_IDS, 900, "Antagoniste", "Hunter");
    const mha = await fetchAnimeCharacters(21459, "My Hero Academia", MHA_MYTHIC_IDS, MHA_LEGENDARY_IDS, MHA_ANTAGONIST_IDS, 1000, "Antagoniste", "Héros");
    const hsr = await fetchHsrFromBrowser();
    const cleaned = base.filter((card) => !isTranscendanceCatalogCard(card) && !isDemonSlayerMythicCardId(card.id));
    const existingIds = new Set(cleaned.map((card) => card.id));

    const overrides = getUserRarityOverrides();
    return [
      ...cleaned,
      ...DEMON_SLAYER_MYTHIC_CARDS,
      ...jjk.filter((card) => !existingIds.has(card.id)),
      ...op.filter((card) => !existingIds.has(card.id)),
      ...hxh.filter((card) => !existingIds.has(card.id)),
      ...mha.filter((card) => !existingIds.has(card.id)),
      ...hsr.filter((card) => !existingIds.has(card.id)),
    ].map((card) => normalizeCatalogCard(card, overrides));
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
      const { data, error } = await supabase
        .from("booster_pity")
        .select("counter")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.counter ?? 0;
    },
  });

export function useCards() {
  return useQuery(cardsQuery);
}

export function useCardsByPack(pack: PackId) {
  return useQuery({ ...cardsQuery, select: (cards) => cards.filter((card) => inPack(card, pack)) });
}

export function useUserCards(userId?: string | null) {
  return useQuery({ ...collectionQuery(userId ?? ""), enabled: false });
}

export function useProfile(userId?: string | null) {
  return useQuery({ ...profileQuery(userId ?? ""), enabled: !!userId });
}
