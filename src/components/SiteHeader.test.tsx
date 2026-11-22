import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./SiteHeader";
import { addGuestCollectionCards, recycleGuestCollection, updateGuestState } from "@/lib/guest-collection";
import type { Card } from "@/lib/cards";
import { claimDailyLogin, recordQuestActivity, unlockSecret } from "@/lib/quests";
import { toast } from "sonner";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: null, guest: true, leaveGuestMode: vi.fn() }),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards"], queryFn: async () => [] },
  profileQuery: () => ({ queryKey: ["profile"], queryFn: async () => null }),
  collectionQuery: () => ({ queryKey: ["collection"], queryFn: async () => [] }),
}));
vi.mock("@/lib/game", () => ({
  gameQuery: () => ({ queryKey: ["game"], queryFn: async () => null }),
}));

describe("Zenkai+ in the header", () => {
  beforeEach(() => localStorage.clear());

  it("garde la boutique accessible dans la navigation avec le badge Bientôt", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SiteHeader /></QueryClientProvider>);
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    const boutique = within(nav).getByText("Boutique").closest("a");
    expect(boutique).toBeVisible();
    expect(boutique).toHaveAttribute("href", "/boutique");
    expect(within(boutique!).getByText("Bientôt")).toBeVisible();
  });

  it("reactively displays the local welcome bonus, badge and selected avatar", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SiteHeader /></QueryClientProvider>);
    expect(screen.getByText("500 Zen (local)")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Zenkai+" })[0]!);
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

  it("shows mission counts on both navigations, local level and level-up toast", () => {
    const success = vi.spyOn(toast, "success").mockImplementation(() => "");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(<QueryClientProvider client={client}><SiteHeader /></QueryClientProvider>);
    const mobile = screen.getByRole("navigation", { name: "Navigation mobile" });
    const desktop = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(within(mobile).getByText("Missions")).toBeTruthy();
    expect(within(desktop).getByText("Missions")).toBeTruthy();
    expect(within(mobile).getByLabelText("1 récompense disponible")).toHaveTextContent("1");
    act(() => recordQuestActivity(null, "boosters", 24));
    expect(within(mobile).getByLabelText("3 récompenses disponibles")).toHaveTextContent("3");
    expect(within(desktop).getByLabelText("3 récompenses disponibles")).toHaveTextContent("3");
    expect(screen.getAllByText(/Niveau 2/).length).toBeGreaterThan(0);
    for (const progress of screen.getAllByRole("progressbar", { name: "Progression XP locale" })) {
      expect(progress).toHaveAttribute("aria-valuenow", "0");
      expect(progress).toHaveAttribute("aria-valuemax", "600");
    }
    expect(success).toHaveBeenCalledWith("Niveau 2 atteint ! +100 Zen offerts ★");
    act(() => { claimDailyLogin(); });
    expect(within(mobile).getByLabelText("2 récompenses disponibles")).toHaveTextContent("2");
    unmount();
    success.mockRestore();
  });

  it("exclut les secrets du compteur, même pour les anciens cadeaux non réclamés", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SiteHeader /></QueryClientProvider>);
    act(() => updateGuestState((state) => ({ state: { ...state, secrets: { unlocked: ["night"], claimed: [], recycled: 0 } }, result: undefined })));
    const mobile = screen.getByRole("navigation", { name: "Navigation mobile" });
    expect(within(mobile).getByLabelText("1 récompense disponible")).toHaveTextContent("1");
    act(() => unlockSecret("word"));
    expect(within(mobile).getByLabelText("1 récompense disponible")).toHaveTextContent("1");
  });

  it("provides mobile navigation and opens the local profile", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SiteHeader /></QueryClientProvider>);
    const nav = screen.getByRole("navigation", { name: "Navigation mobile" });
    const menu = screen.getByLabelText("Plus de navigation").closest("details")!;
    menu.open = true;
    for (const [label, href] of [["Boosters", "/"], ["Collection", "/collection"], ["Marché", "/market"], ["Missions", "/eveil"]] as const) {
      expect(within(nav).getByText(label).closest("a")).toHaveAttribute("href", href);
    }
    fireEvent.click(within(nav).getByRole("button", { name: "Profil" }));
    expect(menu).not.toHaveAttribute("open");
    expect(await screen.findByRole("dialog")).toHaveTextContent("Profil du joueur");
  });
});
