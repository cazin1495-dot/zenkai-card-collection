import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoostersPage } from "./index";
import { PACKS, PACK_ARTWORK_BY_PACK, type Card } from "@/lib/cards";
import { addGuestCollectionCards, getGuestCollection, updateGuestState } from "@/lib/guest-collection";
import { getQuestState, getSecretQuests } from "@/lib/quests";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "@/lib/transcendance-cards";

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
vi.mock("@/lib/guest", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/guest")>(),
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
  const result = render(<QueryClientProvider client={client}><BoostersPage /></QueryClientProvider>);
  return result;
}

describe("booster hub", () => {
  afterEach(() => vi.restoreAllMocks());
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

  it("updates Transcendance visibility when the guest collection changes", async () => {
    const card = CUSTOM_TRANSCENDANCE_CARDS[0]!;
    showPage();
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.queryByText(card.name)).toBeNull();
    act(() => addGuestCollectionCards([{ userCardId: "owned-exclusive", card: customTranscendanceAsCard(card), customTranscendance: true }]));
    expect(await screen.findByText(card.name)).toBeTruthy();
    act(() => updateGuestState((state) => ({ state: { ...state, rows: [] }, result: undefined })));
    await waitFor(() => expect(screen.queryByText(card.name)).toBeNull());
  });

  it("keeps guest Transcendances hidden when local collection data is invalid", async () => {
    localStorage.setItem("zenkai_guest_collection", "{");
    showPage();
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    expect(await screen.findByText(/Impossible de vérifier ta collection/)).toBeTruthy();
    expect(screen.queryByText(CUSTOM_TRANSCENDANCE_CARDS[0]!.name)).toBeNull();
    expect(screen.getAllByText("??? · Carte Transcendance").length).toBeGreaterThan(0);
  });

  it("uses the local collection for connected users too", async () => {
    const card = CUSTOM_TRANSCENDANCE_CARDS[0]!;
    addGuestCollectionCards([{ userCardId: "guest-exclusive", card: customTranscendanceAsCard(card), customTranscendance: true }]);
    mocks.auth.session = { user: { id: "player" } };
    mocks.auth.guest = false;
    showPage();
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.getByText(card.name)).toBeTruthy();
    expect(mocks.collection).not.toHaveBeenCalled();
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
    expect(getQuestState(null).boosters).toBe(1);
    fireEvent.click(fullSkip);
    expect(screen.getByRole("heading", { name: "Récapitulatif" })).toBeTruthy();
    for (let index = 4; index > 0; index--) {
      expect(screen.getByText(`Carte ${index}`).compareDocumentPosition(screen.getByText(`Carte ${index - 1}`)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "← Boosters" }));
    expect(screen.getByRole("heading", { name: "Choisis ton booster" })).toBeTruthy();
  });

  it("opens one booster from the mobile shortcut", () => {
    vi.useFakeTimers();
    const { unmount } = showPage();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Ouvrir x1" }));
      expect(mocks.draw).toHaveBeenCalledWith(expect.anything(), "shonen", 1);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it.each([1, 5, 10])("chooses x%s by tapping the pack artwork", (count) => {
    vi.useFakeTimers();
    const { unmount } = showPage();
    try {
      fireEvent.click(screen.getByAltText("Booster Shojo"));
      const dialog = screen.getByRole("dialog", { name: "Ouvrir Shojo" });
      expect(dialog).toHaveClass("z-[999]");
      fireEvent.click(within(dialog).getByRole("button", { name: `Ouvrir x${count} · Gratuit` }));
      expect(mocks.draw).toHaveBeenCalledWith(expect.anything(), "shojo", count);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("button", { name: "Déchirer le booster" }).closest("section")).toHaveClass("fixed", "inset-0", "z-[1000]");
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("opens the selected mobile pack preview and reports unavailable Zen purchases", async () => {
    showPage();
    fireEvent.click(screen.getByRole("radio", { name: "Seinen" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Voir les cartes du pack" }));
    expect(await screen.findByRole("dialog", { name: "Contenu du pack Seinen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Boosters Zen" }));
    fireEvent.click(screen.getByRole("radio", { name: "Booster Zenkai" }));
    const dialog = screen.getByRole("dialog", { name: "Ouvrir Booster Zenkai" });
    expect(within(dialog).getByRole("button", { name: "Ouvrir x1 · 500 Zen" })).toBeDisabled();
    expect(within(dialog).getByText(/nécessite une prise en charge côté serveur/)).toBeTruthy();
  });

  it("opens ten boosters from the mobile shortcut and tears on a horizontal gesture", async () => {
    vi.useFakeTimers();
    const { container, unmount } = showPage();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Ouvrir x10" }));
      expect(mocks.draw).toHaveBeenCalledWith(expect.anything(), "shonen", 10);
      const pack = screen.getByRole("button", { name: "Déchirer le booster" });
      fireEvent(pack, new MouseEvent("pointerdown", { bubbles: true, clientX: 10 }));
      fireEvent(pack, new MouseEvent("pointermove", { bubbles: true, clientX: 90 }));
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      expect(container.querySelector(".pack-first-card img")).toHaveAttribute("src", "/image_39f4fe98.jpg");
      await act(async () => { await vi.advanceTimersByTimeAsync(1800); });
      expect(screen.getByRole("button", { name: "Retourner la carte" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Full Skip" })).toBeTruthy();
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("selects Shojo with the same frame as Shonen and carries its artwork through the opening", async () => {
    const { container } = showPage();
    const shojo = screen.getByAltText("Booster Shojo");
    const shonen = screen.getByAltText("Booster Shonen Mix");
    expect(shojo).toHaveAttribute("src", "/pack-shojo-aligned.png");
    expect(shojo.className).toBe(screen.getByAltText("Booster Seinen").className);
    expect(shojo.parentElement?.className).toContain("aspect-[2/3]");
    expect(shojo.parentElement?.className.replace(/ring-2.*$/, "").trim()).toBe(shonen.parentElement?.className.replace(/ring-2.*$/, "").trim());
    fireEvent.click(screen.getByRole("radio", { name: "Shojo" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Ouvrir Shojo" })).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("radio", { name: "Shojo" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByAltText("Pochette Shojo")).toHaveClass("h-full", "w-full", "object-cover");
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir · Gratuit" }));
    await waitFor(() => expect(container.querySelectorAll(".pack-art-image")).toHaveLength(2), { timeout: 3000 });
    expect(container.querySelector(".pack-first-card img")).toHaveAttribute("src", "/card-back-shojo.png");
    await screen.findByRole("button", { name: "Retourner la carte" }, { timeout: 5000 });
    expect(container.querySelector(".flip-face img")).toHaveAttribute("src", "/card-back-shojo.png");
    expect(container.querySelector(".rarity-glow-layer")).toBeTruthy();
    expect(mocks.draw).toHaveBeenCalledWith(expect.anything(), "shojo", 1);
  });

  it("uses the same selection template and framing for all seven packs", () => {
    showPage();
    fireEvent.click(screen.getByRole("button", { name: "Tous" }));
    const reference = screen.getByAltText("Booster Shonen Mix");
    const template = reference.parentElement!.className.replace(/ring-2.*$/, "").trim();
    for (const pack of PACKS) {
      const artwork = screen.getByAltText(`Booster ${pack.label}`);
      expect(artwork).toHaveAttribute("src", PACK_ARTWORK_BY_PACK[pack.id]);
      expect(artwork).toHaveClass("h-full", "w-full", "object-cover", "object-center");
      expect(artwork.className).toBe(reference.className);
      expect(artwork.parentElement!.className.replace(/ring-2.*$/, "").trim()).toBe(template);
      expect(artwork.parentElement).toHaveClass("aspect-[2/3]", "w-full", "overflow-hidden", "mx-auto");
      fireEvent.click(artwork);
      const dialog = screen.getByRole("dialog", { name: `Ouvrir ${pack.label}` });
      expect(within(dialog).getByRole("button", { name: /Ouvrir x1 ·/ })).toBeTruthy();
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    }
  });

  it.each([
    ["Seinen", "/card-back-seinen.png"],
    ["Sport", "/carte%20sport.jpg"],
    ["Antagoniste", "/card-back-antagoniste.png"],
    ["Protagoniste", "/card-back-protagoniste.png"],
  ])("keeps the %s card back from the tear through the 3D flip", async (pack, image) => {
    const { container } = showPage();
    if (pack === "Antagoniste") {
      const artwork = screen.getByAltText("Booster Antagoniste");
      expect(artwork).toHaveAttribute("src", "/pack-antagoniste-aligned.png");
      expect(artwork).toHaveClass("h-full", "w-full", "object-cover", "object-center");
      expect(artwork.parentElement).toHaveClass("aspect-[2/3]", "overflow-hidden");
    }
    if (pack === "Protagoniste") {
      const artwork = screen.getByAltText("Booster Protagoniste");
      expect(artwork).toHaveAttribute("src", "/pack-protagoniste.png");
      expect(artwork).toHaveClass("h-full", "w-full", "object-cover", "object-center");
      expect(artwork.parentElement).toHaveClass("aspect-[2/3]", "overflow-hidden");
      expect(artwork.parentElement?.className).toBe(screen.getByAltText("Booster Seinen").parentElement?.className);
    }
    fireEvent.click(screen.getByRole("radio", { name: pack }));
    fireEvent.click(within(screen.getByRole("dialog", { name: `Ouvrir ${pack}` })).getByRole("button", { name: "Close" }));
    if (pack === "Protagoniste") {
      expect(screen.getByAltText("Pochette Protagoniste")).toHaveAttribute("src", "/pack-protagoniste.png");
      expect(screen.getByAltText("Pochette Protagoniste")).toHaveClass("h-full", "w-full", "object-cover", "object-center");
    }
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir · Gratuit" }));
    await waitFor(() => expect(container.querySelector(".pack-first-card img")).toHaveAttribute("src", image), { timeout: 3000 });
    if (pack === "Sport") {
      expect(container.querySelector(".pack-first-card img")).toHaveClass("h-full", "w-full", "object-cover", "object-center", "rounded-[inherit]", "scale-[1.12]");
    }
    if (pack === "Antagoniste") {
      const images = container.querySelectorAll(".pack-art-image");
      expect(images).toHaveLength(2);
      images.forEach((artwork) => {
        expect(artwork).toHaveAttribute("src", "/pack-antagoniste-aligned.png");
        expect(artwork).toHaveClass("object-cover", "object-center");
        expect(artwork.closest(".pack-art")).toHaveClass("overflow-hidden");
      });
      expect(container.querySelector(".pack-first-card img")).toHaveClass("object-center", "rounded-[inherit]", "scale-[1.22]");
    }
    if (pack === "Protagoniste") {
      const images = container.querySelectorAll(".pack-art-image");
      expect(images).toHaveLength(2);
      images.forEach((artwork) => {
        expect(artwork).toHaveAttribute("src", "/pack-protagoniste.png");
        expect(artwork).toHaveClass("h-full", "w-full", "object-cover", "object-center");
      });
      const back = container.querySelector(".pack-first-card img");
      expect(back).toHaveClass("h-full", "w-full", "object-cover", "object-center", "rounded-[inherit]");
      expect(back?.className).not.toMatch(/scale-/);
      expect(container.querySelector('img[src="/image_39f4fe98.jpg"]')).toBeNull();
    }
    await screen.findByRole("button", { name: "Retourner la carte" }, { timeout: 5000 });
    const back = container.querySelector(".flip-face img");
    expect(back).toHaveAttribute("src", image);
    if (pack === "Sport") {
      expect(back).toHaveClass("h-full", "w-full", "object-cover", "object-center", "rounded-[inherit]", "scale-[1.12]");
    }
    if (pack === "Antagoniste") {
      expect(back).toHaveClass("h-full", "w-full", "object-cover", "object-center", "rounded-[inherit]", "scale-[1.22]");
    }
    if (pack === "Protagoniste") {
      expect(back).toHaveClass("h-full", "w-full", "object-cover", "object-center", "rounded-[inherit]");
      expect(back?.className).not.toMatch(/scale-/);
    }
    fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
    expect(container.querySelector(".flip-inner")).toHaveClass("flipped");
    expect(container.querySelector(".flip-face img")).toBe(back);
    if (pack === "Protagoniste") {
      for (let i = 1; i < 5; i++) {
        fireEvent.click(screen.getByRole("button", { name: "Carte suivante" }));
        const nextBack = container.querySelector(".flip-face img");
        expect(nextBack).toHaveAttribute("src", image);
        expect(container.querySelector('img[src="/image_39f4fe98.jpg"]')).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
        expect(container.querySelector(".flip-face img")).toBe(nextBack);
      }
    }
  });

  it.each([5, 10])("marks only first new guest draws in a persisted %sx batch summary", async (count) => {
    addGuestCollectionCards([{ userCardId: "owned", card: cards[0]! }]);
    showPage();
    const inspector = screen.getByRole("complementary", { name: "Détails du booster" });
    fireEvent.click(within(inspector).getByRole("radio", { name: `${count}x` }));
    fireEvent.click(within(inspector).getByRole("button", { name: "Ouvrir · Gratuit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Full Skip" }, { timeout: 5000 }));
    expect(getSecretQuests().unlocked.includes("miracle")).toBe(count === 10);
    expect(screen.getAllByText("NOUVEAU")).toHaveLength(4);
    expect(screen.getAllByText("Carte 0")).toHaveLength(count);
    for (const element of screen.getAllByText("Carte 0")) {
      expect(within(element.closest(".animate-card-in") as HTMLElement).queryByText("NOUVEAU")).toBeNull();
    }
    expect(getGuestCollection()).toHaveLength(1 + count * 5);
    expect(screen.getByText(/Tirage local sauvegardé dans ta collection/)).toBeTruthy();
  });

  it("snapshots the local collection before opening and marks only the first new copy", async () => {
    mocks.auth.session = { user: { id: "player" } };
    mocks.auth.guest = false;
    addGuestCollectionCards([{ userCardId: "owned", card: cards[0]! }]);
    mocks.draw.mockReturnValue(["card-2", "card-0", "card-2", "card-1", "card-4"].map((id, i) => ({
      userCardId: `copy-${i}`,
      card: cards.find((card) => card.id === id)!,
    })));
    showPage();
    const open = await screen.findByRole("button", { name: /Ouvrir · Gratuit/ });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    fireEvent.click(await screen.findByRole("button", { name: "Full Skip" }, { timeout: 5000 }));
    expect(getQuestState(null).boosters).toBe(1);
    expect(screen.getAllByText("NOUVEAU")).toHaveLength(3);
    const duplicates = screen.getAllByText("Carte 2");
    expect(duplicates).toHaveLength(2);
    expect(duplicates.filter((element) => within(element.closest(".animate-card-in") as HTMLElement).queryByText("NOUVEAU"))).toHaveLength(1);
    expect(getGuestCollection()).toHaveLength(6);
    expect(mocks.collection).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("débloque Double Miracle après un tirage connecté x10", async () => {
    mocks.auth.session = { user: { id: "player" } };
    mocks.auth.guest = false;
    mocks.draw.mockReturnValue(Array.from({ length: 50 }, (_, i) => ({
      userCardId: `copy-${i}`,
      card: cards[i === 0 || i === 1 ? 4 : 0]!,
    })));
    showPage();
    const inspector = screen.getByRole("complementary", { name: "Détails du booster" });
    const open = within(inspector).getByRole("button", { name: "Ouvrir · Gratuit" });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(within(inspector).getByRole("radio", { name: "10x" }));
    fireEvent.click(open);
    await screen.findByRole("button", { name: "Full Skip" }, { timeout: 5000 });
    expect(getGuestCollection()).toHaveLength(50);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(getSecretQuests().unlocked).toContain("miracle");
  });

  it("does not draw when the local collection cannot be read", async () => {
    mocks.auth.session = { user: { id: "player" } };
    mocks.auth.guest = false;
    localStorage.setItem("zenkai_guest_collection", "{");
    showPage();
    fireEvent.click(screen.getByRole("button", { name: /Ouvrir · Gratuit/ }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.draw).not.toHaveBeenCalled();
  });

  it("opens and persists cards locally for signed-in accounts", async () => {
    mocks.auth.session = { user: { id: "player" } };
    mocks.auth.guest = false;
    showPage();
    fireEvent.click(screen.getByRole("button", { name: /Ouvrir · Gratuit/ }));
    await screen.findByRole("button", { name: "Full Skip" }, { timeout: 5000 });
    expect(getGuestCollection()).toHaveLength(5);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
