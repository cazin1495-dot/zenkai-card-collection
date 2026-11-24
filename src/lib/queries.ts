import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEMON_SLAYER_MYTHIC_CARDS, inPack, isDemonSlayerMythicCardId, isTranscendanceCatalogCard, normalizeCatalogCard, type Card, type CatalogRarity, type PackId } from "./cards";
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


// 9 nouveaux animés : Fairy Tail, SNK, Yozakura Family, Atelier des Sorciers, Magical DoReMi, Kilari, Inazuma Eleven, Tokyo Mew Mew, Dr. STONE
const FT_MYTHIC_IDS = parseIds("5187,5189,4839,5186,33753,16789");
const FT_LEGENDARY_IDS = parseIds("4840,7008,16788,7111,13895,21329");
const FT_ANTAGONIST_IDS = parseIds("33753,16789,21329,39249,47281,66917");

const SNK_MYTHIC_IDS = parseIds("40882,45627,40881,46494,46484,46486");
const SNK_LEGENDARY_IDS = parseIds("46496,46490,46488,46492,46498,46500");
const SNK_ANTAGONIST_IDS = parseIds("46484,46486,46490,46488,71329");

const YOZAKURA_MYTHIC_IDS = parseIds("154994,154995,154996");
const YOZAKURA_LEGENDARY_IDS = parseIds("154997,154998,154999,155000,155001");
const YOZAKURA_ANTAGONIST_IDS = parseIds("195722,195723");

const ATELIER_MYTHIC_IDS = parseIds("124420,124421");
const ATELIER_LEGENDARY_IDS = parseIds("124422,124423,124424,124425");
const ATELIER_ANTAGONIST_IDS = parseIds("124426,124427");

const DOREMI_MYTHIC_IDS = parseIds("2481,2482,2483,2484");
const DOREMI_LEGENDARY_IDS = parseIds("2485,2486,10935");
const DOREMI_ANTAGONIST_IDS = parseIds("16955,16956");

const KILARI_MYTHIC_IDS = parseIds("5995,5996,5997");
const KILARI_LEGENDARY_IDS = parseIds("5998,5999,11521");
const KILARI_ANTAGONIST_IDS = parseIds("11522,11523");

const INAZUMA_MYTHIC_IDS = parseIds("14103,14104,14105,22106");
const INAZUMA_LEGENDARY_IDS = parseIds("22107,22108,22109,22110,27193");
const INAZUMA_ANTAGONIST_IDS = parseIds("22109,27193,27194,35801");

const MEWMEW_MYTHIC_IDS = parseIds("2690,2694");
const MEWMEW_LEGENDARY_IDS = parseIds("2691,2692,2693,2695,4289,13400");
const MEWMEW_ANTAGONIST_IDS = parseIds("4289,13398,13399,13400");

