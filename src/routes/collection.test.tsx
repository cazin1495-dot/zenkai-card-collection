import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeCatalogCard, type Card } from "@/lib/cards";
import { CollectionPage } from "./collection";

const cards: Card[] = [
  {
    id: "common",
    name: "Common",
    rarity: "commune",
    title: "",
    description: "",
    sort_order: 0,
    category: "sport",
    popularity: 32000,
  },
  {
    id: "mythic",
    name: "Mythic",
    rarity: "mythique",
    title: "",
    description: "",
    sort_order: 1,
    category: "shonen",
  },
  {
    id: "rare",
    name: "Rare card",
    rarity: "rare",
    title: "",
    description: "",
    sort_order: 2,
    category: "sport",
  },
];
const copies = [
  {
    id: "1",
    card_id: "common",
    obtained_at: "2025-01-03T00:00:00Z",
    transcended: false,
    awaken_attempted: false,
  },
  {
    id: "2",
    card_id: "common",
    obtained_at: "2025-01-02T00:00:00Z",
    transcended: false,
    awaken_attempted: false,
  },
  {
    id: "3",
    card_id: "mythic",
    obtained_at: "2025-01-01T00:00:00Z",
    transcended: true,
    awaken_attempted: false,
  },
];

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: { user: { id: "user" } }, guest: false }),
}));
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards"] },
  collectionQuery: () => ({ queryKey: ["collection"] }),
}));
vi.mock("@/lib/game", () => ({ gameQuery: () => ({ queryKey: ["game"] }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "cards" ? cards : queryKey[0] === "collection" ? copies : undefined,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/components/Transcendance", () => ({
  InspectableCard: ({ card, transcended }: { card: Card; transcended?: boolean }) => (
    <div data-testid="collection-card">
      {card.name}
      {transcended ? " awakened" : ""}
    </div>
  ),
}));

describe("collection filters and sorting", () => {
  afterEach(() => localStorage.removeItem("zenkai:favorite-cards"));

  it("shows favorites and combines the favorites filter with pack and rarity", () => {
    localStorage.setItem("zenkai:favorite-cards", JSON.stringify(["common", "mythic"]));
    render(<CollectionPage />);
    expect(screen.getAllByRole("img", { name: "Carte favorite" })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "★ Favoris uniquement" }));
    expect(screen.getAllByTestId("collection-card").map((element) => element.textContent)).toEqual(["Common", "Mythic awakened"]);
    fireEvent.click(screen.getByRole("button", { name: "Sport" }));
    expect(screen.getAllByTestId("collection-card").map((element) => element.textContent)).toEqual(["Common"]);
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrer par rareté" })).getByRole("button", { name: "Rare 0" }));
    expect(screen.queryAllByTestId("collection-card")).toHaveLength(0);
  });

  it("uses the server rarity for account recycling when display rarity is overridden", () => {
    cards.push(normalizeCatalogCard({
      id: "nami", name: "Nami", rarity: "rare", title: "", description: "", sort_order: 3,
      popularity: 100,
    }));
    copies.push(
      { id: "nami-1", card_id: "nami", obtained_at: "2025-01-01", transcended: false, awaken_attempted: false },
      { id: "nami-2", card_id: "nami", obtained_at: "2025-01-02", transcended: false, awaken_attempted: false },
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      render(<CollectionPage />);
      fireEvent.click(screen.getByRole("button", { name: /Recycler · \+50 Coins/ }));
      expect(confirm).toHaveBeenCalledWith("Recycler un doublon de Nami pour 50 Coins ?");
    } finally {
      cards.pop();
      copies.splice(-2);
      confirm.mockRestore();
    }
  });
  it("sorts globally and combines rarity and pack filters with owned-form counts", () => {
    render(<CollectionPage />);
    const names = () =>
      screen.queryAllByTestId("collection-card").map((element) => element.textContent);
    const rarityFilters = within(screen.getByRole("group", { name: "Filtrer par rareté" }));
    expect(rarityFilters.getByRole("button", { name: "Toutes 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(rarityFilters.getByRole("button", { name: "Transcendance 1" })).toBeTruthy();
    expect(rarityFilters.getByRole("button", { name: "Mythique 0" })).toBeTruthy();
    expect(names()).toEqual(["Common", "Mythic awakened", "Rare card"]);
    fireEvent.change(screen.getByLabelText("Trier la collection"), { target: { value: "rarest" } });
    expect(names()).toEqual(["Mythic awakened", "Rare card", "Common"]);
    fireEvent.click(rarityFilters.getByRole("button", { name: "Transcendance 1" }));
    expect(names()).toEqual(["Mythic awakened"]);
    fireEvent.click(screen.getByRole("button", { name: "Sport" }));
    expect(names()).toEqual([]);
    expect(rarityFilters.getByRole("button", { name: "Transcendance 0" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(rarityFilters.getByRole("button", { name: "Toutes 1" }));
    expect(names()).toEqual(["Rare card", "Common"]);
  });

  it("keeps the Shonen collection filter restricted to the genre", () => {
    render(<CollectionPage />);
    fireEvent.click(screen.getByRole("button", { name: "Shonen" }));
    expect(screen.getAllByTestId("collection-card").map((element) => element.textContent)).toEqual(["Mythic awakened"]);
  });

  it("shows popularity and local estimates, and orders the catalogue by value", () => {
    render(<CollectionPage />);
    const common = screen.getByText("Common").parentElement!.parentElement!;
    expect(within(common).getByText("Populaire 🔥")).toBeTruthy();
    expect(within(common).getByText("Valeur locale : 15 Zen")).toBeTruthy();
    expect(within(common).getByText("Recyclage local : 6 Zen")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Trier la collection"), { target: { value: "value" } });
    expect(screen.getAllByTestId("collection-card").map((element) => element.textContent)).toEqual([
      "Mythic awakened", "Rare card", "Common",
    ]);
    expect(screen.getByText("Recyclage local : 0 Zen · non recyclable")).toBeTruthy();
  });
});
