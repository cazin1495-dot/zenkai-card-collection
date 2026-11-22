import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    session: fixtures.userId ? { user: { id: fixtures.userId } } : null,
  }),
}));
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards"], queryFn: async () => fixtures.cards },
  collectionQuery: (id: string) => ({
    queryKey: ["collection", id],
    queryFn: async () => fixtures.accountRows,
  }),
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
  });

  it("permet d'équiper le titre du pack de bienvenue bêta", async () => {
    claimBetaAccess("ZENKAI7", Date.parse(BETA_END) - 1);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    await screen.findByText("Collection locale");
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
    await screen.findByText("Collection locale");
    expect(screen.getAllByRole("button", { name: /Modifier emplacement/ })).toHaveLength(8);
    fireEvent.change(screen.getByLabelText("Pseudo"), { target: { value: "Alice" } });
    expect(screen.getByRole("button", { name: /Arc-en-Ciel Transcendance/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Arc-en-Ciel Transcendance/ }));
    fireEvent.click(screen.getByRole("button", { name: "Changer d'avatar" }));
    const avatarSelector = screen.getByRole("dialog", { name: "Choisir un avatar" });
    expect(within(avatarSelector).queryByText("Carte compte")).toBeNull();
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

  it("utilise la collection du compte connecté et signale les choix devenus indisponibles", async () => {
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
        showcaseCardIds: ["guest", null, null, null],
      }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    await screen.findByText("Collection du compte connecté");
    expect(screen.getByText(/Cet avatar n'appartient plus/)).toBeTruthy();
    expect(screen.getByText(/Certaines cartes ne sont plus disponibles/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Changer d'avatar" }));
    const selector = screen.getByRole("dialog", { name: "Choisir un avatar" });
    expect(within(selector).queryByText("Carte invitée")).toBeNull();
    fireEvent.click(within(selector).getByRole("button", { name: /Carte compte/ }));
    fireEvent.click(screen.getByRole("button", { name: "Retirer carte 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le profil" }));
    expect(getPlayerProfile()).toMatchObject({
      avatarCardId: "account",
      showcaseCardIds: [null, null, null, null, null, null, null, null],
    });
  });

  it("rafraîchit les cartes locales et refuse de conserver une carte retirée", async () => {
    updateGuestState((state) => ({
      state: { ...state, rows: [row("guest")] },
      result: undefined,
    }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    await screen.findByText("Collection locale");
    fireEvent.click(screen.getByRole("button", { name: "Changer d'avatar" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Choisir un avatar" })).getByRole("button", {
        name: /Carte invitée/,
      }),
    );
    act(() => {
      updateGuestState((state) => ({ state: { ...state, rows: [] }, result: undefined }));
    });
    expect(await screen.findByText(/Cet avatar n'appartient plus/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le profil" }));
    expect(localStorage.getItem("zenkai_player_profile")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Avatar automatique" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le profil" }));
    expect(getPlayerProfile().avatarCardId).toBeNull();
  });
});
