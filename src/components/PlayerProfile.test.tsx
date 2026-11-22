import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPlayerProfile } from "@/lib/player-profile";
import { updateGuestState } from "@/lib/guest-collection";
import { BETA_END, claimBetaAccess } from "@/lib/beta";
import { PlayerProfileDialog } from "./PlayerProfile";

const fixtures = vi.hoisted(() => ({
  userId: null as string | null,
  accountRows: [] as {
    id: string;
    card_id: string;
    obtained_at: string;
    transcended: boolean;
    awaken_attempted: boolean;
  }[],
  cards: [
    {
      id: "guest",
      name: "Carte invitée",
      series: "Anime",
      rarity: "rare",
      title: "",
      description: "",
      sort_order: 0,
    },
    {
      id: "account",
      name: "Carte compte",
      series: "Autre",
      rarity: "mythique",
      title: "",
      description: "",
      sort_order: 1,
    },
  ],
  updateUser: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    session: fixtures.userId ? { user: { id: fixtures.userId } } : null,
  }),
}));
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards"], queryFn: async () => fixtures.cards },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: fixtures.updateUser } },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/AnimeCard", () => ({
  AnimeCard: ({ card, transcended }: { card: { name: string }; transcended: boolean }) => (
    <div>
      {card.name}
      {transcended ? " éveillée" : ""}
    </div>
  ),
}));

const row = (id: string, transcended = false) => ({
  id,
  card_id: id,
  transcended,
  awaken_attempted: false,
  obtained_at: "2026-01-01T00:00:00Z",
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerProfileDialog />
    </QueryClientProvider>,
  );
}

describe("personnalisation du profil", () => {
  beforeEach(() => {
    localStorage.clear();
    fixtures.userId = null;
    fixtures.accountRows = [];
    fixtures.updateUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(BETA_END) - 1000);
  });
  afterEach(() => vi.restoreAllMocks());

  it("ne réinitialise pas la progression si la confirmation est annulée", async () => {
    updateGuestState((state) => ({ state: { ...state, zen: 900 }, result: undefined }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    await screen.findByText("Collection locale sur cet appareil");
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser ma progression Bêta (repartir de 0)" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem("zenkai_guest_collection")!).zen).toBe(900);
  });

  it("indique que la réinitialisation d'un compte connecté est indisponible", async () => {
    fixtures.userId = "alice";
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    await screen.findByText("Collection locale sur cet appareil");
    expect(screen.getByRole("button", { name: "Réinitialiser ma progression Bêta (repartir de 0)" })).toBeDisabled();
    expect(screen.getByText(/nécessite une prise en charge sécurisée côté serveur/)).toBeTruthy();
  });

  it("permet d'équiper le titre du pack de bienvenue bêta", async () => {
    claimBetaAccess("ZENKAI7", Date.parse(BETA_END) - 1);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    await screen.findByText("Collection locale sur cet appareil");
    const select = screen.getByLabelText("Titre équipé");
    expect(within(select).getByRole("option", { name: "Pionnier Bêta" })).toBeEnabled();
    fireEvent.change(select, { target: { value: "Pionnier Bêta" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le profil" }));
    expect(getPlayerProfile().equippedTitle).toBe("Pionnier Bêta");
  });

  it("choisit une carte locale pour l'avatar et la vitrine puis la retrouve à la réouverture", async () => {
    updateGuestState((state) => ({
      state: { ...state, rows: [row("guest", true)] },
      result: undefined,
    }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    await screen.findByText("Collection locale sur cet appareil");
    expect(screen.getAllByRole("button", { name: /Modifier emplacement/ })).toHaveLength(8);
    fireEvent.change(screen.getByLabelText("Pseudo"), { target: { value: "Alice" } });
    expect(screen.getByRole("button", { name: /Arc-en-Ciel Transcendance/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Arc-en-Ciel Transcendance/ }));
    fireEvent.click(screen.getByRole("button", { name: "Changer d'avatar" }));
    const avatarSelector = screen.getByRole("dialog", { name: "Choisir un avatar" });
    expect(within(avatarSelector).getByText("Carte compte")).toBeTruthy();
    fireEvent.click(within(avatarSelector).getByRole("button", { name: /Carte invitée/ }));
    fireEvent.click(screen.getByRole("button", { name: "Modifier emplacement 1" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Choisir une carte pour la vitrine" })).getByRole(
        "button",
        { name: /Carte invitée/ },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Modifier emplacement 8" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Choisir une carte pour la vitrine" })).getByRole(
        "button",
        { name: /Carte invitée/ },
      ),
    );
    expect(screen.getAllByText("Carte invitée éveillée")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le profil" }));
    expect(getPlayerProfile()).toMatchObject({
      username: "Alice",
      avatarCardId: "guest",
      avatarFrame: "rainbow",
      showcaseCardIds: ["guest", null, null, null, null, null, null, "guest"],
    });
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    expect(await screen.findByDisplayValue("Alice")).toBeTruthy();
    expect(screen.getAllByText("Carte invitée éveillée")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Retirer carte 8" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le profil" }));
    expect(getPlayerProfile().showcaseCardIds).toEqual([
      "guest",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("utilise la collection locale même connecté et synchronise le pseudo personnalisé", async () => {
    fixtures.userId = "alice";
    fixtures.accountRows = [row("account")];
    localStorage.setItem(
      "zenkai_player_profile",
      JSON.stringify({
        username: "Alice",
        bio: "",
        banner: "solar",
        avatarCardId: "guest",
        avatarFrame: "steel",
        equippedTitle: "Novice Zenkai",
        showcaseCardIds: [null, null, null, null, null, null, null, null],
      }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    await screen.findByText("Collection locale sur cet appareil");
    fireEvent.click(screen.getByRole("button", { name: "Changer d'avatar" }));
    const selector = screen.getByRole("dialog", { name: "Choisir un avatar" });
    expect(within(selector).getByText("Carte invitée")).toBeTruthy();
    expect(within(selector).getByText("Carte compte")).toBeTruthy();
    fireEvent.click(within(selector).getByRole("button", { name: /Carte compte/ }));
    fireEvent.change(screen.getByLabelText("Pseudo"), { target: { value: "Alice perso" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le profil" }));
    await waitFor(() => expect(fixtures.updateUser).toHaveBeenCalledWith({
      data: { username: "Alice perso" },
    }));
    expect(getPlayerProfile()).toMatchObject({
      username: "Alice perso",
      avatarCardId: "account",
      showcaseCardIds: [null, null, null, null, null, null, null, null],
    });
  });

  it("garde un avatar du catalogue même si sa carte est retirée de la collection", async () => {
    updateGuestState((state) => ({
      state: { ...state, rows: [row("guest")] },
      result: undefined,
    }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    await screen.findByText("Collection locale sur cet appareil");
    fireEvent.click(screen.getByRole("button", { name: "Changer d'avatar" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Choisir un avatar" })).getByRole("button", {
        name: /Carte invitée/,
      }),
    );
    act(() => {
      updateGuestState((state) => ({ state: { ...state, rows: [] }, result: undefined }));
    });
    expect(screen.queryByText(/Cet avatar n'appartient plus/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le profil" }));
    expect(getPlayerProfile().avatarCardId).toBe("guest");
  });
});
