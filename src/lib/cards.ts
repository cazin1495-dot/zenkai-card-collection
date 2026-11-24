import riku from "@/assets/characters/riku.jpg";
import mei from "@/assets/characters/mei.jpg";
import taro from "@/assets/characters/taro.jpg";
import hana from "@/assets/characters/hana.jpg";
import kaito from "@/assets/characters/kaito.jpg";
import yuki from "@/assets/characters/yuki.jpg";
import sora from "@/assets/characters/sora.jpg";
import akira from "@/assets/characters/akira.jpg";
import lyra from "@/assets/characters/lyra.jpg";
import ryujin from "@/assets/characters/ryujin.jpg";
import ultraInstinct from "@/assets/goku-ultra-instinct.png.asset.json";

/** Rarities used by draw, display, and economy rules. */
export type BaseRarity = "commune" | "non_commune" | "rare" | "epique" | "legendaire" | "mythique" | "transcendance";
/** Standard catalogue cards never store Transcendance; that is a copy/custom-card state. */
export type CatalogRarity = Exclude<BaseRarity, "transcendance">;
export type Rarity = BaseRarity;

export const CATALOG_RARITIES = ["commune", "non_commune", "rare", "epique", "legendaire", "mythique"] as const satisfies readonly CatalogRarity[];
export const USER_RARITY_OVERRIDES: Record<string, CatalogRarity> = {
  "tr-hinata": "legendaire",
  "tr-baji": "legendaire",
  "tr-chifuyu": "legendaire",
  "tr-mitsuya": "legendaire",
  "tr-kisaki": "legendaire",
  "tr-hanma": "legendaire",
  "tr-kazutora": "epique",
  "mm-mint": "legendaire",
  "mm-lettuce": "legendaire",
  "mm-pudding": "legendaire",
  "al-64771": "mythique",
  "al-162969": "mythique",
  "al-162213": "mythique",
  "al-245": "mythique",
  "al-907": "mythique",
  "al-906": "mythique",
  "al-1080": "mythique",
  "al-7": "mythique",
  "al-85": "mythique",
  "al-13": "mythique",
  "al-2423": "mythique",
  "al-88412": "mythique",
  "al-87277": "mythique",
  "al-309": "mythique",
  "al-167444": "legendaire",
  "al-169395": "legendaire",
  "al-169401": "mythique",
  "al-914": "legendaire",
  "al-67321": "legendaire",
  "al-67333": "legendaire",
  "al-67323": "legendaire",
  "al-36820": "mythique",
  "al-845": "legendaire",
  "al-42038": "mythique",
  "al-21332": "mythique",
  "al-18770": "mythique",
  "al-145": "legendaire",
  "al-2367": "legendaire",
  "al-88411": "legendaire",
  "al-137974": "legendaire",
  "al-158154": "legendaire",
  "hsr-20": "legendaire",
  "al-162214": "legendaire",
  "al-169394": "epique",
  "al-169397": "legendaire",
  "al-186875": "mythique",
  "al-187546": "epique",
  "al-187524": "epique",
  "al-22253": "legendaire",
  "al-53563": "legendaire",
  "al-22254": "legendaire",
  "al-45975": "legendaire",
  "al-307": "legendaire",
  "al-2767": "mythique",
  "al-2455": "mythique",
  "al-728": "legendaire",
  "al-124077": "legendaire",
  "al-2064": "legendaire",
  "al-120536": "legendaire",
  "al-187523": "epique",
  "al-2093": "epique",
  "al-169403": "legendaire",
  "al-191409": "legendaire",
  "al-169400": "epique",
  "al-196502": "legendaire",
  "al-42804": "legendaire",
  "al-12300": "mythique",
  "al-5833": "legendaire",
  "al-20594": "legendaire",
  "al-13898": "mythique",
  "al-678": "legendaire",
  "al-4318": "legendaire",
  "al-1900": "legendaire",
  "al-1902": "legendaire",
  "al-7302": "legendaire",
  "al-52425": "legendaire",
  "al-26": "epique",
  "al-5835": "rare",
  "al-29809": "rare",
  "al-41135": "rare",
};
export const USER_RARITY_OVERRIDES_KEY = "zenkai_admin_rarity_overrides";
export const USER_RARITY_OVERRIDES_UPDATED = "zenkai:rarity-overrides-updated";

