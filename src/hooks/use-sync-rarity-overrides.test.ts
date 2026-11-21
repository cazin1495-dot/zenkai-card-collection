import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setUserRarityOverride, type Card } from "@/lib/cards";
import { cardsQuery, useCards, useCardsByPack } from "@/lib/queries";
import { useSyncRarityOverrides } from "./use-sync-rarity-overrides";

vi.mock("@/lib/cards.functions", () => ({ getCards: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("catalog rarity synchronization", () => {
  afterEach(() => localStorage.removeItem("zenkai_admin_rarity_overrides"));

  it("updates cached hooks on changes and restores the original rarity across tabs", async () => {
    const client = new QueryClient();
    const card: Card = { id: "card", name: "Test", title: "", description: "", rarity: "rare", sort_order: 0 };
    client.setQueryData(cardsQuery.queryKey, [card]);
    localStorage.setItem("zenkai_admin_rarity_overrides", '{"card":"epique"}');
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => {
      useSyncRarityOverrides(client);
      return { all: useCards(), pack: useCardsByPack("shonen") };
    }, { wrapper });
    await waitFor(() => expect(result.current.all.data?.[0]?.rarity).toBe("epique"));
    act(() => setUserRarityOverride("card", "mythique"));
    await waitFor(() => expect(result.current.all.data?.[0]).toMatchObject({ rarity: "mythique", serverRarity: "rare" }));
    expect(result.current.pack.data?.[0]?.rarity).toBe("mythique");
    act(() => {
      localStorage.removeItem("zenkai_admin_rarity_overrides");
      window.dispatchEvent(new StorageEvent("storage", { key: "zenkai_admin_rarity_overrides" }));
    });
    await waitFor(() => expect(result.current.all.data?.[0]?.rarity).toBe("rare"));
    client.clear();
  });
});