const DRSTONE_MYTHIC_IDS = parseIds("122320,124034,124035,124036");
const DRSTONE_LEGENDARY_IDS = parseIds("124037,124038,136028,136029");
const DRSTONE_ANTAGONIST_IDS = parseIds("124036,136029,158711");

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
  queryKey: ["cards-v36"],
  queryFn: async () => {
    const base = await getCards();
    const jjk = await fetchAnimeCharacters(113415, "Jujutsu Kaisen", JJK_MYTHIC_IDS, new Array<number>(), JJK_ANTAGONIST_IDS, 900, "Fléau / Antagoniste", "Exorciste");
    const op = await fetchAnimeCharacters(21, "One Piece", OP_MYTHIC_IDS, OP_LEGENDARY_IDS, OP_ANTAGONIST_IDS, 1000, "Pirate / Antagoniste", "Pirate / Protagoniste");
    const [
      hxh,
      mha,
      fairyTailRaw,
      snkRaw,
      yozakuraRaw,
      atelierRaw,
      doremiRaw,
      inazumaRaw,
      drStoneRaw,
    ] = await Promise.all([
      fetchAnimeCharacters(11061, "Hunter x Hunter", HXH_MYTHIC_IDS, HXH_LEGENDARY_IDS, HXH_ANTAGONIST_IDS, 900, "Antagoniste", "Hunter"),
      fetchAnimeCharacters(21459, "My Hero Academia", MHA_MYTHIC_IDS, MHA_LEGENDARY_IDS, MHA_ANTAGONIST_IDS, 1000, "Antagoniste", "Héros"),
      fetchAnimeCharacters(6702, "Fairy Tail", FT_MYTHIC_IDS, FT_LEGENDARY_IDS, FT_ANTAGONIST_IDS, 1100, "Antagoniste", "Mage"),
      fetchAnimeCharacters(16498, "L'Attaque des Titans", SNK_MYTHIC_IDS, SNK_LEGENDARY_IDS, SNK_ANTAGONIST_IDS, 1200, "Antagoniste", "Soldat"),
      fetchAnimeCharacters(158898, "Mission: Yozakura Family", YOZAKURA_MYTHIC_IDS, YOZAKURA_LEGENDARY_IDS, YOZAKURA_ANTAGONIST_IDS, 1300, "Antagoniste", "Espion"),
      fetchAnimeCharacters(147105, "L'Atelier des Sorciers", ATELIER_MYTHIC_IDS, ATELIER_LEGENDARY_IDS, ATELIER_ANTAGONIST_IDS, 1400, "Antagoniste", "Sorcier"),
      fetchAnimeCharacters(350, "Magical DoReMi", DOREMI_MYTHIC_IDS, DOREMI_LEGENDARY_IDS, DOREMI_ANTAGONIST_IDS, 1500, "Antagoniste", "Apprentie Sorcière"),
      fetchAnimeCharacters(5231, "Inazuma Eleven", INAZUMA_MYTHIC_IDS, INAZUMA_LEGENDARY_IDS, INAZUMA_ANTAGONIST_IDS, 1700, "Antagoniste", "Joueur"),
      fetchAnimeCharacters(105333, "Dr. STONE", DRSTONE_MYTHIC_IDS, DRSTONE_LEGENDARY_IDS, DRSTONE_ANTAGONIST_IDS, 1900, "Antagoniste", "Scientifique"),
    ]);

    const fairyTail = fairyTailRaw.map((c): Card => ({ ...c, category: "shonen" }));
    const snk = snkRaw.map((c): Card => ({ ...c, category: "shonen" }));
    const yozakura = yozakuraRaw.map((c): Card => ({ ...c, category: "shonen" }));
    const atelier = atelierRaw.map((c): Card => ({ ...c, category: "seinen" }));
    const doremi = doremiRaw.map((c): Card => ({ ...c, category: "shojo" }));
    const inazuma = inazumaRaw.map((c): Card => ({ ...c, category: "sport" }));
    const drStone = drStoneRaw.map((c): Card => ({ ...c, category: "shonen" }));
    const hsr = await fetchHsrFromBrowser();
  await new Promise((r) => setTimeout(r, 1200));
  const mewMewRaw = await fetchAnimeCharacters(758, "Tokyo Mew Mew", MEWMEW_MYTHIC_IDS, MEWMEW_LEGENDARY_IDS, MEWMEW_ANTAGONIST_IDS, 150, "Antagoniste", "Mew Mew");
  const MEWMEW_ALLOWED_IDS = new Set(["al-2690","al-2691","al-2692","al-2693","al-2694","al-2695","al-2696","al-2697","al-4289","al-13398","al-13399","al-13400","al-13402"]);
  const mewMew = mewMewRaw
    .filter((c) => MEWMEW_ALLOWED_IDS.has(c.id))
    .map((c): Card => ({ ...c, category: "shojo" }));
    const cleaned = base.filter((card) => !isTranscendanceCatalogCard(card) && !isDemonSlayerMythicCardId(card.id));
    const existingIds = new Set(cleaned.map((card) => card.id));

    return [
    ...mewMew.filter((c) => !existingIds.has(c.id)),
      ...cleaned,
      ...DEMON_SLAYER_MYTHIC_CARDS,
      ...jjk.filter((card) => !existingIds.has(card.id)),
      ...op.filter((card) => !existingIds.has(card.id)),
      ...hxh.filter((card) => !existingIds.has(card.id)),
      ...mha.filter((card) => !existingIds.has(card.id)),
      ...hsr.filter((card) => !existingIds.has(card.id)),
      ...fairyTail.filter((card) => !existingIds.has(card.id)),
      ...snk.filter((card) => !existingIds.has(card.id)),
      ...yozakura.filter((card) => !existingIds.has(card.id)),
      ...atelier.filter((card) => !existingIds.has(card.id)),
      ...doremi.filter((card) => !existingIds.has(card.id)),
      ...inazuma.filter((card) => !existingIds.has(card.id)),
      ...drStone.filter((card) => !existingIds.has(card.id)),
      ...STATIC_TR_MEWMEW_CARDS.filter((card) => !existingIds.has(card.id)),
  ].map((card) => normalizeCatalogCard(card));
  return resolveStaticCardImages(normalized);
  return resolveStaticCardImages(normalizedCards);
  return resolveStaticCardImages(normalizedCards);
  },
  staleTime: Infinity,
  refetchInterval: false,
  refetchOnWindowFocus: false,
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

