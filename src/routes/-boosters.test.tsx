import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoostersPage } from "./index";
import type { Card } from "@/lib/cards";
import { addGuestCollectionCards, getGuestCollection, updateGuestState } from "@/lib/guest-collection";

const mocks = vi.hoisted(() => ({
  error: vi.fn(), rpc: vi.fn(),
  auth: { session: null as { user: { id: string } } | null, ready: true, guest: true },
  profile: null as { boosters_stored: number; stock_updated_at: string } | null,
  draw: vi.fn(),
  from: vi.fn(),
  collection: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mocks.auth,
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
vi.mock("@/lib/guest", () => ({
  createLocalGuestDraw: mocks.draw,
}));
vi.mock("@/lib/game", () => ({
  gameQuery: () => ({ queryKey: ["game"], queryFn: async () => null }),
}));
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards"], queryFn: async () => [] },
  collectionQuery: () => ({ queryKey: ["collection"], queryFn: mocks.collection }),
  profileQuery: () => ({ queryKey: ["profile"], queryFn: async () => mocks.profile }),
  pityQuery: () => ({ queryKey: ["pity"], queryFn: async () => 0 }),
}));

const cards: Card[] = [
  "commune", "non_commune", "rare", "epique", "mythique",
].map((rarity, index) => ({
  id: `card-${index}`, name: `Carte ${index}`, title: "", description: "",
  rarity: rarity as Card["rarity"], sort_order: index, category: "shonen",
}));

function showPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["cards"], cards);
  return render(<QueryClientProvider client={client}><BoostersPage /></QueryClientProvider>);
}

