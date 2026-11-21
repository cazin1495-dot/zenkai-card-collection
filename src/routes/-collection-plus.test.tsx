import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionPage } from "./collection";
import { addGuestCollectionCards, getGuestBalance, getGuestCollection } from "@/lib/guest-collection";
import { setPlus } from "@/lib/subscription";
import type { Card } from "@/lib/cards";

const card: Card = { id: "card", name: "Carte", title: "", description: "", rarity: "rare", sort_order: 0, popularity: 40000 };
const common: Card = { ...card, id: "common", name: "Commune test", rarity: "commune", popularity: 32000 };
const legendary: Card = { ...card, id: "legendary", name: "Légendaire test", rarity: "legendaire", popularity: 0 };
const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  session: null as { user: { id: string } } | null,
  guest: true,
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: mocks.session, guest: mocks.guest }) }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards"], queryFn: async () => [card, common, legendary] },
  collectionQuery: () => ({ queryKey: ["collection"], queryFn: async () => [] }),
}));
vi.mock("@/components/Transcendance", () => ({
  InspectableCard: ({ card }: { card: Card }) => <div>{card.name}</div>,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

describe("guest Zenkai+ recycling", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.session = null;
    mocks.guest = true;
  });

  it("selects safe rarities by default, totals VIP gains per rarity and preserves oldest and awakened copies", async () => {
    setPlus(null, true, { active: true });
    addGuestCollectionCards([
      { userCardId: "c1", card: common }, { userCardId: "c2", card: common },
      { userCardId: "r1", card }, { userCardId: "r2", card },
      { userCardId: "l1", card: legendary }, { userCardId: "l2", card: legendary },
      { userCardId: "evolved", card, transcended: true },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CollectionPage /></QueryClientProvider>);
    const button = await screen.findByRole("button", { name: "Recycler" });
    await waitFor(() => expect(button).toHaveTextContent("3"));
    fireEvent.click(button);
    const dialog = screen.getByRole("dialog", { name: "Recycler les doublons" });
    expect(within(dialog).getByText("+20 % Bonus Zenkai+")).toBeTruthy();
    const commonTile = within(dialog).getByRole("button", { name: /Commune ×1/ });
    const rareTile = within(dialog).getByRole("button", { name: /Rare ×1/ });
    const legendaryTile = within(dialog).getByRole("button", { name: /Légendaire ×1/ });
    expect(commonTile).toHaveAttribute("aria-pressed", "true");
    expect(rareTile).toHaveAttribute("aria-pressed", "true");
    expect(commonTile).toHaveTextContent("+8 Zen");
    expect(rareTile).toHaveTextContent("+44 Zen");
    expect(legendaryTile).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByRole("button", { name: /Mythique aucun/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Recycler 2 doublons · +52 Zen" })).toBeEnabled();
    fireEvent.click(rareTile);
    expect(within(dialog).getByRole("button", { name: "Recycler 1 doublons · +8 Zen" })).toBeEnabled();
    fireEvent.click(legendaryTile);
    fireEvent.click(within(dialog).getByRole("button", { name: "Recycler 2 doublons · +200 Zen" }));
    await waitFor(() => expect(getGuestBalance()).toBe(1000));
    expect(getGuestCollection().map((row) => row.id)).toEqual(["c1", "r1", "r2", "l1", "evolved"]);
    expect(mocks.success).toHaveBeenCalledWith("2 doublons recyclés ! +200 Zen ajoutés");
    await waitFor(() => expect(button).toHaveTextContent("1"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps copies and the dialog when storage writes fail", async () => {
    addGuestCollectionCards([{ userCardId: "first", card }, { userCardId: "second", card }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CollectionPage /></QueryClientProvider>);
    const open = await screen.findByRole("button", { name: "Recycler" });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    const dialog = screen.getByRole("dialog", { name: "Recycler les doublons" });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage full"); });
    fireEvent.click(within(dialog).getByRole("button", { name: "Recycler 1 doublons · +36 Zen" }));
    expect(getGuestCollection().map((row) => row.id)).toEqual(["first", "second"]);
    expect(getGuestBalance()).toBe(500);
    expect(mocks.error).toHaveBeenCalledWith("Recyclage impossible : storage full");
    expect(screen.getByRole("dialog", { name: "Recycler les doublons" })).toBeTruthy();
  });

  it("uses the connected player's local VIP status for the separate local collection", async () => {
    mocks.session = { user: { id: "alice" } };
    mocks.guest = false;
    setPlus("alice", false, { active: true });
    addGuestCollectionCards([{ userCardId: "first", card }, { userCardId: "second", card }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CollectionPage /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Voir ma collection locale" }));
    const open = screen.getByRole("button", { name: "Recycler" });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    const dialog = screen.getByRole("dialog", { name: "Recycler les doublons" });
    expect(within(dialog).getByText("+20 % Bonus Zenkai+")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Recycler 1 doublons · +44 Zen" }));
    expect(getGuestBalance()).toBe(544);
    expect(getGuestCollection().map((row) => row.id)).toEqual(["first"]);
  });

  it("caps the toolbar badge at 99+ but uses the exact duplicate count in the dialog", async () => {
    addGuestCollectionCards(Array.from({ length: 102 }, (_, index) => ({ userCardId: `copy-${index}`, card })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CollectionPage /></QueryClientProvider>);
    const open = screen.getByRole("button", { name: "Recycler" });
    await waitFor(() => expect(open).toHaveTextContent("99+"));
    fireEvent.click(open);
    expect(screen.getByRole("button", { name: "Recycler 101 doublons · +3 636 Zen" })).toBeEnabled();
  });

  it("shows empty rarity choices without permitting an empty transaction", async () => {
    addGuestCollectionCards([{ userCardId: "first", card }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CollectionPage /></QueryClientProvider>);
    const open = screen.getByRole("button", { name: "Recycler" });
    await waitFor(() => expect(open).toBeEnabled());
    expect(open).toHaveTextContent("0");
    fireEvent.click(open);
    const dialog = screen.getByRole("dialog", { name: "Recycler les doublons" });
    expect(within(dialog).getByRole("button", { name: /Rare aucun/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Recycler 0 doublons · +0 Zen" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reports missing metadata instead of presenting an incomplete duplicate count", async () => {
    const unknown = { ...card, id: "unknown" };
    addGuestCollectionCards([{ userCardId: "one", card: unknown }, { userCardId: "two", card: unknown }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CollectionPage /></QueryClientProvider>);
    expect(await screen.findByText(/Certaines cartes locales sont absentes du catalogue/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recycler" })).toBeDisabled();
  });

  it("recycles a duplicate for the VIP value without removing the last copy", async () => {
    setPlus(null, true, { active: true });
    addGuestCollectionCards([{ userCardId: "first", card }, { userCardId: "second", card }]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CollectionPage /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", { name: /Recycler · \+44 Zen locaux/ }));
    await waitFor(() => expect(getGuestBalance()).toBe(844));
    expect(getGuestCollection().map((row) => row.id)).toEqual(["first"]);
    await waitFor(() => expect(screen.queryByRole("button", { name: /Recycler ·/ })).toBeNull());
  });
});
