import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendsPage } from "./friends";
import type { Friendship } from "@/lib/friendships";
const mocks = vi.hoisted(() => ({ list: vi.fn(), send: vi.fn(), accept: vi.fn(), remove: vi.fn(), username: vi.fn(), plus: false, session: { user: { id: "alice" } } as { user: { id: string } } | null, rows: [] as Friendship[] }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: mocks.session, guest: !mocks.session, ready: true }) }));
vi.mock("@/hooks/use-zenkai-plus", () => ({ useZenkaiPlus: () => ({ state: mocks.plus ? { active: true } : null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.username }) }) }) } }));
vi.mock("@/lib/queries", () => ({ cardsQuery: { queryKey: ["cards"], queryFn: async () => [] }, profileQuery: () => ({ queryKey: ["profile", "alice"], queryFn: async () => ({ username: "Alice" }) }) }));
vi.mock("@/lib/friendships", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/friendships")>(), friendshipsQuery: (id: string) => ({ queryKey: ["friendships", id], queryFn: mocks.list }), sendFriendRequest: mocks.send, acceptFriendRequest: mocks.accept, removeFriendship: mocks.remove }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const request = (id: string, requester: string, addressee: string): Friendship => ({ id, requester_id: requester, addressee_id: addressee, status: "pending", created_at: "2026-11-22T00:00:00Z", requester_username: requester === "bob" ? "Bob" : "Alice", addressee_username: addressee === "carol" ? "Carol" : "Alice" });
function showPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute();
  const router = createRouter({ routeTree: root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/friends", component: FriendsPage }),
    createRoute({ getParentRoute: () => root, path: "/echanges", validateSearch: (s: Record<string, unknown>) => ({ pseudo: typeof s["pseudo"] === "string" ? s["pseudo"] : "" }), component: () => null }),
    createRoute({ getParentRoute: () => root, path: "/auth", component: () => null }),
  ]), history: createMemoryHistory({ initialEntries: ["/friends"] }) });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  return client;
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mocks.session = { user: { id: "alice" } }; mocks.plus = false; mocks.username.mockResolvedValue({ data: null, error: null }); mocks.rows = [request("received", "bob", "alice"), request("sent", "alice", "carol")]; mocks.list.mockImplementation(async () => mocks.rows.map(row => ({ ...row }))); mocks.accept.mockImplementation(async (id: string) => { mocks.rows = mocks.rows.map(row => row.id === id ? { ...row, status: "accepted" } : row); }); mocks.remove.mockImplementation(async (id: string) => { mocks.rows = mocks.rows.filter(row => row.id !== id); }); });
describe("online friendship actions", () => {
  it("uses the definitive username, not the old profile name", async () => {
    mocks.plus = true;
    mocks.username.mockResolvedValue({ data: { username: "Pseudo définitif" }, error: null });
    showPage();
    expect(await screen.findByText("Pseudo définitif")).toBeTruthy();
    expect(screen.queryByText("Alice")).toBeNull();
  });
  it("accepts as addressee and refreshes the accepted friendship in query cache", async () => {
    const client = showPage();
    fireEvent.click(await screen.findByRole("button", { name: "Accepter Bob" }));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith("received", "alice"));
    await waitFor(() => expect(client.getQueryData<Friendship[]>(["friendships", "alice"])?.find(row => row.id === "received")?.status).toBe("accepted"));
    expect(mocks.list.mock.calls.length).toBeGreaterThan(1);
    expect(await screen.findByRole("button", { name: "Retirer Bob" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Accepter Bob" })).toBeNull();
  });
  it("refuses an incoming request without keeping it as an accepted friend", async () => {
    const client = showPage(); fireEvent.click(await screen.findByRole("button", { name: "Refuser Bob" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("received"));
    await waitFor(() => expect(client.getQueryData<Friendship[]>(["friendships", "alice"])?.map(row => row.id)).toEqual(["sent"]));
  });
  it("sends a real request instead of a local contact", async () => {
    mocks.send.mockResolvedValue({ id: "dave", username: "Dave" }); showPage();
    fireEvent.change(await screen.findByLabelText("Rechercher un joueur par pseudo"), { target: { value: "Dave" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer une demande" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith("alice", "Dave"));
  });
  it("does not load private requests or allow guest additions", async () => {
    mocks.session = null; showPage(); await screen.findByRole("link", { name: "Connexion" });
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Envoyer une demande" })).toBeNull();
  });
});
