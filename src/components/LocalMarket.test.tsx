import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "@/lib/cards";
import {
  addGuestCollectionCards,
  getGuestBalance,
  getGuestCollection,
} from "@/lib/guest-collection";
import { LocalMarket } from "./LocalMarket";

const cards: Card[] = [
  { id: "c", name: "Alpha", title: "", description: "", rarity: "commune", sort_order: 0 },
  { id: "r", name: "Beta", title: "", description: "", rarity: "rare", sort_order: 1 },
];
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards-market-test"], queryFn: async () => cards },
}));

describe("guest market interface", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("buys from a fictitious merchant and lists and cancels a specific copy", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LocalMarket />
      </QueryClientProvider>,
    );
    const offer = (await screen.findByText("Alpha")).closest("article")!;
    fireEvent.click(within(offer).getByRole("button", { name: "Acheter" }));
    await waitFor(() => expect(getGuestBalance()).toBe(490));
    const copy = getGuestCollection()[0]!;
    addGuestCollectionCards([{ userCardId: "another", card: cards[0]! }]);
    fireEvent.click(screen.getByRole("button", { name: "Mettre une carte en vente" }));
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByRole("option", { name: /Alpha.*another/ })).toBeTruthy(),
    );
    fireEvent.change(within(dialog).getByLabelText("Copie de ta collection"), {
      target: { value: "another" },
    });
    fireEvent.change(within(dialog).getByLabelText("Prix en Zen"), { target: { value: "80" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publier l’annonce fictive" }));
    await waitFor(() => expect(getGuestCollection().map((row) => row.id)).toEqual([copy.id]));
    const ownOffer = screen.getByText("Toi").closest("article")!;
    fireEvent.click(within(ownOffer).getByRole("button", { name: "Annuler l'annonce" }));
    expect(getGuestCollection().map((row) => row.id)).toContain("another");
  });

  it("places a bid using the displayed minimum and reserves the Zen", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LocalMarket />
      </QueryClientProvider>,
    );
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Enchères en cours" }));
    const auction = screen.getByText("Beta").closest("article")!;
    expect(within(auction).getByText("Départ : 60 Zen")).toBeTruthy();
    fireEvent.click(within(auction).getByRole("button", { name: "Enchérir (+10 Zen)" }));
    await waitFor(() => expect(getGuestBalance()).toBe(440));
    expect(within(auction).getByText("Enchère : 60 Zen · Toi")).toBeTruthy();
  });

  it("uses the custom amount independently of the quick bid", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><LocalMarket /></QueryClientProvider>);
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Enchères en cours" }));
    const auction = screen.getByText("Beta").closest("article")!;
    fireEvent.change(within(auction).getByLabelText("Enchère personnalisée pour Beta"), {
      target: { value: "100" },
    });

    fireEvent.click(within(auction).getByRole("button", { name: "Enchérir ce montant" }));
    expect(getGuestBalance()).toBe(400);
    fireEvent.click(within(auction).getByRole("button", { name: "Enchérir (+10 Zen)" }));
    expect(getGuestBalance()).toBe(390);
    expect(within(auction).getByText("Enchère : 110 Zen · Toi")).toBeTruthy();
  });

  it("shows a popularity badge and reference value alongside the offer price", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(["cards-market-test"], [{ ...cards[0]!, popularity: 32000 }, cards[1]!]);
    render(<QueryClientProvider client={client}><LocalMarket /></QueryClientProvider>);
    const offer = (await screen.findByText("Alpha")).closest("article")!;
    expect(within(offer).getByText("Populaire 🔥")).toBeTruthy();
    expect(within(offer).getByText("Valeur estimée : 15 Zen")).toBeTruthy();
    expect(within(offer).getByText("15 Zen")).toBeTruthy();
  });

  it("opens the auction tab when arriving from an auction publication", async () => {
    window.history.replaceState(null, "", "/boutique#encheres");
    try {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={client}>
          <LocalMarket />
        </QueryClientProvider>,
      );
      expect(await screen.findByText("Beta")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Enchères en cours" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});
