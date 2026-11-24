import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchRarityOverrides, saveRarityOverride } from "./rarity-overrides";

const mocks = vi.hoisted(() => ({ select: vi.fn(), order: vi.fn(), range: vi.fn(), upsert: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

describe("global rarity persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select, upsert: mocks.upsert });
    mocks.select.mockReturnValue({ order: mocks.order });
    mocks.order.mockReturnValue({ range: mocks.range });
  });

  it("loads and validates the public rows", async () => {
    mocks.range.mockResolvedValueOnce({ data: [{ card_key: "hsr-1", rarity: "rare" }], error: null });
    expect(await fetchRarityOverrides()).toEqual({ "hsr-1": "rare" });
    mocks.range.mockResolvedValueOnce({ data: [{ card_key: "hsr-1", rarity: "transcendance" }], error: null });
    await expect(fetchRarityOverrides()).rejects.toThrow("Rareté globale invalide");
  });

  it("reports database failures on reads and writes", async () => {
    mocks.range.mockResolvedValueOnce({ data: null, error: { message: "table absente" } });
    await expect(fetchRarityOverrides()).rejects.toThrow("table absente");
    mocks.upsert.mockResolvedValueOnce({ error: { message: "non autorisé" } });
    await expect(saveRarityOverride("hsr-1", "rare")).rejects.toThrow("non autorisé");
  });

  it("loads every page of global overrides", async () => {
    mocks.range.mockResolvedValueOnce({
      data: Array.from({ length: 1000 }, (_, index) => ({ card_key: `card-${index}`, rarity: "rare" })),
      error: null,
    }).mockResolvedValueOnce({ data: [{ card_key: "last", rarity: "epique" }], error: null });
    const result = await fetchRarityOverrides();
    expect(Object.keys(result)).toHaveLength(1001);
    expect(result["last"]).toBe("epique");
    expect(mocks.range).toHaveBeenLastCalledWith(1000, 1999);
  });
});