export function isCatalogRarity(value: unknown): value is CatalogRarity {
  return CATALOG_RARITIES.some((rarity) => rarity === value);
}

export function parseUserRarityOverrides(raw: string | null): Record<string, CatalogRarity> {
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Configuration des raretés globales invalide.");
  }
  const entries: [string, CatalogRarity][] = [];
  for (const [key, rarity] of Object.entries(parsed)) {
    if (!key.trim() || !isCatalogRarity(rarity)) throw new Error("Configuration des raretés globales invalide.");
    entries.push([key, rarity]);
  }
  return { ...DEFAULT_USER_RARITY_OVERRIDES, ...Object.fromEntries(entries) };
}

export const DEFAULT_USER_RARITY_OVERRIDES: Readonly<Record<string, CatalogRarity>> = {
  "al-12464": "legendaire",
  "name:muichiro tokito": "legendaire",
  "name:obanai iguro": "legendaire",
  "name:sanemi shinazugawa": "legendaire",
  "name:gyomei himejima": "legendaire",
  "al-12465": "legendaire",
  "al-464903": "legendaire",
  "al-466014": "legendaire",
  "al-556642": "legendaire",
  "al-550017": "legendaire",
  "hsr-1": "legendaire",
  "hsr-6": "epique",
  "hsr-7": "epique",
  "hsr-8": "legendaire",
};

let remoteRarityOverridesSnapshot: string | null = null;
let remoteRarityOverridesRevision = 0;

export function getUserRarityOverridesSnapshot(): string | null {
  return typeof window === "undefined" ? null : remoteRarityOverridesSnapshot;
}

export function getRarityOverridesRevision() {
  return remoteRarityOverridesRevision;
}

export function getUserRarityOverrides(): Record<string, CatalogRarity> {
  return parseUserRarityOverrides(getUserRarityOverridesSnapshot());
}

export function applyRemoteRarityOverrides(remote: Record<string, CatalogRarity>) {
  if (typeof window === "undefined") return;
  const next = JSON.stringify(remote);
  remoteRarityOverridesRevision++;
  if (next === remoteRarityOverridesSnapshot) return;
  remoteRarityOverridesSnapshot = next;
  window.dispatchEvent(new Event(USER_RARITY_OVERRIDES_UPDATED));
}

export function subscribeUserRarityOverrides(onChange: () => void) {
  window.addEventListener(USER_RARITY_OVERRIDES_UPDATED, onChange);
  return () => window.removeEventListener(USER_RARITY_OVERRIDES_UPDATED, onChange);
}

export type Genre = "shonen" | "seinen" | "shojo" | "sport";
export type CardRole = "protagoniste" | "antagoniste";

export type Card = {
  id: string;
  name: string;
  title: string;
  rarity: CatalogRarity;
  serverRarity?: CatalogRarity;
  description: string;
  sort_order: number;
  transcendance_series_number?: string;
  category?: Genre | null;
  series?: string | null;
  role?: CardRole | null;
  image_url?: string | null;
  image_position?: string;
  image_scale?: number;
  quote?: string | null;
  voiceAudioUrl?: string | null;
  subtitleText?: string | null;
  popularity?: number;
};

