import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import type { Card, CatalogRarity } from "@/lib/cards";
import { addGuestCollectionCards, getGuestCollection } from "@/lib/guest-collection";
import { MarketSaleDialog } from "./MarketSaleDialog";

const cards: Card[] = (
  ["commune", "non_commune", "rare", "epique", "legendaire", "mythique"] as CatalogRarity[]
).map((rarity) => ({
  id: rarity,
  name: rarity,
  rarity,
  title: "",
  description: "",
  sort_order: 0,
}));

beforeEach(() => localStorage.clear());

it("propose les prix par rareté effective et accepte la suppression du prix immédiat", () => {
  addGuestCollectionCards([
    ...cards.map((card) => ({ userCardId: card.id, card })),
    { userCardId: "transcendance", card: cards[0]!, transcended: true },
  ]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MarketSaleDialog
        cards={cards}
        copies={getGuestCollection()}
        initialKind="auction"
        onClose={vi.fn()}
        onPublished={vi.fn()}
      />
    </QueryClientProvider>,
  );
  const select = screen.getByLabelText("Copie de ta collection");
  expect(screen.getByLabelText("Durée")).toHaveValue("1440");
  expect(screen.getAllByRole("option").filter((option) => option.parentElement === screen.getByLabelText("Durée")).map((option) => option.textContent))
    .toEqual(["1 heure", "6 heures", "12 heures", "24 heures", "48 heures"]);
  const start = screen.getByLabelText("Prix de départ en Zen");
  const buyout = screen.getByLabelText("Prix d'achat immédiat (optionnel, en Zen)");
  for (const [id, price, immediate] of [
    ["commune", 50, 120],
    ["non_commune", 80, 200],
    ["rare", 120, 300],
    ["epique", 300, 750],
    ["legendaire", 700, 1600],
    ["mythique", 1500, 3500],
    ["transcendance", 4000, 9500],
  ] as const) {
    fireEvent.change(select, { target: { value: id } });
    expect(start).toHaveValue(price);
    expect(buyout).toHaveValue(immediate);
  }
  fireEvent.change(buyout, { target: { value: "" } });
  expect(buyout).toHaveValue(null);
});