async function resolveStaticCardImages(cards: Card[]): Promise<Card[]> {
  if (typeof window === "undefined") return cards;
  const cacheKey = "zenkai_al_final_v1";
  let cachedMap: Record<string, string> = {};
  try { const raw = localStorage.getItem(cacheKey); if (raw) cachedMap = JSON.parse(raw); } catch {}
  if (Object.keys(cachedMap).length < 10) {
    const u = "https://" + ["graphql", "anilist", "co"].join(".");
    const q = `query{tr:Media(id:120120){characters(sort:FAVOURITES_DESC,perPage:20){nodes{id image{large}}}}mm:Media(id:687){characters(sort:FAVOURITES_DESC,perPage:15){nodes{id image{large}}}}}`;
    const m: Record<number, string> = {
      145341: "tr-mikey", 145345: "tr-draken", 145342: "tr-takemichi",
      145343: "tr-baji", 145344: "tr-chifuyu", 170484: "tr-hinata",
      167841: "tr-mitsuya", 170483: "tr-kisaki", 167845: "tr-hanma",
      167846: "tr-kazutora", 1755: "mm-ichigo", 1759: "mm-zakuro",
      1756: "mm-mint", 1757: "mm-lettuce", 1758: "mm-pudding"
    };
    try {
      const r = await fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q })
      });
      if (r.ok) {
        const j = await r.json();
        const nodes = [...(j?.data?.tr?.characters?.nodes || []), ...(j?.data?.mm?.characters?.nodes || [])];
        for (const n of nodes) {
          const cid = m[Number(n?.id)];
          const img = n?.image?.large;
          if (cid && img) cachedMap[cid] = img;
        }
        if (Object.keys(cachedMap).length > 0) {
          try { localStorage.setItem(cacheKey, JSON.stringify(cachedMap)); } catch {}
        }
      }
    } catch {}
  }
  return cards.map((c) => cachedMap[c.id] ? { ...c, image_url: cachedMap[c.id] } : c);
}