export const DEMON_SLAYER_MYTHIC_CARDS: Card[] = [
  {
    id: "trans-ds-tanjiro", name: "Tanjiro Kamado", title: "Demon Slayer · Pourfendeur",
    description: "Pourfendeur au grand cœur, Tanjiro manie les souffles de l'Eau et du Soleil pour protéger sa sœur.",
    image_url: "https://cdn.myanimelist.net/images/characters/6/386735.jpg",
    rarity: "mythique", sort_order: 1200, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "trans-ds-nezuko", name: "Nezuko Kamado", title: "Demon Slayer · Démon protecteur",
    description: "Devenue démone, Nezuko protège les humains et combat aux côtés de son frère Tanjiro.",
    image_url: "https://cdn.myanimelist.net/images/characters/2/378254.jpg",
    rarity: "mythique", sort_order: 1201, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "trans-ds-zenitsu", name: "Zenitsu Agatsuma", title: "Demon Slayer · Pourfendeur de la Foudre",
    description: "Malgré sa peur, Zenitsu déploie une vitesse fulgurante grâce au souffle de la Foudre.",
    image_url: "https://cdn.myanimelist.net/images/characters/10/459689.jpg",
    rarity: "mythique", sort_order: 1202, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "trans-ds-inosuke", name: "Inosuke Hashibira", title: "Demon Slayer · Pourfendeur de la Bête",
    description: "Impétueux et instinctif, Inosuke combat avec deux lames et son souffle de la Bête.",
    image_url: "https://cdn.myanimelist.net/images/characters/3/329560.jpg",
    rarity: "mythique", sort_order: 1203, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "trans-ds-rengoku", name: "Kyojuro Rengoku", title: "Demon Slayer · Pilier de la Flamme",
    description: "Pilier de la Flamme au courage ardent, Rengoku défend les autres avec une détermination inébranlable.",
    image_url: "https://cdn.myanimelist.net/images/characters/10/423443.jpg",
    rarity: "mythique", sort_order: 1204, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "ds-tengen", name: "Tengen Uzui", title: "Demon Slayer · Pilier du Son",
    description: "Ancien shinobi flamboyant, Tengen combat avec le souffle du Son et deux lames reliées par une chaîne.",
    image_url: "https://cdn.myanimelist.net/images/characters/16/387706.jpg",
    rarity: "mythique", sort_order: 1205, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "ds-giyu", name: "Giyu Tomioka", title: "Demon Slayer · Pilier de l'Eau",
    description: "Discret et déterminé, Giyu maîtrise le souffle de l'Eau pour protéger les autres.",
    image_url: "https://cdn.myanimelist.net/images/characters/3/423445.jpg",
    rarity: "mythique", sort_order: 1206, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "ds-shinobu", name: "Shinobu Kocho", title: "Demon Slayer · Pilier de l'Insecte",
    description: "Rapide et précise, Shinobu emploie le souffle de l'Insecte et des poisons contre les démons.",
    image_url: "https://cdn.myanimelist.net/images/characters/3/386591.jpg",
    rarity: "mythique", sort_order: 1207, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "ds-muichiro", name: "Muichiro Tokito", title: "Demon Slayer · Pilier de la Brume",
    description: "Jeune prodige du sabre, Muichiro désoriente ses adversaires grâce au souffle de la Brume.",
    image_url: "https://cdn.myanimelist.net/images/characters/5/464903.jpg",
    rarity: "mythique", sort_order: 1208, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "ds-mitsuri", name: "Mitsuri Kanroji", title: "Demon Slayer · Pilier de l'Amour",
    description: "Chaleureuse et dotée d'une force exceptionnelle, Mitsuri manie une lame souple avec le souffle de l'Amour.",
    image_url: "https://cdn.myanimelist.net/images/characters/11/514229.jpg",
    rarity: "mythique", sort_order: 1209, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "ds-obanai", name: "Obanai Iguro", title: "Demon Slayer · Pilier du Serpent",
    description: "Rigoureux et accompagné de Kaburamaru, Obanai manie le souffle du Serpent avec précision.",
    image_url: "https://cdn.myanimelist.net/images/characters/15/466014.jpg",
    rarity: "mythique", sort_order: 1210, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "ds-sanemi", name: "Sanemi Shinazugawa", title: "Demon Slayer · Pilier du Vent",
    description: "Déterminé et impétueux, Sanemi déchaîne le souffle du Vent contre les démons.",
    image_url: "https://cdn.myanimelist.net/images/characters/11/556642.jpg",
    rarity: "mythique", sort_order: 1211, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
  {
    id: "ds-gyomei", name: "Gyomei Himejima", title: "Demon Slayer · Pilier de la Roche",
    description: "Imposant et compatissant, Gyomei utilise le souffle de la Roche avec une hache et un fléau reliés par une chaîne.",
    image_url: "https://cdn.myanimelist.net/images/characters/10/550017.jpg",
    rarity: "mythique", sort_order: 1212, series: "Demon Slayer", category: "shonen", role: "protagoniste",
    image_position: "center", image_scale: 0.92,
  },
];

const DEMON_SLAYER_MYTHIC_IDS = new Set(DEMON_SLAYER_MYTHIC_CARDS.map((card) => card.id));
const LEGACY_DEMON_SLAYER_TRANSCENDANCE_IDS = new Set(DEMON_SLAYER_MYTHIC_CARDS.filter((card) => card.id.startsWith("trans-ds-")).map((card) => card.id));
export function isDemonSlayerMythicCardId(id: string): boolean {
  return DEMON_SLAYER_MYTHIC_IDS.has(id);
}
export function isLegacyDemonSlayerTranscendanceCardId(id: string): boolean {
  return LEGACY_DEMON_SLAYER_TRANSCENDANCE_IDS.has(id);
}

/** One owned copy coming out of a booster. */
export type PulledCard = { userCardId: string; card: Card; transcended?: boolean; customTranscendance?: boolean; isNew?: boolean };

export function isTranscendanceCatalogCard(card: { id: string; name?: string; rarity: string; transcendance_series_number?: string }): boolean {
  const name = card.name?.trim().toLowerCase();
  if (card.transcendance_series_number) return true;
  if (name === "goku black" && !card.id.toUpperCase().endsWith("-TR")) return false;
  return card.rarity.toLowerCase() === "transcendance"
    || card.id.toUpperCase().endsWith("-TR")
    || name === "son goku (ultra instinct)"
    || name === "goku ultra instinct";
}

export const CHARACTER_RARITY_OVERRIDES: Readonly<Record<string, CatalogRarity>> = {
  hancock: "mythique", "boa hancock": "mythique", "hancock boa": "mythique",
  whitebeard: "mythique", "edward newgate": "mythique", "newgate edward": "mythique", "barbe blanche": "mythique",
  pain: "mythique", nagato: "mythique",
  shikamaru: "mythique", "shikamaru nara": "mythique",
  yamato: "mythique", nami: "mythique",
  hinata: "mythique", "hinata hyuga": "mythique", "hinata hyuuga": "mythique",
  trunks: "mythique", "mirai trunks": "mythique", "future trunks": "mythique",
  hashirama: "mythique", "hashirama senju": "mythique",
  "mei mei": "mythique",
  tobirama: "mythique", "tobirama senju": "mythique",
  kawaki: "mythique", kenjaku: "mythique",
  minato: "mythique", "minato namikaze": "mythique",
  grimmjow: "legendaire", "grimmjow jaegerjaquez": "legendaire",
  zaraki: "legendaire", "kenpachi zaraki": "legendaire",
  orihime: "legendaire", "orihime inoue": "legendaire",
  hitsugaya: "legendaire", "toshiro hitsugaya": "legendaire", "toushirou hitsugaya": "legendaire",
  byakuya: "legendaire", "byakuya kuchiki": "legendaire",
  "rock lee": "legendaire", lee: "legendaire", tobi: "legendaire",
  choso: "legendaire", chousou: "legendaire", mahito: "legendaire",
  doflamingo: "legendaire", "donquixote doflamingo": "legendaire", "doflamingo donquixote": "legendaire",
  franky: "legendaire", jinbe: "legendaire", jinbei: "legendaire",
  renji: "legendaire", "renji abarai": "legendaire",
  beerus: "legendaire", neji: "legendaire", "neji hyuga": "legendaire", "neji hyuuga": "legendaire",
  kurama: "legendaire", kyubi: "legendaire", kyuubi: "legendaire",
  sabo: "legendaire", bardock: "legendaire", whis: "legendaire",
  sarada: "legendaire", "sarada uchiha": "legendaire", mitsuki: "legendaire",
  "killer bee": "legendaire", "killer b": "legendaire",
};

export const CUSTOM_RARITY: Record<string, "mythique" | "legendaire"> = {
  // === MYTHIQUES (14) ===
  "hancock": "mythique",
  "boa hancock": "mythique",
  "whitebeard": "mythique",
  "edward newgate": "mythique",
  "barbe blanche": "mythique",
  "pain": "mythique",
  "nagato": "mythique",
  "shikamaru": "mythique",
  "shikamaru nara": "mythique",
  "yamato": "mythique",
  "nami": "mythique",
  "hinata": "mythique",
  "hinata hyuga": "mythique",
  "trunks": "mythique",
  "mirai trunks": "mythique",
  "future trunks": "mythique",
  "hashirama": "mythique",
  "hashirama senju": "mythique",
  "mei mei": "mythique",
  "tobirama": "mythique",
  "tobirama senju": "mythique",
  "kawaki": "mythique",
  "kenjaku": "mythique",
  "minato": "mythique",
  "minato namikaze": "mythique",

  // === OR / LÉGENDAIRES (22) ===
  "grimmjow": "legendaire",
  "grimmjow jaegerjaquez": "legendaire",
  "zaraki": "legendaire",
  "kenpachi zaraki": "legendaire",
  "orihime": "legendaire",
  "orihime inoue": "legendaire",
  "hitsugaya": "legendaire",
  "toshiro hitsugaya": "legendaire",
  "byakuya": "legendaire",
  "byakuya kuchiki": "legendaire",
  "rock lee": "legendaire",
  "lee": "legendaire",
  "tobi": "legendaire",
  "choso": "legendaire",
  "chousou": "legendaire",
  "mahito": "legendaire",
  "doflamingo": "legendaire",
  "donquixote doflamingo": "legendaire",
  "franky": "legendaire",
  "jinbe": "legendaire",
  "jinbei": "legendaire",
  "renji": "legendaire",
  "renji abarai": "legendaire",
  "beerus": "legendaire",
  "neji": "legendaire",
  "neji hyuga": "legendaire",
  "kurama": "legendaire",
  "kyubi": "legendaire",
  "sabo": "legendaire",
  "bardock": "legendaire",
  "whis": "legendaire",
  "sarada": "legendaire",
  "sarada uchiha": "legendaire",
  "mitsuki": "legendaire",
  "killer bee": "legendaire",
  "killer b": "legendaire",
};


export function characterRarity(
  name: string,
  rarity: BaseRarity,
  cardId?: string,
  overrides = getUserRarityOverrides(),
): BaseRarity {
  if (rarity === "transcendance") return rarity;
  const normalizedName = name.trim().toLowerCase();
  const override = (cardId && Object.hasOwn(overrides, cardId) ? overrides[cardId] : undefined)
    ?? (Object.hasOwn(overrides, normalizedName) ? overrides[normalizedName] : undefined)
    ?? Object.entries(overrides).find(([key]) => key.trim().toLowerCase() === normalizedName)?.[1];
  if (override) return override;
  const defaultOverride = cardId && Object.hasOwn(DEFAULT_USER_RARITY_OVERRIDES, cardId)
    ? DEFAULT_USER_RARITY_OVERRIDES[cardId] : undefined;
  if (defaultOverride) return defaultOverride;
  const fixedOverride = cardId && Object.hasOwn(USER_RARITY_OVERRIDES, cardId) ? USER_RARITY_OVERRIDES[cardId] : undefined;
  if (fixedOverride) return fixedOverride;
  const lowercaseName = name.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (Object.hasOwn(CUSTOM_RARITY, lowercaseName) && CUSTOM_RARITY[lowercaseName]) return CUSTOM_RARITY[lowercaseName];
  const activeOverrides = overrides ?? getUserRarityOverrides();
  const normKey = lowercaseName.replace(/\s+/g, " ").trim(); if (normKey.includes("narrator") || normKey.includes("narrateur")) return "commune";
  if (cardId && Object.hasOwn(activeOverrides, cardId)) return activeOverrides[cardId] ?? rarity;
  if (Object.hasOwn(activeOverrides, "name:" + normKey)) return activeOverrides["name:" + normKey] ?? rarity;
  if (Object.hasOwn(activeOverrides, normKey)) return activeOverrides[normKey] ?? rarity;
  const words = lowercaseName.split(/[\s\-·()]+/);
  for (const [key, customR] of Object.entries(CUSTOM_RARITY)) {
    const cleanKey = key.normalize("NFD").replace(/\p{M}/gu, "");
    if (cleanKey.includes(" ") ? lowercaseName.includes(cleanKey) : words.includes(cleanKey)) {
      return customR;
    }
  }
  const key = lowercaseName.replace(/\s+/g, " ");
  return Object.hasOwn(CHARACTER_RARITY_OVERRIDES, key) ? CHARACTER_RARITY_OVERRIDES[key] ?? rarity : rarity;
}


/** Applies global catalog overrides without changing the original rarity. */
export function normalizeCatalogCard(card: Card, overrides = getUserRarityOverrides()): Card {
  if (isTranscendanceCatalogCard(card)) return card;
  const baseRarity = card.serverRarity ?? card.rarity;
  if (card.name.trim().toLowerCase() === "goku black") {
    const rarity = characterRarity(card.name, "mythique", card.id, overrides);
    return { ...card, serverRarity: baseRarity, rarity: rarity === "transcendance" ? "mythique" : rarity, category: "shonen", role: "antagoniste" };
  }
  const pop = card.popularity ?? 0; const isIconicMythic = /\b(edward elric|roy mustang|saitama|garou|gabimaru|sagiri|nanachi|reg|mei misaki|marin kitagawa|maomao|jinshi|mai sakurajima|sakuta azusagawa|sawako kuronuma|shouta kazehaya|yona|hak son|ash lynx|eiji okumura|hina amano|hodaka morishima|suzume iwato|souta munakata|chihiro ogino|haku|totoro|mei kusakabe|hauru|sophie hatter|san|ashitaka|shouko nishimiya|shouya ishida|rudo surebrec|enjin|ashito aoi|haruhisa kuribayashi|hanamichi sakuragi|kaede rukawa|reki kyan|langa hasegawa|taiki inomata|chinatsu kano|goku|vegeta|naruto|sasuke|itachi|kakashi|madara|boruto|kawaki|ichigo|aizen|kenpachi|guts|griffith|kaneki|touka|juzo|juuzou|thorfinn|askeladd|johan|tenma|isagi|bachira|nagi|shoyo hinata|shouyou hinata|kageyama|kuroko|kagami|aomine|ippo|takamura|usagi|sailor moon|mamoru chiba|tuxedo mask|sakura kinomoto|syaoran|tohru|kyo sohma|yuki sohma|nana osaki|nana komatsu|mikey|manjiro|manjirou|draken|ryuguji|ryuuguji|chifuyu|takemichi|yuri katsuki|victor nikiforov|yuri plisetsky|kilari tsukishima|hiroto kazama|momo ayase|okarun|turbo granny|koro-sensei|nagisa shiota|karma akabane|frieren|fern|himmel|kyouko hori|miyamura|ai hoshino|aqua hoshino|ruby hoshino|lelouch|c\.c\.|suzaku|violet evergarden|gilbert bougainvillea|light yagami|l lawliet|ryuk|ayanokoji|karuizawa|ryuen|ryuuen|kaguya|miyuki|chika|dazai|chuuya|chuya|akutagawa|akame|esdeath|tatsumi|meliodas|ban|escanor|zeldris|loid|anya|yor|mitsuha|taki|kaori|kousei|makima|reze|denji|power|mark evans|mamoru endou|axel blaze|shuuya gouenji|shawn froste|shirou fubuki|youichi hiruma|sena kobayakawa|ryoma echizen|kunimitsu tezuka|kurumi tokisaki|tohka yatogami|emilia|rem|subaru natsuki|saber (artoria pendragon)|gilgamesh|archer (emiya)|rin tohsaka|tsubasa oozora|kojirou hyuuga|genzou wakabayashi|eijun sawamura|kazuya miyuki|ainz ooal gown|albedo|david martinez|lucy|shiki ichinose|naito mudano|gintoki sakata|kagura|yuusuke urameshi|hiei|kurama|seiya|ikki du phénix|saga des gémeaux|sung jin-woo|cha hae-in|asta|yuno|yami sukehiro|coco|kieffrey|qifrey|gojo|sukuna|yuji|yuuji|megumi|luffy|zoro|sanji|shanks|portgas|ace|midoriya|deku|bakugo|bakugou|todoroki|all might|gon|killua|kurapika|hisoka|natsu|lucy heartfilia|erza|gray fullbuster|eren|levi|mikasa|senku|tsukasa shishio|gen asagiri|tanjiro|tanjirou|nezuko|zenitsu|inosuke|rengoku|muzan|doremi|onpu|coco|kieffrey|qifrey|coco|kieffrey|qifrey)\b/i.test(card.name) && card.id !== "tr-hinata"; const popTier: CatalogRarity = isIconicMythic ? "mythique" : pop >= 2500 ? "legendaire" : pop >= 800 ? "epique" : pop >= 200 ? "rare" : "commune"; const rarity = card.id === "tr-hinata" ? "legendaire" : popTier;
  return rarity === baseRarity || rarity === "transcendance"
    ? { ...card, rarity: baseRarity }
    : { ...card, serverRarity: baseRarity, rarity };
}

/** Booster rules — mirror public.open_boosters(). */
export const CARDS_PER_BOOSTER = 5;
export const STOCK_CAP = 15;
export const STOCK_REGEN_MINUTES = 10;
export const STOCK_REGEN_MS = STOCK_REGEN_MINUTES * 60 * 1000;
export const OPEN_COUNTS = [1, 5, 10] as const;
export const TRANSCEND_CHANCE_PERCENT = 0.05;
export const TRANSCEND_CHANCE_LABEL = `${TRANSCEND_CHANCE_PERCENT} %`;
export const GOKU_CARD_ID = "al-246";

export function cardIdentity(card: Card, transcended = false) {
  if (transcended && card.id === "al-30") {
    return { name: "Gon Freecss · Serment Absolu", title: "Hunter x Hunter · Sacrifice Ultime" };
  }
  if (transcended && card.id === GOKU_CARD_ID) {
    return { name: "Son Goku (Ultra Instinct)", title: "Ultra Instinct · Guerrier Saiyan" };
  }
  return { name: card.name, title: card.title };
}

/** Drop chance per card, in percent (mirrors the SQL thresholds). */
export const DROP_RATES: Record<BaseRarity, number> = {
  commune: 54,
  non_commune: 26.5,
  rare: 14,
  epique: 4,
  legendaire: 1.2,
  mythique: 0.25,
  transcendance: 0.05,
};

export const ZENKAI_DROP_RATES: Record<BaseRarity, number> = {
  commune: 10, non_commune: 25, rare: 35, epique: 19,
  legendaire: 8, mythique: 2.5, transcendance: 0.5,
};
export const ZENKAI_BOOSTER_COST = 500;

const CARD_BASE_MARKET_PRICES: Record<BaseRarity, number> = {
  commune: 10, non_commune: 25, rare: 60, epique: 150,
  legendaire: 400, mythique: 1200, transcendance: 5000,
};

export function getCardPopularityFactor(card: Pick<Card, "popularity">): number {
  return 1 + Math.min(1, Math.max(0, (card.popularity ?? 0) / 80000));
}

export function getCardMarketPrice(card: { rarity: BaseRarity; popularity?: number }): number {
  return Math.round((CARD_BASE_MARKET_PRICES[card.rarity] * getCardPopularityFactor(card)) / 5) * 5;
}

export function getCardRecycleValue(card: { rarity: BaseRarity; popularity?: number }): number {
  return card.rarity === "transcendance" ? 0 : Math.max(2, Math.round(getCardMarketPrice(card) * 0.4));
}

export const PITY_LIMIT = 200;

export function rarityFromRoll(roll: number): BaseRarity {
  if (roll < 54) return "commune";
  if (roll < 80.5) return "non_commune";
  if (roll < 94.5) return "rare";
  if (roll < 98.5) return "epique";
  if (roll < 99.7) return "legendaire";
  if (roll < 99.95) return "mythique";
  return "transcendance";
}

export function effectiveDropRate(rarity: BaseRarity, pack?: PackId) {
  return (pack === "zenkai" ? ZENKAI_DROP_RATES : DROP_RATES)[rarity];
}

/** Legacy fictional test art, kept for cards without an AniList portrait. */
export const CARD_ART: Record<string, string> = {
  riku, mei, taro, hana, kaito, yuki, sora, akira, lyra, ryujin,
};

export function cardArt(card: Pick<Card, "id" | "image_url">, transcended = false) {
  if (transcended && card.id === "al-30") return "/gon%20adulte.webp";
  if (transcended && card.id === GOKU_CARD_ID) return ultraInstinct.url;
  return card.image_url || CARD_ART[card.id] || "";
}

export const RARITY_ORDER: Rarity[] = ["transcendance", "mythique", "legendaire", "epique", "rare", "non_commune", "commune"];

export function rarityRank(r: Rarity) {
  return RARITY_ORDER.indexOf(r);
}

export const RARITY: Record<Rarity, { label: string; text: string; border: string; glow: string; bg: string }> = {
  commune: { label: "Commune", text: "text-rarity-commune", border: "border-rarity-commune", glow: "glow-commune", bg: "bg-rarity-commune" },
  non_commune: { label: "Peu Commune", text: "text-rarity-non-commune", border: "border-rarity-non-commune", glow: "glow-non-commune", bg: "bg-rarity-non-commune" },
  rare: { label: "Rare", text: "text-rarity-rare", border: "border-rarity-rare", glow: "glow-rare", bg: "bg-rarity-rare" },
  epique: { label: "Épique", text: "text-rarity-epique", border: "border-rarity-epique", glow: "glow-epique", bg: "bg-rarity-epique" },
  legendaire: { label: "Légendaire", text: "text-rarity-legendaire", border: "border-rarity-legendaire", glow: "glow-legendaire", bg: "bg-rarity-legendaire" },
  mythique: { label: "Mythique", text: "text-rarity-mythique", border: "border-rarity-mythique", glow: "glow-mythique", bg: "bg-rarity-mythique" },
  transcendance: { label: "Transcendance", text: "text-gradient-transcend", border: "border-rarity-transcendance", glow: "glow-transcendance", bg: "bg-rarity-transcendance" },
};

export type PackId = "shonen" | "seinen" | "shojo" | "sport" | "antagoniste" | "protagoniste" | "zenkai";

export const PACK_ARTWORK = "/image_c1811ac7.jpg";
export const PACK_ARTWORK_BY_PACK: Record<PackId, string> = {
  shonen: PACK_ARTWORK, seinen: "/pack-seinen-aligned.png", shojo: "/pack-shojo-aligned.png",
  sport: "/pack-sport-aligned.png", antagoniste: "/pack-antagoniste-aligned.png",
  protagoniste: "/pack-protagoniste.png", zenkai: PACK_ARTWORK,
};
export const CARD_BACK_BY_PACK: Record<PackId, string> = {
  shonen: "/image_39f4fe98.jpg", seinen: "/card-back-seinen.png",
  shojo: "/card-back-shojo.png", sport: "/carte%20sport.jpg",
  antagoniste: "/card-back-antagoniste.png", protagoniste: "/card-back-protagoniste.png",
  zenkai: "/image_39f4fe98.jpg",
};

export function getPackCardBack(packId: PackId): string {
  return CARD_BACK_BY_PACK[packId];
}

export const PACKS: { id: PackId; label: string; hint: string; accent: string }[] = [
  { id: "shonen", label: "Shonen Mix", hint: "All-Star · Toutes les cartes de toutes les catégories réunies", accent: "var(--pack-shonen)" },
  { id: "seinen", label: "Seinen", hint: "Berserk, Vinland Saga, Tokyo Ghoul, Monster", accent: "var(--pack-seinen)" },
  { id: "shojo", label: "Shojo", hint: "Fruits Basket, Nana, Sailor Moon, Sakura", accent: "var(--pack-shojo)" },
  { id: "sport", label: "Sport", hint: "Blue Lock, Haikyuu!!, Kuroko, Ippo", accent: "var(--pack-sport)" },
  { id: "antagoniste", label: "Antagoniste", hint: "Les méchants de toutes les sagas", accent: "var(--pack-antagoniste)" },
  { id: "protagoniste", label: "Protagoniste", hint: "Les héros principaux", accent: "var(--pack-protagoniste)" },
  { id: "zenkai", label: "Booster Zenkai", hint: "Tout le catalogue avec des taux boostés", accent: "#c084fc" },
];

/** Does a card belong to a booster pack / collection filter? */
export function inPack(card: Card, pack: PackId | string) {
  const normalized = pack.trim().toLocaleLowerCase("en").replace(/[\s_-]+/g, "");
  if (["shonen", "shonenmix", "all", "allstar", "zenkai"].includes(normalized)) return true;
  if (normalized === "antagoniste" || normalized === "protagoniste")
    return card.role === normalized;
  return card.category === normalized;
}

/** Live booster stock: +1 every 10 minutes, capped at 15 (mirrors the server). */
export function boosterStock(stored: number, updatedAt: string | Date, now: number) {
  const upd = new Date(updatedAt).getTime();
  const ticks = Math.floor(Math.max(0, now - upd) / STOCK_REGEN_MS);
  const count = Math.min(STOCK_CAP, stored + ticks);
  if (count >= STOCK_CAP) return { count: STOCK_CAP, nextInMs: null as number | null };
  return { count, nextInMs: upd + (ticks + 1) * STOCK_REGEN_MS - now };
}

/** Highest rarity among pulled cards. */
export function bestRarity(rarities: Rarity[]): Rarity | null {
  return rarities.reduce<Rarity | null>((a, r) => (a === null || rarityRank(r) < rarityRank(a) ? r : a), null);
}

/** "mm:ss" countdown label. */
export function formatCountdown(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}