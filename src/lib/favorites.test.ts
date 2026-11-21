import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFavoriteCards } from "./favorites";

describe("favorite cards", () => {
  afterEach(() => localStorage.removeItem("zenkai:favorite-cards"));

  it("synchronizes hooks, persists across remounts, and responds to other tabs", () => {
    const first = renderHook(() => useFavoriteCards());
    const second = renderHook(() => useFavoriteCards());
    act(() => { first.result.current.toggleFavorite("card-1"); });
    expect(second.result.current.favoriteCardIds).toEqual(["card-1"]);
    first.unmount();
    const remounted = renderHook(() => useFavoriteCards());
    expect(remounted.result.current.favoriteCardIds).toEqual(["card-1"]);
    act(() => {
      localStorage.setItem("zenkai:favorite-cards", JSON.stringify(["card-2"]));
      window.dispatchEvent(new StorageEvent("storage", { key: "zenkai:favorite-cards" }));
    });
    expect(second.result.current.favoriteCardIds).toEqual(["card-2"]);
    expect(remounted.result.current.favoriteCardIds).toEqual(["card-2"]);
    act(() => { second.result.current.toggleFavorite("card-2"); });
    expect(remounted.result.current.favoriteCardIds).toEqual([]);
  });
});
