import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  addGuestCollectionCards,
  getGuestBalance,
  getGuestCollection,
} from "@/lib/guest-collection";
import {
  bidOnGuestListing,
  getGuestMarket,
  initializeGuestMarket,
  listGuestCopy,
} from "@/lib/guest-market";
import type { Card } from "@/lib/cards";
import { AuctionEffects } from "./AuctionEffects";
import { toast } from "sonner";
import { seedLegacyAuction } from "@/test/legacy-market";

const cards: Card[] = [
  { id: "c", name: "Alpha", title: "", description: "", rarity: "commune", sort_order: 0 },
  { id: "r", name: "Beta", title: "", description: "", rarity: "rare", sort_order: 1 },
];
vi.mock("@/lib/queries", () => ({
  cardsQuery: {
    queryKey: ["auction-effects-cards"],
    queryFn: async () => cards,
    staleTime: Infinity,
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.9);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("règle les enchères sur tout le site et remplit la salle après échéance", () => {
  const now = Date.now();
  initializeGuestMarket(cards, now);
  seedLegacyAuction("r", now);
  const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
  bidOnGuestListing(auction.id, 100, now);
  addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
  listGuestCopy("copy", cards[0]!, "auction", 80, 60, now);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["auction-effects-cards"], cards);
  render(
    <QueryClientProvider client={client}>
      <AuctionEffects />
    </QueryClientProvider>,
  );
  act(() => {
    vi.setSystemTime(now + 3_600_000);
    window.dispatchEvent(new Event("focus"));
  });
  expect(getGuestBalance()).toBe(480);
  expect(getGuestCollection().map((row) => row.card_id)).toEqual(["r"]);
  expect(toast.success).toHaveBeenCalledWith("Enchère remportée : Beta ajoutée à ta collection.");
  expect(
    getGuestMarket().listings.filter((item) => item.kind === "auction" && item.seller === "npc"),
  ).toHaveLength(6);
  expect(toast.error).not.toHaveBeenCalled();
});

it("rattrape les échéances au retour sur le site sans doubler les crédits", () => {
  const now = Date.now();
  initializeGuestMarket(cards, now);
  seedLegacyAuction("r", now);
  const auction = getGuestMarket().listings.find((item) => item.kind === "auction")!;
  bidOnGuestListing(auction.id, 100, now);
  vi.setSystemTime(auction.endAt! + 30_000);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["auction-effects-cards"], cards);
  render(
    <QueryClientProvider client={client}>
      <AuctionEffects />
    </QueryClientProvider>,
  );
  act(() => vi.advanceTimersByTime(2000));
  expect(getGuestCollection().map((row) => row.card_id)).toEqual(["r"]);
  expect(getGuestBalance()).toBe(400);
  expect(toast.success).toHaveBeenCalledTimes(1);
});

it("rattrape l'achat immédiat virtuel d'une enchère longue après une absence", () => {
  vi.mocked(Math.random).mockReturnValue(0.1);
  const now = Date.now();
  initializeGuestMarket(cards, now);
  addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
  listGuestCopy("copy", cards[0]!, "auction", 50, 1440, now, 120);
  vi.setSystemTime(now + 2 * 24 * 3_600_000);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["auction-effects-cards"], cards);
  render(
    <QueryClientProvider client={client}>
      <AuctionEffects />
    </QueryClientProvider>,
  );
  expect(getGuestBalance()).toBe(620);
  expect(getGuestCollection()).toHaveLength(0);
  expect(toast.success).toHaveBeenCalledWith(
    "Vente immédiate réalisée : Alpha vendue pour 120 Zen !",
  );
  act(() => vi.advanceTimersByTime(2000));
  expect(getGuestBalance()).toBe(620);
});
