import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyRemoteRarityOverrides, type Card } from "@/lib/cards";
import { cardsQuery, useCards, useCardsByPack } from "@/lib/queries";
import { useSyncRarityOverrides } from "./use-sync-rarity-overrides";

vi.mock("@/lib/cards.functions", () => ({ getCards: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const fetchOverrides = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rarity-overrides", () => ({ fetchRarityOverrides: fetchOverrides }));

describe("catalog rarity synchronization", () => {
  afterEach(() => applyRemoteRarityOverrides({}));

  it("updates cached hooks on remote changes and restores the original rarity on deletion", async () => {
    fetchOverrides.mockImplementation(() => new Promise(() => {}));
    const client = new QueryClient();
    const card: Card = { id: "card", name: "Test", title: "", description: "", rarity: "rare", sort_order: 0 };
    client.setQueryData(cardsQuery.queryKey, [card]);
    applyRemoteRarityOverrides({ card: "epique" });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => {
      useSyncRarityOverrides(client);
      return { all: useCards(), pack: useCardsByPack("shonen") };
    }, { wrapper });
    await waitFor(() => expect(result.current.all.data?.[0]?.rarity).toBe("epique"));
    act(() => applyRemoteRarityOverrides({ card: "mythique" }));
    await waitFor(() => expect(result.current.all.data?.[0]).toMatchObject({ rarity: "mythique", serverRarity: "rare" }));
    expect(result.current.pack.data?.[0]?.rarity).toBe("mythique");
    act(() => applyRemoteRarityOverrides({}));
    await waitFor(() => expect(result.current.all.data?.[0]?.rarity).toBe("rare"));
    client.clear();
  });

  it("refreshes the shared catalogue from the server and removes deleted overrides", async () => {
    fetchOverrides.mockResolvedValueOnce({ "hsr-1": "rare" }).mockResolvedValueOnce({});
    const client = new QueryClient();
    const card: Card = { id: "hsr-1", name: "Firefly", title: "", description: "", rarity: "mythique", sort_order: 0 };
    client.setQueryData(cardsQuery.queryKey, [card]);
    const { unmount } = renderHook(() => useSyncRarityOverrides(client));
    await waitFor(() => expect(client.getQueryData<Card[]>(cardsQuery.queryKey)?.[0]?.rarity).toBe("rare"));
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(client.getQueryData<Card[]>(cardsQuery.queryKey)?.[0]?.rarity).toBe("legendaire"));
    unmount();
    client.clear();
  });

  it("does not let an older read overwrite a just-confirmed edit", async () => {
    let resolve!: (value: Record<string, "rare">) => void;
    fetchOverrides.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const client = new QueryClient();
    const { unmount } = renderHook(() => useSyncRarityOverrides(client));
    act(() => applyRemoteRarityOverrides({ "hsr-1": "epique" }));
    await act(async () => resolve({ "hsr-1": "rare" }));
    expect(client.getQueryData(cardsQuery.queryKey)).toBeUndefined();
    expect((await import("@/lib/cards")).getUserRarityOverrides()).toEqual({ "hsr-1": "epique" });
    unmount();
    client.clear();
  });
});
