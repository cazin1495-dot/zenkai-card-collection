import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./SiteHeader";
import { addGuestCollectionCards, recycleGuestCollection } from "@/lib/guest-collection";
import type { Card } from "@/lib/cards";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: null, guest: true, leaveGuestMode: vi.fn() }),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards"], queryFn: async () => [] },
  profileQuery: () => ({ queryKey: ["profile"], queryFn: async () => null }),
}));
vi.mock("@/lib/game", () => ({
  gameQuery: () => ({ queryKey: ["game"], queryFn: async () => null }),
}));

describe("Zenkai+ in the header", () => {
  beforeEach(() => localStorage.clear());

  it("reactively displays the local welcome bonus, badge and selected avatar", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SiteHeader /></QueryClientProvider>);
    expect(screen.getByText("500 Zen (local)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zenkai+" }));
    fireEvent.click(await screen.findByRole("button", { name: "Activer Zenkai+ (Mode Test)" }));
    expect(screen.getByText("800 Zen (local)")).toBeTruthy();
    expect(screen.getByText("ZENKAI+")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Goku Ultra Instinct" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("img", { name: "Ton avatar" })).toHaveAttribute("src", "/goku%20ui.png");
  });

  it("refreshes the displayed local Zen after recycling", () => {
    const card: Card = { id: "c", name: "Carte", title: "", description: "", rarity: "commune", sort_order: 0 };
    addGuestCollectionCards([{ userCardId: "first", card }, { userCardId: "second", card }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SiteHeader /></QueryClientProvider>);
    expect(screen.getByText("500 Zen (local)")).toBeTruthy();
    act(() => { recycleGuestCollection(["second"], [card]); });
    expect(screen.getByText("504 Zen (local)")).toBeTruthy();
  });
});