const STATIC_TR_MEWMEW_CARDS: Card[] = [
  { id: "csm-makima", name: "Makima", title: "Chainsaw Man • Makima", rarity: "mythique", description: "Directrice de la Sécurité Publique au pouvoir terrifiant.", sort_order: 9201, category: "shonen", series: "Chainsaw Man", role: "Antagoniste", pack_ids: ["shonen", "antagoniste"], image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b137080-UHcynYNjb5ZU.png", popularity: 19000 },
  { id: "csm-reze", name: "Reze", title: "Chainsaw Man • Reze", rarity: "mythique", description: "Jeune fille mystérieuse portant le démon Bombe.", sort_order: 9202, category: "shonen", series: "Chainsaw Man", role: "Antagoniste", pack_ids: ["shonen", "antagoniste"], image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b148740-ceAibPxLW8rR.png", popularity: 16500 },
  { id: "csm-denji", name: "Denji", title: "Chainsaw Man • Denji", rarity: "mythique", description: "Chasseur de démons fusionné avec Pochita, le Chainsaw Man.", sort_order: 9203, category: "shonen", series: "Chainsaw Man", role: "Protagoniste", pack_ids: ["shonen", "protagoniste"], image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b130102-FO1VHNnEnLlB.png", popularity: 18500 },
  { id: "csm-power", name: "Power", title: "Chainsaw Man • Power", rarity: "mythique", description: "Homme-démon du Sang explosif et imprévisible.", sort_order: 9204, category: "shonen", series: "Chainsaw Man", role: "Protagoniste", pack_ids: ["shonen", "protagoniste"], image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b137079-6yLEUYR3bmpr.png", popularity: 17500 },
  { id: "csm-aki", name: "Aki Hayakawa", title: "Chainsaw Man • Aki Hayakawa", rarity: "legendaire", description: "Chasseur de démons dévoué utilisant le démon Renard et Malédiction.", sort_order: 9205, category: "shonen", series: "Chainsaw Man", role: "Protagoniste", pack_ids: ["shonen", "protagoniste"], image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b137081-TSrUR3mUJL6r.png", popularity: 6000 },
  { id: "csm-kishibe", name: "Kishibe", title: "Chainsaw Man • Kishibe", rarity: "legendaire", description: "Le plus redoutable chasseur de démons de la Sécurité Publique.", sort_order: 9206, category: "shonen", series: "Chainsaw Man", role: "Protagoniste", pack_ids: ["shonen", "protagoniste"], image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b144593-hdCTT9t54z0s.png", popularity: 4800 },
  { id: "csm-katana", name: "Katana Man", title: "Chainsaw Man • Katana Man", rarity: "legendaire", description: "Hybride redoutable maniant les lames de katana.", sort_order: 9207, category: "shonen", series: "Chainsaw Man", role: "Antagoniste", pack_ids: ["shonen", "antagoniste"], image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b157241-GkgQVzkFrmUD.jpg", popularity: 4200 },
  { id: "csm-himeno", name: "Himeno", title: "Chainsaw Man • Himeno", rarity: "epique", description: "Partenaire expérimentée d’Aki liée au démon Fantôme.", sort_order: 9208, category: "shonen", series: "Chainsaw Man", role: "Protagoniste", pack_ids: ["shonen", "protagoniste"], image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b144596-kvL6SD2litJu.png", popularity: 2200 },
  { id: "csm-kobeni", name: "Kobeni Higashiyama", title: "Chainsaw Man • Kobeni Higashiyama", rarity: "epique", description: "Recrue anxieuse dotée d’une agilité surhumaine.", sort_order: 9209, category: "shonen", series: "Chainsaw Man", role: "Protagoniste", pack_ids: ["shonen", "protagoniste"], image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b144594-0dbO1NSYeZ12.png", popularity: 2100 },
  { id: "tr-mikey", name: "Manjirou Sano", title: "Tokyo Revengers • Manjirou Sano", rarity: "mythique", description: "Commandant invaincu du Tokyo Manjikai, surnommé Mikey.", sort_order: 9001, category: "shonen", series: "Tokyo Revengers", role: "Membre du Toman", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b145341-CuPldCLZMvvf.png", popularity: 18000 },
  { id: "tr-draken", name: "Ken Ryuuguji", title: "Tokyo Revengers • Ken Ryuuguji", rarity: "mythique", description: "Vice-commandant du Toman, surnommé Draken.", sort_order: 9002, category: "shonen", series: "Tokyo Revengers", role: "Membre du Toman", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b145345-zyirrSsKIDCb.png", popularity: 12000 },
  { id: "tr-takemichi", name: "Takemichi Hanagaki", title: "Tokyo Revengers • Takemichi Hanagaki", rarity: "mythique", description: "Voyageur temporel prêt à tout pour sauver ses amis.", sort_order: 9003, category: "shonen", series: "Tokyo Revengers", role: "Membre du Toman", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b145342-GSUutL83jGgI.png", popularity: 9500 },
  { id: "tr-baji", name: "Keisuke Baji", title: "Tokyo Revengers • Keisuke Baji", rarity: "legendaire", description: "Capitaine de la première division du Toman.", sort_order: 9004, category: "shonen", series: "Tokyo Revengers", role: "Membre du Toman", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b145343-vRrkdWEUXwYM.jpg", popularity: 8800 },
  { id: "tr-chifuyu", name: "Chifuyu Matsuno", title: "Tokyo Revengers • Chifuyu Matsuno", rarity: "legendaire", description: "Vice-capitaine de la première division et fidèle partenaire.", sort_order: 9005, category: "shonen", series: "Tokyo Revengers", role: "Membre du Toman", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b145344-q4BqRljEBYNc.png", popularity: 8500 },
  { id: "tr-hinata", name: "Hinata Tachibana", title: "Tokyo Revengers • Hinata Tachibana", rarity: "legendaire", description: "Courageuse et déterminée, au cœur de la mission de Takemichi.", sort_order: 9006, category: "shonen", series: "Tokyo Revengers", role: "Membre du Toman", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b138453-MFISjDiAEfiM.png", popularity: 6200 },
  { id: "tr-mitsuya", name: "Takashi Mitsuya", title: "Tokyo Revengers • Takashi Mitsuya", rarity: "legendaire", description: "Capitaine de la deuxième division du Toman.", sort_order: 9007, category: "shonen", series: "Tokyo Revengers", role: "Membre du Toman", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b167841-Pp08TBnzGhK4.jpg", popularity: 5900 },
  { id: "tr-kisaki", name: "Tetta Kisaki", title: "Tokyo Revengers • Tetta Kisaki", rarity: "legendaire", description: "Stratège impitoyable tirant les ficelles dans l'ombre.", sort_order: 9008, category: "shonen", series: "Tokyo Revengers", role: "Antagoniste", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b170483-mXcSRDNqVwCP.png", popularity: 4800 },
  { id: "tr-hanma", name: "Shuuji Hanma", title: "Tokyo Revengers • Shuuji Hanma", rarity: "legendaire", description: "Bras droit imprévisible de Kisaki.", sort_order: 9009, category: "shonen", series: "Tokyo Revengers", role: "Antagoniste", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b215868-NwLXplJ79C62.png", popularity: 4500 },
  { id: "tr-kazutora", name: "Kazutora Hanemiya", title: "Tokyo Revengers • Kazutora Hanemiya", rarity: "epique", description: "Membre fondateur du Toman et membre du Valhalla.", sort_order: 9010, category: "shonen", series: "Tokyo Revengers", role: "Antagoniste", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b167846-k6G44c97MOug.jpg", popularity: 4200 },
  { id: "mm-ichigo", name: "Ichigo Momomiya", title: "Tokyo Mew Mew • Ichigo Momomiya", rarity: "mythique", description: "Leader des Mew Mew fusionnée avec l'ADN du chat d'Iriomote.", sort_order: 9011, category: "shojo", series: "Tokyo Mew Mew", role: "Mew Mew", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b2690-1MMNba7QrHDy.jpg", popularity: 5200 },
  { id: "mm-zakuro", name: "Zakuro Fujiwara", title: "Tokyo Mew Mew • Zakuro Fujiwara", rarity: "mythique", description: "Mannequin charismatique dotée de l'ADN du loup gris.", sort_order: 9012, category: "shojo", series: "Tokyo Mew Mew", role: "Mew Mew", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b2694-krd6JKqyvy0Q.png", popularity: 4100 },
  { id: "mm-mint", name: "Mint Aizawa", title: "Tokyo Mew Mew • Mint Aizawa", rarity: "legendaire", description: "Danseuse raffinée dotée de l'ADN du loriquet bleu.", sort_order: 9013, category: "shojo", series: "Tokyo Mew Mew", role: "Mew Mew", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b2691-1fRDi6x7s8mh.png", popularity: 3600 },
  { id: "mm-lettuce", name: "Lettuce Midorikawa", title: "Tokyo Mew Mew • Lettuce Midorikawa", rarity: "legendaire", description: "Douce et généreuse, dotée de l'ADN du marsouin aptère.", sort_order: 9014, category: "shojo", series: "Tokyo Mew Mew", role: "Mew Mew", image_url: "https://s4.anilist.co/file/anilistcdn/character/large/b2692-WGF3QlF22I13.png", popularity: 3400 },
];

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