describe("booster hub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.auth.session = null;
    mocks.auth.guest = true;
    mocks.profile = null;
    mocks.collection.mockResolvedValue([]);
    mocks.draw.mockImplementation((catalog: Card[], _pack: string, count: number) =>
      Array.from({ length: count * 5 }, (_, i) => ({ userCardId: `draw-${i}`, card: catalog[i % catalog.length] })),
    );
  });
  it("switches the single inspector between free and Zenkai packs", () => {
    showPage();
    expect(screen.getByRole("heading", { name: "Choisis ton booster" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gratuits" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Gratuit")).toHaveLength(6);
    const inspector = screen.getByRole("complementary", { name: "Détails du booster" });
    expect(within(inspector).getByText("54 %")).toBeTruthy();
    expect(within(inspector).getByText("0,05 %")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Booster Zenkai" })).toBeNull();
    const artwork = screen.getByAltText("Booster Seinen");
    expect(artwork).toHaveClass("h-full", "w-full", "object-cover");
    expect(artwork.parentElement).toHaveClass("aspect-[2/3]");
    expect(artwork.closest('[role="radio"]')?.parentElement).toHaveClass("grid-cols-2", "sm:grid-cols-3");
    fireEvent.click(screen.getByRole("button", { name: "Boosters Zen" }));
    expect(screen.getAllByRole("radio", { name: "Booster Zenkai" })).toHaveLength(1);
    expect(screen.queryByRole("radio", { name: "Seinen" })).toBeNull();
    expect(within(inspector).getByText("2,5 %")).toBeTruthy();
    expect(within(inspector).getByText("0,5 %")).toBeTruthy();
    fireEvent.click(within(inspector).getByRole("radio", { name: "5x" }));
    const purchase = within(inspector).getByRole("button", { name: /Acheter et ouvrir/ });
    expect(purchase.textContent).toMatch(/2[\s\u202f]500 Zen/);
    fireEvent.click(within(inspector).getByRole("radio", { name: "10x" }));
    expect(purchase.textContent).toMatch(/5[\s\u202f]000 Zen/);
    fireEvent.click(purchase);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("prise en charge sécurisée"));
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tous" }));
    expect(screen.getByRole("radio", { name: "Seinen" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Booster Zenkai" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Gratuits" }));
    expect(screen.getByRole("radio", { name: "Shonen Mix" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows the local balance and updates it when guest data changes", () => {
    showPage();
    fireEvent.click(screen.getByRole("button", { name: "Boosters Zen" }));
    expect(screen.getByText("500 Zen disponibles (local)")).toBeTruthy();
    expect(screen.getByText("stock non suivi")).toBeTruthy();
    act(() => updateGuestState((state) => ({ state: { ...state, zen: 1250 }, result: undefined })));
    expect(screen.getByText(/1[\s\u202f]250 Zen disponibles \(local\)/)).toBeTruthy();
    localStorage.setItem("zenkai_guest_collection", JSON.stringify({ rows: [], zen: 0 }));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "zenkai_guest_collection" })));
    expect(screen.getByText("0 Zen disponibles (local)")).toBeTruthy();
  });

  it("reports invalid local storage instead of displaying a fabricated balance", () => {
    localStorage.setItem("zenkai_guest_collection", "{");
    showPage();
    fireEvent.click(screen.getByRole("button", { name: "Boosters Zen" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Solde local indisponible");
  });

  it("shows the real connected stock and remaining regeneration time", async () => {
    mocks.auth.session = { user: { id: "player" } };
    mocks.auth.guest = false;
    mocks.profile = { boosters_stored: 4, stock_updated_at: new Date().toISOString() };
    showPage();
    expect(await screen.findByText("4/15")).toBeTruthy();
    expect(screen.getByText(/Prochain gratuit dans (0[0-9]:[0-5][0-9]|10:00)/)).toBeTruthy();
  });

  it("reveals a simulated guest booster and returns from the rarity-sorted summary", async () => {
    showPage();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir · Gratuit" }));
    const fullSkip = await screen.findByRole("button", { name: "Full Skip" }, { timeout: 5000 });
    fireEvent.click(fullSkip);
    expect(screen.getByRole("heading", { name: "Récapitulatif" })).toBeTruthy();
    for (let index = 4; index > 0; index--) {
      expect(screen.getByText(`Carte ${index}`).compareDocumentPosition(screen.getByText(`Carte ${index - 1}`)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "← Boosters" }));
    expect(screen.getByRole("heading", { name: "Choisis ton booster" })).toBeTruthy();
  });

  it.each([5, 10])("marks only first new guest draws in a %sx batch summary without persisting the simulation", async (count) => {
    addGuestCollectionCards([{ userCardId: "owned", card: cards[0]! }]);
    showPage();
    const inspector = screen.getByRole("complementary", { name: "Détails du booster" });
    fireEvent.click(within(inspector).getByRole("radio", { name: `${count}x` }));
    fireEvent.click(within(inspector).getByRole("button", { name: "Ouvrir · Gratuit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Full Skip" }, { timeout: 5000 }));
    expect(screen.getAllByText("NOUVEAU")).toHaveLength(4);
    expect(screen.getAllByText("Carte 0")).toHaveLength(count);
    for (const element of screen.getAllByText("Carte 0")) {
      expect(within(element.closest(".animate-card-in") as HTMLElement).queryByText("NOUVEAU")).toBeNull();
    }
    expect(getGuestCollection().map((row) => row.id)).toEqual(["owned"]);
    expect(screen.getByText(/Simulation invitée : les cartes révélées ne sont pas sauvegardées/)).toBeTruthy();
  });

  it("does not consume stock when the pre-open collection cannot be read", async () => {
    mocks.auth.session = { user: { id: "player" } };
    mocks.auth.guest = false;
    mocks.collection.mockRejectedValue(new Error("offline"));
    showPage();
    const open = await screen.findByRole("button", { name: /Ouvrir · Gratuit/ });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Collection indisponible : offline"));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("snapshots the server collection before opening and marks only the first new copy", async () => {
    mocks.auth.session = { user: { id: "player" } };
    mocks.auth.guest = false;
    mocks.collection.mockResolvedValue([{ card_id: "card-0" }]);
    const draw = ["card-2", "card-0", "card-2", "card-1", "card-4"].map((card_id, i) => ({
      card_id, user_card_id: `copy-${i}`, boosters_left: 14, stock_updated_at: new Date().toISOString(),
    }));
    mocks.rpc.mockResolvedValue({ data: draw, error: null });
    const inQuery = vi.fn().mockResolvedValue({
      data: draw.map((item) => ({ id: item.user_card_id, transcended: false })), error: null,
    });
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ in: inQuery }) }) });
    showPage();
    const open = await screen.findByRole("button", { name: /Ouvrir · Gratuit/ });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    fireEvent.click(await screen.findByRole("button", { name: "Full Skip" }, { timeout: 5000 }));
    expect(mocks.collection.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]!);
    expect(screen.getAllByText("NOUVEAU")).toHaveLength(3);
    const duplicates = screen.getAllByText("Carte 2");
    expect(duplicates).toHaveLength(2);
    expect(duplicates.filter((element) => within(element.closest(".animate-card-in") as HTMLElement).queryByText("NOUVEAU"))).toHaveLength(1);
    expect(inQuery).toHaveBeenCalledOnce();
  });

  it("reports an RPC failure and allows a signed-in player to retry", async () => {
    mocks.auth.session = { user: { id: "player" } };
    mocks.auth.guest = false;
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    showPage();
    const open = await screen.findByRole("button", { name: /Ouvrir · Gratuit/ });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Impossible d'ouvrir le booster. Réessaie dans un instant."));
    expect(screen.getByRole("button", { name: /Ouvrir · Gratuit/ })).toBeEnabled();
    expect(mocks.rpc).toHaveBeenCalledWith("open_boosters", { _category: "shonen", _count: 1 });
  });
});
