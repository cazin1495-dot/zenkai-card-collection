import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_RARITY, DEMON_SLAYER_MYTHIC_CARDS, inPack, isTranscendanceCatalogCard, setUserRarityOverride, type Card } from "./cards";
import { CUSTOM_TRANSCENDANCE_CARDS } from "./transcendance-cards";
import { cardsQuery, CUSTOM_RARITY as queryCustomRarity, useCards, useCardsByPack, useProfile, useUserCards } from "./queries";

const mockFrom = vi.hoisted(() => vi.fn());
vi.mock("./cards.functions", () => ({
  getCards: async (): Promise<Card[]> => [
    { id: "al-133702", name: "Mahito", title: "", description: "", rarity: "rare", sort_order: 0 },
    { id: "nami", name: "Nami", title: "", description: "", rarity: "rare", sort_order: 1, category: "shonen" },
  ],
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mockFrom } }));

describe("catalog query", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem("zenkai_admin_rarity_overrides");
  });

  it("includes Demon Slayer cards only as Mythique catalogue cards", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const cards = await new QueryClient().fetchQuery(cardsQuery);
    for (const hero of DEMON_SLAYER_MYTHIC_CARDS) {
      const matches = cards.filter((card) => card.id === hero.id);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({ rarity: "mythique", category: "shonen", role: "protagoniste", series: "Demon Slayer" });
      expect(isTranscendanceCatalogCard(matches[0]!)).toBe(false);
      expect(CUSTOM_TRANSCENDANCE_CARDS.some((card) => card.id === hero.id)).toBe(false);
      for (const pack of ["shonen", "protagoniste", "zenkai"] as const) expect(inPack(matches[0]!, pack)).toBe(true);
    }
  });

  it("includes the eight Hashira with their own portraits and titles", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const cards = await new QueryClient().fetchQuery(cardsQuery);
    for (const [name, title, image] of [
      ["Tengen Uzui", "Pilier du Son", "16/387706.jpg"],
      ["Giyu Tomioka", "Pilier de l'Eau", "3/423445.jpg"],
      ["Shinobu Kocho", "Pilier de l'Insecte", "3/386591.jpg"],
      ["Muichiro Tokito", "Pilier de la Brume", "5/464903.jpg"],
      ["Mitsuri Kanroji", "Pilier de l'Amour", "11/514229.jpg"],
      ["Obanai Iguro", "Pilier du Serpent", "15/466014.jpg"],
      ["Sanemi Shinazugawa", "Pilier du Vent", "11/556642.jpg"],
      ["Gyomei Himejima", "Pilier de la Roche", "10/550017.jpg"],
    ]) {
      const matches = cards.filter((card) => card.name === name);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        title: `Demon Slayer · ${title}`, rarity: "mythique", series: "Demon Slayer",
        image_url: `https://cdn.myanimelist.net/images/characters/${image}`,
      });
    }
  });

  it("loads and normalizes 25 My Hero Academia cards for the album and requested packs", async () => {
    const mythicIds = [89028, 88892, 89220, 89224, 89226, 126378, 128299, 148985];
    const legendaryIds = [89221, 89225, 126158, 125619, 89589, 126357, 225724];
    const antagonistIds = [89226, 126378, 125619, 89589, 126357, 125956, 225724, 126067];
    const ids = [89220, 88892, 89028, 89225, 89224, 89243, 89221, 89226, 89249, 89223, 89897, 89898, 89241, 89247, 89222, 127427, 89895, 121529, 127042, 89900, 125956, 127425, 89244, 89899, 89896];
    let mhaQuery = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? init.body : "";
      if (body.includes("Media(id: 21459,")) {
        mhaQuery = body;
        return { ok: true, json: async () => ({ data: { Media: { characters: { edges: ids.map((id) => ({
          node: { id, name: { full: `MHA ${id}` }, image: { large: `https://example.com/${id}` }, favourites: 100 },
        })) } } } }) };
      }
      return { ok: true, json: async () => ({}) };
    }));
    setUserRarityOverride("al-89028", "rare");
    const client = new QueryClient();
    client.setQueryData(["cards-v21"], [{ id: "stale" }]);
    const cards = await client.fetchQuery(cardsQuery);
    const mha = cards.filter((card) => card.series === "My Hero Academia");
    expect(mhaQuery).toContain("perPage: 25");
    expect(ids).toHaveLength(25);
    expect(mha).toHaveLength(25);
    expect(mha.find((card) => card.id === "al-89224")?.role).toBe("protagoniste");
    expect(mha.find((card) => card.id === "al-89226")?.role).toBe("antagoniste");
    expect(mha.find((card) => card.id === "al-125956")?.role).toBe("antagoniste");
    expect(cards.some((card) => card.id === "stale")).toBe(false);
    for (const card of mha) {
      const id = Number(card.id.slice(3));
      const antagonist = antagonistIds.includes(id);
      expect(card).toMatchObject({
        category: "shonen",
        role: antagonist ? "antagoniste" : "protagoniste",
        title: `My Hero Academia · ${antagonist ? "Antagoniste" : "Héros"}`,
        image_url: `https://example.com/${id}`,
        popularity: 100,
      });
      expect(inPack(card, "shonen")).toBe(true);
      expect(inPack(card, "zenkai")).toBe(true);
      expect(inPack(card, "antagoniste")).toBe(antagonist);
      expect(inPack(card, "protagoniste")).toBe(!antagonist);
      if (id === 89028) {
        expect(card).toMatchObject({ rarity: "rare", serverRarity: "mythique" });
      } else if (mythicIds.includes(id)) {
        expect(card.rarity).toBe("mythique");
      } else if (legendaryIds.includes(id)) {
        expect(card.rarity).toBe("legendaire");
      }
    }
    client.clear();
  });

  it("keeps the existing database card when a My Hero Academia id is already present", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => typeof init?.body === "string" && init.body.includes("Media(id: 21459,")
        ? { data: { Media: { characters: { edges: [{ node: { id: 133702, name: { full: "Duplicate" } } }] } } } }
        : {},
    })));
    const client = new QueryClient();
    const cards = await client.fetchQuery(cardsQuery);
    expect(cards.filter((card) => card.id === "al-133702")).toHaveLength(1);
    expect(cards.find((card) => card.id === "al-133702")?.name).toBe("Mahito");
    client.clear();
  });

  it("loads and routes Hunter x Hunter characters, deduplicating the base catalogue", async () => {
    const mythicIds = [27, 30, 31, 28, 23277, 57, 23338, 23278];
    const legendaryIds = [33, 3200, 27996, 58193, 4423, 23337];
    const antagonistIds = [31, 23277, 57, 23278, 33, 3200, 26165, 24558, 24560, 58, 12300];
    const ids = [...mythicIds, ...legendaryIds, 26165, 24558, 24560, 58, 12300, 90003, 90004, 90005, 90006, 90007, 133702];
    let hxhQuery = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? init.body : "";
      if (body.includes("Media(id: 11061")) {
        hxhQuery = body;
        return {
          ok: true,
          json: async () => ({ data: { Media: { characters: { edges: ids.map((id) => ({
            node: { id, name: { full: `HXH ${id}` }, image: { large: `https://example.com/${id}` }, favourites: 100 },
          })) } } } }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }));
    setUserRarityOverride("al-31", "epique");
    const client = new QueryClient();
    client.setQueryData(["cards-v20"], [{ id: "stale" }]);
    const cards = await client.fetchQuery(cardsQuery);
    const hxh = cards.filter((card) => card.series === "Hunter x Hunter");
    expect(hxhQuery).toContain("perPage: 25");
    expect(ids).toHaveLength(25);
    expect(hxh).toHaveLength(24);
    expect(cards.filter((card) => card.id === "al-133702")).toHaveLength(1);
    expect(cards.some((card) => card.id === "stale")).toBe(false);
    expect(hxh.find((card) => card.id === "al-58")?.role).toBe("antagoniste");
    expect(hxh.find((card) => card.id === "al-12300")?.role).toBe("antagoniste");
    for (const card of hxh) {
      const id = Number(card.id.slice(3));
      const antagonist = antagonistIds.includes(id);
      expect(card).toMatchObject({
        category: "shonen",
        role: antagonist ? "antagoniste" : "protagoniste",
        title: `Hunter x Hunter · ${antagonist ? "Antagoniste" : "Hunter"}`,
        image_url: `https://example.com/${id}`,
        popularity: 100,
      });
      expect(inPack(card, "shonen")).toBe(true);
      expect(inPack(card, "zenkai")).toBe(true);
      expect(inPack(card, "antagoniste")).toBe(antagonist);
      expect(inPack(card, "protagoniste")).toBe(!antagonist);
      if (id === 31) {
        expect(card).toMatchObject({ rarity: "epique", serverRarity: "mythique" });
      } else if (mythicIds.includes(id)) {
        expect(card.rarity).toBe("mythique");
      } else if (legendaryIds.includes(id)) {
        expect(card.rarity).toBe("legendaire");
      }
    }
    client.clear();
  });

  it("applies saved id overrides to database, AniList and HSR cards", async () => {
    setUserRarityOverride("nami", "epique");
    setUserRarityOverride("al-1", "rare");
    setUserRarityOverride("hsr-1", "commune");
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => typeof init?.body === "string" && init.body.includes("113415")
        ? { data: { Media: { characters: { edges: [{ node: { id: 1, name: { full: "Chousou" } } }] } } } }
        : {},
    })));
    const cards = await new QueryClient().fetchQuery(cardsQuery);
    expect(cards.find((card) => card.id === "nami")).toMatchObject({ rarity: "epique", serverRarity: "rare" });
    expect(cards.find((card) => card.id === "al-1")?.rarity).toBe("rare");
    expect(cards.find((card) => card.id === "hsr-1")?.rarity).toBe("commune");
  });

  it("normalizes existing and fetched cards once, including fetched mythic Sabo", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? init.body : "";
      const names = body.includes("113415")
        ? [{ id: 133702, name: "Mahito" }, { id: 1, name: "Chousou" }]
        : body.includes("Media(id: 21,")
          ? [{ id: 36757, name: "Sabo" }]
          : null;
      return {
        ok: true,
        json: async () => names
          ? { data: { Media: { characters: { edges: names.map(({ id, name }) => ({
            node: { id, name: { full: name }, favourites: 10 },
          })) } } } }
          : { query: { pages: {} } },
      };
    }));

    const client = new QueryClient();
    const cards = await client.fetchQuery(cardsQuery);
    expect(cards.filter((card) => card.id === "al-133702")).toHaveLength(1);
    expect(cards.find((card) => card.id === "al-133702")?.rarity).toBe("legendaire");
    expect(cards.find((card) => card.id === "nami")?.rarity).toBe("mythique");
    expect(cards.find((card) => card.id === "nami")?.serverRarity).toBe("rare");
    expect(cards.find((card) => card.id === "al-1")?.rarity).toBe("legendaire");
    expect(cards.find((card) => card.id === "al-36757")?.rarity).toBe("legendaire");
  });

  it("applies custom rarity to cards from the database, AniList, and HSR", async () => {
    expect(queryCustomRarity).toBe(CUSTOM_RARITY);
    CUSTOM_RARITY["nami"] = "legendaire";
    CUSTOM_RARITY["chousou"] = "mythique";
    CUSTOM_RARITY["firefly"] = "legendaire";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => typeof init?.body === "string" && init.body.includes("113415")
        ? { data: { Media: { characters: { edges: [{ node: { id: 1, name: { full: "Chousou" } } }] } } } }
        : {},
    })));
    try {
      const cards = await new QueryClient().fetchQuery(cardsQuery);
      expect(cards.find((card) => card.id === "nami")?.rarity).toBe("legendaire");
      expect(cards.find((card) => card.id === "al-1")?.rarity).toBe("mythique");
      expect(cards.find((card) => card.id === "hsr-1")).toMatchObject({
        name: "Firefly",
        rarity: "legendaire",
        serverRarity: "mythique",
      });
    } finally {
      delete CUSTOM_RARITY["nami"];
      delete CUSTOM_RARITY["chousou"];
      delete CUSTOM_RARITY["firefly"];
    }
  });

  it("shares the normalized catalogue with pack hooks and disables account queries without a user", async () => {
    CUSTOM_RARITY["nami"] = "legendaire";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["cards-v20"], [
      { id: "nami", name: "Nami", title: "", description: "", rarity: "rare", sort_order: 1, category: "shonen" },
    ]);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    try {
      const { result } = renderHook(() => ({
        all: useCards(),
        shonen: useCardsByPack("shonen"),
        profile: useProfile(),
        collection: useUserCards(),
      }), { wrapper });
      await waitFor(() => expect(result.current.shonen.isSuccess).toBe(true));
      expect(result.current.all.data?.find((card) => card.id === "nami")?.rarity).toBe("legendaire");
      expect(result.current.shonen.data).toEqual(result.current.all.data?.filter((card) => inPack(card, "shonen")));
      expect(result.current.profile.fetchStatus).toBe("idle");
      expect(result.current.collection.fetchStatus).toBe("idle");
    } finally {
      delete CUSTOM_RARITY["nami"];
      client.clear();
    }
  });

  it("loads account profiles but keeps server-owned copies disabled", async () => {
    const profile = { id: "user-1", username: "test" };
    const copies = [{ id: "copy", card_id: "nami", transcended: false }];
    const eq = vi.fn((column: string, value: string) => {
      expect(column).toBe("user_id");
      expect(value).toBe("user-1");
      return { order: vi.fn().mockResolvedValue({ data: copies, error: null }) };
    });
    const profileEq = vi.fn((column: string, value: string) => {
      expect(column).toBe("id");
      expect(value).toBe("user-1");
      return { maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }) };
    });
    mockFrom.mockImplementation((table: string) => ({
      select: () => ({ eq: table === "profiles" ? profileEq : eq }),
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    try {
      const { result } = renderHook(() => ({
        profile: useProfile("user-1"),
        collection: useUserCards("user-1"),
      }), { wrapper });
      await waitFor(() => expect(result.current.profile.isSuccess).toBe(true));
      expect(result.current.profile.data).toEqual(profile);
      expect(result.current.collection.fetchStatus).toBe("idle");
      expect(result.current.collection.data).toBeUndefined();
      expect(profileEq).toHaveBeenCalledOnce();
      expect(eq).not.toHaveBeenCalled();
    } finally {
      mockFrom.mockReset();
      client.clear();
    }
  });
});
