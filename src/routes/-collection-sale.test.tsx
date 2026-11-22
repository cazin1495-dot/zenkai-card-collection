import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "@/lib/cards";
import { addGuestCollectionCards, getGuestCollection } from "@/lib/guest-collection";
import { getGuestMarket } from "@/lib/guest-market";
import { CollectionPage } from "./collection";

const cards: Card[] = [
  { id: "c", name: "Alpha", title: "", description: "", rarity: "commune", sort_order: 0 },
];
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
vi.mock("@/hooks/use-zenkai-plus", () => ({
  useZenkaiPlus: () => ({ state: { active: false }, error: false }),
}));
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards-sale-test"], queryFn: async () => cards },
  collectionQuery: () => ({
    queryKey: ["collection"],
    queryFn: async () => [{ id: "server-copy", card_id: "c", transcended: false, awaken_attempted: false }],
  }),
}));
vi.mock("@/lib/game", () => ({
  gameQuery: () => ({ queryKey: ["game"], queryFn: async () => null }),
}));
vi.mock("@/components/Transcendance", () => ({
  InspectableCard: ({ card }: { card: Card }) => <div>{card.name}</div>,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

describe("selling from collection", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.session = null;
    mocks.guest = true;
  });

  it("preselects the newest duplicate, creates an auction and warns before selling the last copy", async () => {
    addGuestCollectionCards([
      { userCardId: "older", card: cards[0]! },
      { userCardId: "newer", card: cards[0]! },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <CollectionPage />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Vendre Alpha" }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Copie de ta collection")).toHaveValue("newer");
    expect(within(dialog).getByLabelText("Prix en Zen")).toHaveValue(10);
    expect(within(dialog).queryByText(/Dernier exemplaire/)).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Mode de vente"), {
      target: { value: "auction" },
    });
    expect(within(dialog).getByLabelText("Prix de départ en Zen")).toHaveValue(50);
    expect(within(dialog).getByLabelText("Prix d'achat immédiat (optionnel, en Zen)")).toHaveValue(120);
    fireEvent.change(within(dialog).getByLabelText("Prix d'achat immédiat (optionnel, en Zen)"), {
      target: { value: "333" },
    });
    expect(within(dialog).getByLabelText("Durée")).toHaveValue("1440");
    fireEvent.change(within(dialog).getByLabelText("Durée"), { target: { value: "720" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publier l’annonce fictive" }));
    await waitFor(() => expect(getGuestCollection().map((row) => row.id)).toEqual(["older"]));
    const listing = getGuestMarket().listings.find((item) => item.seller === "guest")!;
    expect(listing.kind).toBe("auction");
    expect(listing.copy?.id).toBe("newer");
    expect(listing.buyoutPrice).toBe(333);
    expect(listing.endAt! - listing.npcAt!).toBe(12 * 3_600_000 - 30_000);
    expect(mocks.success.mock.calls[0]?.[1].description.props.hash).toBe("encheres");

    await waitFor(() => expect(screen.getByRole("button", { name: "Vendre Alpha" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Vendre Alpha" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Dernier exemplaire/)).toBeTruthy();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Publier l’annonce fictive" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(getGuestCollection()).toHaveLength(1);
    confirm.mockRestore();
  });

  it("preselects the displayed transcended copy and suggests its Transcendance price", async () => {
    addGuestCollectionCards([
      { userCardId: "base", card: cards[0]! },
      { userCardId: "awakened", card: cards[0]!, transcended: true },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <CollectionPage />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Vendre Alpha transcendée" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Copie de ta collection")).toHaveValue("awakened");
    expect(within(dialog).getByLabelText("Prix en Zen")).toHaveValue(5000);
    fireEvent.change(within(dialog).getByLabelText("Mode de vente"), { target: { value: "auction" } });
    expect(within(dialog).getByLabelText("Prix de départ en Zen")).toHaveValue(4000);
    expect(within(dialog).getByLabelText("Prix d'achat immédiat (optionnel, en Zen)")).toHaveValue(9500);
    expect(within(dialog).getByText(/Dernier exemplaire/)).toBeTruthy();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Publier l’annonce fictive" }));
    await waitFor(() => expect(getGuestCollection().map((row) => row.id)).toEqual(["base"]));
    expect(getGuestMarket().listings.find((item) => item.seller === "guest")?.rarity).toBe(
      "transcendance",
    );
  });

  it("opens the sale form for the chosen card from its detail dialog", async () => {
    addGuestCollectionCards([{ userCardId: "copy", card: cards[0]! }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CollectionPage /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Détails Alpha" }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Valeur locale : 10 Zen")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Vendre" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Copie de ta collection")).toHaveValue("copy");
    expect(within(dialog).getByText(/Dernier exemplaire/)).toBeTruthy();
  });

  it("keeps server copies separate and allows a signed-in player to sell a local copy", async () => {
    mocks.session = { user: { id: "alice" } };
    mocks.guest = false;
    addGuestCollectionCards([{ userCardId: "local-copy", card: cards[0]! }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CollectionPage /></QueryClientProvider>);
    await screen.findByText("Alpha");
    expect(screen.queryByRole("button", { name: "Vendre Alpha" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voir ma collection locale" }));
    fireEvent.click(await screen.findByRole("button", { name: "Vendre Alpha" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Copie de ta collection")).toHaveValue("local-copy");
  });

  it("shows market copies in the local collection without an account or guest mode", async () => {
    mocks.guest = false;
    addGuestCollectionCards([{ userCardId: "local-copy", card: cards[0]! }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CollectionPage /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Vendre Alpha" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Copie de ta collection")).toHaveValue("local-copy");
  });
});
