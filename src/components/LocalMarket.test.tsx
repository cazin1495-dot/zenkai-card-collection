import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "@/lib/cards";
import {
  addGuestCollectionCards,
  getGuestBalance,
  getGuestCollection,
  updateGuestState,
} from "@/lib/guest-collection";
import { LocalMarket } from "./LocalMarket";
import { getGuestMarket, initializeGuestMarket, listGuestCopy, settleGuestMarket } from "@/lib/guest-market";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "@/lib/transcendance-cards";
import { seedLegacyAuction } from "@/test/legacy-market";

const cards: Card[] = [
  { id: "c", name: "Alpha", title: "", description: "", rarity: "commune", sort_order: 0 },
  { id: "r", name: "Beta", title: "", description: "", rarity: "rare", sort_order: 1 },
];
let catalogFails = false;
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards-market-test"], queryFn: async () => {
    if (catalogFails) throw new Error("offline");
    return cards;
  } },
}));

describe("guest market interface", () => {
  beforeEach(() => {
    localStorage.clear();
    catalogFails = false;
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
    initializeGuestMarket(cards);
    seedLegacyAuction("r", Date.now());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LocalMarket />
      </QueryClientProvider>,
    );
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Enchères" }));
    const auction = screen.getAllByText("Beta")[0]!.closest("article")!;
    expect(within(auction).getByText("Départ : 60 Zen")).toBeTruthy();
    fireEvent.click(within(auction).getByRole("button", { name: "Enchérir (+50 Zen / +10 %)" }));
    await waitFor(() => expect(getGuestBalance()).toBe(440));
    expect(within(auction).getByText("Enchère actuelle : 60 Zen")).toBeTruthy();
    expect(within(auction).getByText("Toi")).toBeTruthy();
  });

  it("uses the custom amount independently of the quick bid", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    initializeGuestMarket(cards);
    seedLegacyAuction("r", Date.now());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><LocalMarket /></QueryClientProvider>);
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Enchères" }));
    const auction = screen.getAllByText("Beta")[0]!.closest("article")!;
    fireEvent.change(within(auction).getByLabelText("Enchère personnalisée pour Beta"), {
      target: { value: "100" },
    });

    fireEvent.click(within(auction).getByRole("button", { name: "Enchérir ce montant" }));
    expect(getGuestBalance()).toBe(400);
    fireEvent.click(within(auction).getByRole("button", { name: "Enchérir (+50 Zen / +10 %)" }));
    expect(getGuestBalance()).toBe(350);
    expect(within(auction).getByText("Enchère actuelle : 150 Zen")).toBeTruthy();
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

  it("uses the current catalogue rarity rather than a stored listing rarity", async () => {
    initializeGuestMarket(cards);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(["cards-market-test"], [{ ...cards[0]!, rarity: "legendaire" }, cards[1]!]);
    render(<QueryClientProvider client={client}><LocalMarket /></QueryClientProvider>);
    const offer = (await screen.findByText("Alpha")).closest("article")!;
    expect(offer).toHaveTextContent("Légendaire");
    expect(within(offer).getByText("10 Zen")).toBeTruthy();
  });

  it("renders exclusive and evolved Transcendance listings with their correct art", async () => {
    const gon = CUSTOM_TRANSCENDANCE_CARDS.find((entry) => entry.id === "trans-gon");
    if (!gon) throw new Error("Gon Transcendance absent.");
    const exclusive = customTranscendanceAsCard(gon);
    const base = { ...cards[0]!, id: "al-30", name: "Gon Freecss", image_url: "/gon-base.jpg" };
    initializeGuestMarket(cards);
    addGuestCollectionCards([
      { userCardId: "exclusive", card: exclusive, customTranscendance: true },
      { userCardId: "evolved", card: base, transcended: true },
    ]);
    listGuestCopy("exclusive", exclusive, "fixed", 100, 2);
    listGuestCopy("evolved", base, "fixed", 100, 2);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(["cards-market-test"], [...cards, base]);
    const { container } = render(<QueryClientProvider client={client}><LocalMarket /></QueryClientProvider>);
    await waitFor(() => expect(container.querySelectorAll(".zenkai-transcendance-card")).toHaveLength(2));
    for (const face of container.querySelectorAll(".zenkai-transcendance-card")) {
      expect(face.querySelector("img")).toHaveAttribute("src", "/gon%20adulte.webp");
      expect(face).toHaveTextContent("Transcendance");
      expect(face.querySelector(".premium-energy-frame")).toBeTruthy();
      expect(face.querySelector(".zenkai-transcendance-holo")).toBeNull();
      expect(face.querySelectorAll(".transcendance-sparkles-overlay")).toHaveLength(1);
      expect(face.querySelector(".relic-seal")).toBeTruthy();
    }
    expect(screen.getByText("Alpha").closest("article")?.querySelector(".zenkai-transcendance-card")).toBeNull();
  });

  it("opens the auction tab when arriving from an auction publication", async () => {
    window.history.replaceState(null, "", "/boutique#encheres");
    try {
      initializeGuestMarket(cards);
      seedLegacyAuction("r", Date.now());
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={client}>
          <LocalMarket />
        </QueryClientProvider>,
      );
      expect((await screen.findAllByText("Beta")).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Enchères" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("crée une enchère de six heures et paie la vente à l'échéance", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><LocalMarket /></QueryClientProvider>);
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Enchères" }));
    fireEvent.click(screen.getByRole("button", { name: "Créer une enchère" }));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("option", { name: /Alpha.*copy/ })).toBeTruthy());
    fireEvent.change(within(dialog).getByLabelText("Copie de ta collection"), { target: { value: "copy" } });
    fireEvent.change(within(dialog).getByLabelText("Prix de départ en Zen"), { target: { value: "90" } });
    fireEvent.change(within(dialog).getByLabelText("Prix d'achat immédiat (optionnel, en Zen)"), { target: { value: "" } });
    fireEvent.change(within(dialog).getByLabelText("Durée"), { target: { value: "360" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publier l’annonce fictive" }));
    const listing = getGuestMarket().listings.find((item) => item.seller === "guest")!;
    expect(listing.endAt! - listing.npcAt!).toBe(6 * 3_600_000 - 30_000);
    expect(getGuestCollection()).toEqual([]);
    settleGuestMarket(listing.endAt!);
    expect(getGuestBalance()).toBe(590);
  });

  it("affiche et réalise l'achat immédiat d'une enchère fictive", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    initializeGuestMarket(cards);
    seedLegacyAuction("r", Date.now());
    const listing = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    const listings = getGuestMarket().listings.map((item) => item.id === listing.id ? { ...item, buyoutPrice: 200 } : item);
    updateGuestState((state) => ({ state: { ...state, market: { listings } }, result: undefined }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><LocalMarket /></QueryClientProvider>);
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Enchères" }));
    const auction = screen.getAllByText("Beta")[0]!.closest("article")!;
    expect(within(auction).getByRole("button", { name: "Enchérir (+50 Zen / +10 %)" })).toBeEnabled();
    fireEvent.click(within(auction).getByRole("button", { name: "Achat immédiat · 200 Zen" }));
    expect(getGuestBalance()).toBe(300);
    expect(getGuestCollection().map((row) => row.card_id)).toEqual(["r"]);
    await waitFor(() => expect(getGuestMarket().listings.filter((item) => item.kind === "auction" && item.seller === "npc")).toHaveLength(6));
    expect(getGuestMarket().listings.some((item) => item.id === listing.id)).toBe(false);
  });

  it("affiche les durées longues sans couleur d'urgence, puis met en évidence la dernière heure", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    initializeGuestMarket(cards, now);
    seedLegacyAuction("r", now);
    const listing = getGuestMarket().listings.find((item) => item.kind === "auction")!;
    const updateEnd = (endAt: number) => {
      const listings = getGuestMarket().listings.map((item) => item.id === listing.id ? { ...item, endAt } : item);
      updateGuestState((state) => ({ state: { ...state, market: { listings } }, result: undefined }));
    };
    updateEnd(now + 38 * 3_600_000);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><LocalMarket /></QueryClientProvider>);
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Enchères" }));
    const auction = screen.getAllByText("Beta")[0]!.closest("article")!;
    expect(within(auction).getByText("1j 14h")).not.toHaveClass("text-amber-400");
    act(() => updateEnd(now + 5 * 3_600_000 + 42 * 60_000));
    expect(within(auction).getByText("5h 42m")).not.toHaveClass("text-amber-400");
    act(() => updateEnd(now + 59 * 60_000 + 59_000));
    expect(within(auction).getByText("59:59")).toHaveClass("text-amber-400");
  });

  it("initialise les enchères avec les cartes intégrées si le catalogue distant échoue", async () => {
    catalogFails = true;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><LocalMarket /></QueryClientProvider>);
    expect(await screen.findByText(/Catalogue distant indisponible/)).toBeTruthy();
    await waitFor(() => expect(getGuestMarket().listings.filter((item) => item.kind === "auction" && item.seller === "npc")).toHaveLength(6));
  });
});
