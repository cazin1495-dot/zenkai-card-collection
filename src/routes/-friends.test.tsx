import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendsPage } from "./friends";
import { setPlus } from "@/lib/subscription";

const mocks = vi.hoisted(() => ({
  ilike: vi.fn(),
  neq: vi.fn(),
  limit: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  session: { user: { id: "alice" } } as { user: { id: string } } | null,
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: mocks.session, guest: !mocks.session, ready: true }),
}));
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards"], queryFn: async () => [] },
  profileQuery: () => ({
    queryKey: ["profile", "alice"],
    queryFn: async () => ({ username: "Alice" }),
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ ilike: mocks.ilike }) }) },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

describe("friends page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.session = { user: { id: "alice" } };
    mocks.ilike.mockReturnValue({ neq: mocks.neq });
    mocks.neq.mockReturnValue({ limit: mocks.limit });
  });

  function showPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const root = createRootRoute();
    const friendsRoute = createRoute({ getParentRoute: () => root, path: "/friends", component: FriendsPage });
    const tradesRoute = createRoute({
      getParentRoute: () => root,
      path: "/echanges",
      validateSearch: (search: Record<string, unknown>) => ({
        pseudo: typeof search["pseudo"] === "string" ? search["pseudo"] : "",
      }),
      component: () => <div>Pseudo sélectionné : {tradesRoute.useSearch().pseudo}</div>,
    });
    const router = createRouter({
      routeTree: root.addChildren([friendsRoute, tradesRoute]),
      history: createMemoryHistory({ initialEntries: ["/friends"] }),
    });
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  }

  it("shows the player's local Zenkai+ avatar and badge", async () => {
    setPlus("alice", false, { active: true });
    setPlus("alice", false, { avatar: "goku" });
    showPage();
    expect(await screen.findByText("ZENKAI+")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ton avatar" })).toHaveAttribute("src", "/goku%20ui.png");
  });

  it("adds a verified player locally, escapes wildcard searches, and removes them", async () => {
    mocks.limit.mockResolvedValue({ data: [{ id: "bob", username: "Bob_1" }], error: null });
    showPage();
    fireEvent.change(await screen.findByLabelText("Rechercher un joueur par pseudo"), {
      target: { value: " Bob_1 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher et ajouter un profil vérifié" }));
    await screen.findByText("Bob_1");
    expect(mocks.ilike).toHaveBeenCalledWith("username", "Bob\\_1");
    expect(mocks.neq).toHaveBeenCalledWith("id", "alice");
    expect(screen.getByText("Mes amis (1)")).toBeTruthy();
    expect(mocks.success).toHaveBeenCalledWith("Bob_1 ajouté à ta liste locale");
    fireEvent.click(screen.getByRole("button", { name: "Retirer Bob_1" }));
    await waitFor(() => expect(screen.queryByText("Bob_1")).toBeNull());
  });

  it("does not invent a contact when the lookup fails or is ambiguous", async () => {
    mocks.limit.mockResolvedValue({ data: [], error: { message: "Accès refusé" } });
    showPage();
    fireEvent.change(await screen.findByLabelText("Rechercher un joueur par pseudo"), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher et ajouter un profil vérifié" }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Ajout impossible : Accès refusé"),
    );
    expect(screen.getByText("Mes amis (0)")).toBeTruthy();
    mocks.limit.mockResolvedValue({
      data: [
        { id: "1", username: "Bob" },
        { id: "2", username: "bob" },
      ],
      error: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher et ajouter un profil vérifié" }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Plusieurs joueurs portent ce pseudo. Impossible de les distinguer.",
      ),
    );
    expect(screen.getByText("Mes amis (0)")).toBeTruthy();
  });

  it("can explicitly save an unverified local nickname but not the player's own", async () => {
    showPage();
    const input = await screen.findByLabelText("Rechercher un joueur par pseudo");
    fireEvent.change(input, { target: { value: "ALICE" } });
    const button = screen.getByRole("button", { name: "Ajouter" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(mocks.error).toHaveBeenCalledWith("Tu ne peux pas t'ajouter toi-même.");
    fireEvent.change(input, { target: { value: "Bob" } });
    fireEvent.click(button);
    expect(await screen.findByText("Bob")).toBeTruthy();
    expect(
      screen.getByText("Contact local · pseudo non vérifié · statut indisponible"),
    ).toBeTruthy();
    expect(mocks.success).toHaveBeenCalledWith("Bob ajouté à ta liste locale (pseudo non vérifié)");
  });

  it("adds a guest contact without a server lookup and carries its nickname to trades", async () => {
    mocks.session = null;
    showPage();
    fireEvent.change(await screen.findByLabelText("Rechercher un joueur par pseudo"), {
      target: { value: "  Yuki & Co  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(await screen.findByText("Yuki & Co")).toBeTruthy();
    expect(mocks.ilike).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("zenkai:friends:local-guest") ?? "[]")).toHaveLength(1);
    fireEvent.click(screen.getByRole("link", { name: "Échanger" }));
    expect(await screen.findByText("Pseudo sélectionné : Yuki & Co")).toBeTruthy();
  });
});
