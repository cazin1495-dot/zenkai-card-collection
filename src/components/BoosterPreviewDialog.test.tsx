import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { applyRemoteRarityOverrides, DEMON_SLAYER_MYTHIC_CARDS, normalizeCatalogCard, type Card, type PackId } from "@/lib/cards";
import { BoosterPreviewDialog } from "./BoosterPreviewDialog";
import { CUSTOM_TRANSCENDANCE_CARDS, type CustomTranscendanceCard } from "@/lib/transcendance-cards";

const saveRarityOverride = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rarity-overrides", () => ({ saveRarityOverride }));

const cards: Card[] = [
  { id: "common", name: "Héros", title: "Shonen", rarity: "commune", description: "", sort_order: 1, category: "shonen" },
  { id: "mythic", name: "Rival", title: "Shonen", rarity: "mythique", description: "", sort_order: 2, category: "shonen" },
  { id: "other-pack", name: "Autre", title: "Seinen", rarity: "legendaire", description: "", sort_order: 3, category: "seinen" },
  normalizeCatalogCard({
    id: "goku-black",
    name: "Goku Black",
    title: "Dragon Ball Super",
    rarity: "rare",
    description: "",
    sort_order: 4,
    category: "seinen",
  }),
];

function PreviewHarness({ customCards, pack = "shonen", catalog = cards, ownedCardIds = new Set((customCards ?? CUSTOM_TRANSCENDANCE_CARDS).map((card) => card.id)) }: { customCards?: readonly CustomTranscendanceCard[]; pack?: PackId; catalog?: Card[]; ownedCardIds?: ReadonlySet<string> | null }) {
  const [open, setOpen] = useState(false);
  return (
    <BoosterPreviewDialog
      cards={catalog}
      pack={pack}
      packLabel={pack === "antagoniste" ? "Antagoniste" : pack === "protagoniste" ? "Protagoniste" : "Shonen Mix"}
      {...(customCards === undefined ? {} : { customCards })}
      ownedCardIds={ownedCardIds}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

describe("booster content preview", () => {
  afterEach(() => {
    localStorage.removeItem("zenkai:favorite-cards");
    localStorage.removeItem("zenkai_admin_rarity_overrides");
    applyRemoteRarityOverrides({});
    vi.restoreAllMocks();
  });

  it("renders at most 24 cards per batch, including the mystery card, with lazy, asynchronous images", () => {
    const catalog: Card[] = Array.from({ length: 55 }, (_, index) => ({
      id: `page-${index}`,
      name: `Carte ${index}`,
      title: "",
      rarity: "rare",
      description: "",
      sort_order: index,
      category: "seinen",
      image_url: `/card-${index}.jpg`,
    }));
    render(<PreviewHarness catalog={catalog} customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

    const images = () => screen.getByRole("dialog").querySelectorAll("article img");
    const articles = () => screen.getByRole("dialog").querySelectorAll("article");
    expect(articles()).toHaveLength(24);
    expect(images()).toHaveLength(23);
    for (const image of images()) {
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("decoding", "async");
    }
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus (+24)" }));
    expect(articles()).toHaveLength(48);
    expect(images()).toHaveLength(47);
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus (+24)" }));
    expect(images()).toHaveLength(55);
    expect(articles()).toHaveLength(56);
    expect(screen.queryByRole("button", { name: "Afficher plus (+24)" })).toBeNull();
  });

  it("resets the batch when the rarity, favorites, pack or dialog changes", () => {
    const catalog: Card[] = Array.from({ length: 50 }, (_, index) => ({
      id: `page-${index}`,
      name: `Carte ${index}`,
      title: "",
      rarity: "rare",
      description: "",
      sort_order: index,
      category: "seinen",
      image_url: `/card-${index}.jpg`,
    }));
    localStorage.setItem("zenkai:favorite-cards", JSON.stringify(catalog.map((card) => card.id)));
    const { rerender } = render(<PreviewHarness catalog={catalog} customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    const showMore = () => fireEvent.click(screen.getByRole("button", { name: "Afficher plus (+24)" }));
    const images = () => screen.getByRole("dialog").querySelectorAll("article img");
    showMore();
    expect(images()).toHaveLength(47);
    fireEvent.click(screen.getByRole("button", { name: /^Rare/ }));
    expect(images()).toHaveLength(24);
    showMore();
    fireEvent.click(screen.getByRole("button", { name: "★ Mes favoris (50)" }));
    expect(images()).toHaveLength(24);
    showMore();
    rerender(<PreviewHarness catalog={catalog} customCards={[]} pack="seinen" />);
    expect(images()).toHaveLength(24);
    showMore();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    expect(images()).toHaveLength(24);
  });

  it("finds distant characters and anime without case or accent sensitivity and adds favorites", () => {
    const catalog: Card[] = Array.from({ length: 55 }, (_, index) => ({
      id: `search-${index}`,
      name: index === 54 ? "Éowyn" : `Personnage ${index}`,
      series: index === 54 ? "L'Épopée" : "Autre série",
      title: index === 53 ? "Série du Crépuscule" : "",
      rarity: "rare",
      description: "",
      sort_order: index,
      category: "shonen",
    }));
    render(<PreviewHarness catalog={catalog} customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    expect(screen.queryByText("Éowyn")).toBeNull();
    const search = screen.getByLabelText("Rechercher un personnage ou un anime");
    fireEvent.change(search, { target: { value: "  eOWYN  " } });
    expect(screen.getByText("Éowyn")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter Éowyn aux favoris" }));
    fireEvent.click(screen.getByRole("button", { name: "★ Mes favoris (1)" }));
    fireEvent.change(search, { target: { value: "EPOPEE" } });
    expect(screen.getByText("Éowyn")).toBeTruthy();
    fireEvent.change(search, { target: { value: "crépuscule" } });
    expect(screen.getByText(/Aucune carte ne correspond à cette recherche/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "★ Mes favoris (1)" }));
    expect(screen.getByText("Personnage 53")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));
    expect(search).toHaveValue("");
    expect(screen.getByRole("button", { name: "Effacer la recherche" })).toBeDisabled();
  });

  it("resets pagination on every search change, clear and pack change", () => {
    const catalog: Card[] = Array.from({ length: 55 }, (_, index) => ({
      id: `search-page-${index}`, name: `Héros ${index}`, series: "Épopée", title: "",
      rarity: "rare", description: "", sort_order: index, category: "seinen",
      image_url: `/search-${index}.jpg`,
    }));
    const { rerender } = render(<PreviewHarness catalog={catalog} customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    const articles = () => screen.getByRole("dialog").querySelectorAll("article");
    const showMore = () => fireEvent.click(screen.getByRole("button", { name: "Afficher plus (+24)" }));
    const search = screen.getByLabelText("Rechercher un personnage ou un anime");
    showMore();
    expect(articles()).toHaveLength(48);
    fireEvent.change(search, { target: { value: "heros" } });
    expect(articles()).toHaveLength(24);
    showMore();
    expect(articles()).toHaveLength(48);
    fireEvent.change(search, { target: { value: "HÉROS" } });
    expect(articles()).toHaveLength(24);
    showMore();
    rerender(<PreviewHarness catalog={catalog} customCards={[]} pack="seinen" />);
    expect(articles()).toHaveLength(24);
    showMore();
    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));
    expect(articles()).toHaveLength(24);
  });

  it("does not expose concealed Transcendances through search results", () => {
    const hidden: CustomTranscendanceCard = {
      id: "secret-exclusive", name: "Personnage secret", anime: "Série secrète",
      image_url: "/secret-portrait.png", pack_ids: ["shonen"], rarity: "Transcendance", series_number: "SECRET-001",
    };
    const { rerender } = render(<PreviewHarness customCards={[hidden]} ownedCardIds={new Set()} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    const search = screen.getByLabelText("Rechercher un personnage ou un anime");
    fireEvent.change(search, { target: { value: "personnage secret" } });
    expect(screen.queryByText("??? · Carte Transcendance")).toBeNull();
    expect(screen.getByText(/Aucune carte ne correspond à cette recherche/)).toBeTruthy();
    fireEvent.change(search, { target: { value: "serie secrete" } });
    expect(screen.queryByText("??? · Carte Transcendance")).toBeNull();
    rerender(<PreviewHarness customCards={[hidden]} ownedCardIds={new Set(["secret-exclusive"])} />);
    expect(screen.getByText("Personnage secret")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter Personnage secret aux favoris" })).toBeTruthy();
  });

  it("counts the mystery card towards the limit and offers the remaining card", () => {
    const catalog: Card[] = Array.from({ length: 24 }, (_, index) => ({
      id: `page-${index}`,
      name: `Carte ${index}`,
      title: "",
      rarity: "rare",
      description: "",
      sort_order: index,
      category: "shonen",
    }));
    render(<PreviewHarness catalog={catalog} customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    expect(screen.getByRole("dialog").querySelectorAll("article")).toHaveLength(24);
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus (+24)" }));
    expect(screen.getByRole("dialog").querySelectorAll("article")).toHaveLength(25);
    expect(screen.queryByRole("button", { name: "Afficher plus (+24)" })).toBeNull();
  });

  it("omits mythic and legendary animated effects in the preview", () => {
    render(<PreviewHarness customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    const dialog = screen.getByRole("dialog");
    expect(screen.getByText("Rival")).toBeTruthy();
    expect(screen.getByText("Autre")).toBeTruthy();
    expect(dialog.querySelector(".flame-aura, .holo-sheen")).toBeNull();
  });

  it("conceals unowned Transcendances without leaking their identity or art, including in favorites", () => {
    const hidden: CustomTranscendanceCard = {
      id: "secret-exclusive", name: "Personnage secret", anime: "Série secrète",
      image_url: "/secret-portrait.png", pack_ids: ["shonen"], rarity: "Transcendance", series_number: "SECRET-001",
    };
    render(<PreviewHarness customCards={[hidden]} ownedCardIds={new Set()} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    const dialog = screen.getByRole("dialog");
    const article = screen.getByText("??? · Carte Transcendance").closest("article")!;
    expect(article.querySelector(".premium-energy-frame")).toBeTruthy();
    expect(article.querySelector(".transcendance-sparkles-overlay")).toBeNull();
    expect(article.querySelector("img")).toBeNull();
    expect(dialog.innerHTML).not.toContain("Personnage secret");
    expect(dialog.innerHTML).not.toContain("Série secrète");
    expect(dialog.innerHTML).not.toContain("secret-portrait.png");
    expect(dialog.innerHTML).not.toContain("SECRET-001");
    expect(screen.getByText("Héros")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une carte Transcendance mystère aux favoris" }));
    fireEvent.click(screen.getByRole("button", { name: "★ Mes favoris (1)" }));
    expect(screen.getByText("??? · Carte Transcendance")).toBeTruthy();
    expect(dialog.innerHTML).not.toContain("Personnage secret");
  });

  it("reveals only the owned Transcendance and hides it again when ownership is unknown", () => {
    const exclusive: CustomTranscendanceCard = {
      id: "exclusive", name: "Carte acquise", anime: "Anime",
      image_url: "/acquise.png", pack_ids: ["shonen"], rarity: "Transcendance", series_number: "OWN-001",
    };
    const { rerender } = render(<PreviewHarness customCards={[exclusive]} ownedCardIds={new Set(["exclusive"])} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    expect(screen.getByRole("img", { name: "Carte acquise" })).toHaveAttribute("src", "/acquise.png");
    rerender(<PreviewHarness customCards={[exclusive]} ownedCardIds={null} />);
    expect(screen.getByText("??? · Carte Transcendance")).toBeTruthy();
    expect(screen.queryByText("Carte acquise")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Vérification de ta collection");
  });

  it("ignores stale local rarity overrides in the preview", () => {
    localStorage.setItem("zenkai_admin_rarity_overrides", JSON.stringify({ common: "mythique" }));
    render(<PreviewHarness customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    expect(screen.getByRole("button", { name: "★ Mes favoris (0)" })).toBeTruthy();
    expect(screen.getByLabelText("Rechercher un personnage ou un anime")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Éditer les raretés" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Exporter ma config" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Héros").closest("article")).toHaveTextContent("Commune");
  });

  it("only displays an edited rarity after the server confirms it", async () => {
    saveRarityOverride.mockRejectedValueOnce(new Error("refusé")).mockResolvedValueOnce(undefined);
    const error = vi.spyOn(toast, "error");
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PreviewHarness customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    fireEvent.click(screen.getByRole("button", { name: "Éditer les raretés" }));
    const select = screen.getByLabelText("Rareté de Héros");
    fireEvent.change(select, { target: { value: "epique" } });
    await waitFor(() => expect(error).toHaveBeenCalledWith("Impossible d'enregistrer la rareté globale."));
    expect(select).toHaveValue("commune");
    fireEvent.change(select, { target: { value: "epique" } });
    await waitFor(() => expect(select).toHaveValue("epique"));
    expect(saveRarityOverride).toHaveBeenCalledWith("common", "epique");
  });

  it("shows other categories and exclusive cards outside Shonen in the universal preview", () => {
    const sportExclusive: CustomTranscendanceCard = {
      id: "sport-exclusive", name: "Sport exclusif", anime: "Sport", image_url: "",
      pack_ids: ["sport"], rarity: "Transcendance", series_number: "SPORT-001",
    };
    render(<PreviewHarness customCards={[sportExclusive]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    expect(screen.getByText("Autre")).toBeTruthy();
    expect(screen.getByText("Sport exclusif")).toBeTruthy();
    expect(screen.getByText(/règle universelle doit encore être activée/)).toBeTruthy();
  });

  it.each(["shonen", "protagoniste", "zenkai"] as const)("shows Gon Transcendance without animated effects in %s", (pack) => {
    render(<PreviewHarness pack={pack} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    const name = "Gon Freecss · Serment Absolu";
    const article = screen.getByText(name).closest("article");
    expect(article).toHaveTextContent("Transcendance");
    expect(article?.querySelector(".zenkai-transcendance-card")).toBeTruthy();
    expect(article?.querySelector(".zenkai-transcendance-holo")).toBeNull();
    expect(article?.querySelector(".transcendance-sparkles-overlay")).toBeNull();
    expect(article?.querySelector(".premium-awakened-aura, .holo-interactive")).toBeNull();
    expect(article?.closest(".booster-preview-cards")).toBeTruthy();
    expect(article?.querySelector(".tcg-inner-frame")).toBeTruthy();
    expect(article?.querySelector(".relic-seal")).toBeTruthy();
    expect(article?.querySelector(".premium-energy-frame")).toBeTruthy();
    expect(article?.querySelector(".holo-prism")).toBeNull();
    expect(screen.getByRole("img", { name })).toHaveAttribute("src", "/gon%20adulte.webp");
  });

  it.each(["shonen", "protagoniste", "zenkai"] as const)("shows Deku Transcendance in %s", (pack) => {
    render(<PreviewHarness pack={pack} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    const name = "Izuku Midoriya · Vigilante";
    const article = screen.getByText(name).closest("article");
    expect(article).toHaveTextContent("Transcendance");
    expect(article?.querySelector(".premium-energy-frame")).toBeTruthy();
    expect(article?.querySelector(".transcendance-sparkles-overlay")).toBeNull();
    expect(screen.getByRole("img", { name })).toHaveAttribute("src", "/deku%20vigilante.jpg");
  });

  it.each(["shonen", "protagoniste", "zenkai"] as const)("shows Bakugo Transcendance in %s", (pack) => {
    render(<PreviewHarness pack={pack} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    const name = "Katsuki Bakugo · Dynamight";
    const article = screen.getByText(name).closest("article");
    expect(article).toHaveTextContent("Transcendance");
    expect(article?.querySelector(".premium-energy-frame")).toBeTruthy();
    expect(article?.querySelector(".transcendance-sparkles-overlay")).toBeNull();
    expect(screen.getByRole("img", { name })).toHaveAttribute("src", "/katchan.jpg");
    expect(screen.getByRole("img", { name })).toHaveClass("object-cover");
    expect(screen.getByRole("img", { name })).toHaveStyle({ objectPosition: "center", transform: "scale(0.92)" });
  });

  it.each(["shonen", "antagoniste", "zenkai"] as const)("shows Shigaraki Transcendance in %s", (pack) => {
    render(<PreviewHarness pack={pack} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    const name = "Shigaraki Transcendant";
    const article = screen.getByText(name).closest("article");
    expect(article).toHaveTextContent("Transcendance");
    expect(article?.querySelector(".premium-energy-frame")).toBeTruthy();
    expect(article?.querySelector(".transcendance-sparkles-overlay")).toBeNull();
    expect(screen.getByRole("img", { name })).toHaveAttribute("src", "/shigaraki.jpg");
  });

  it.each(["shonen", "protagoniste", "zenkai"] as const)("shows the Demon Slayer cards in %s", (pack) => {
    render(<PreviewHarness pack={pack} catalog={[...cards, ...DEMON_SLAYER_MYTHIC_CARDS]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    const names = ["Tanjiro Kamado", "Nezuko Kamado", "Zenitsu Agatsuma", "Inosuke Hashibira", "Kyojuro Rengoku", "Tengen Uzui", "Giyu Tomioka", "Shinobu Kocho", "Mitsuri Kanroji"];
    const legendary = ["Muichiro Tokito", "Obanai Iguro", "Sanemi Shinazugawa", "Gyomei Himejima"];
    fireEvent.click(screen.getByRole("button", { name: /Mythique.*%/ }));
    for (const name of names) {
      const article = screen.getByText(name).closest("article");
      expect(article).toHaveTextContent("Mythique");
      expect(article?.querySelector(".premium-energy-frame")).toBeNull();
    }
    fireEvent.click(screen.getByRole("button", { name: /Légendaire.*%/ }));
    for (const name of legendary) {
      expect(screen.getByText(name).closest("article")).toHaveTextContent("Légendaire");
    }
    fireEvent.click(screen.getByRole("button", { name: /Transcendance.*%/ }));
    for (const name of [...names, ...legendary]) expect(screen.queryByText(name)).toBeNull();
  });

  it("persists favorites and combines the pack and rarity filters", () => {
    const success = vi.spyOn(toast, "success");
    render(<PreviewHarness customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter Héros aux favoris" }));
    expect(success).toHaveBeenCalledWith("Ajouté à tes cartes favorites ★");
    expect(JSON.parse(localStorage.getItem("zenkai:favorite-cards")!)).toEqual(["common"]);
    expect(screen.getByRole("button", { name: "Retirer Héros des favoris" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "★ Mes favoris (1)" }));
    expect(screen.getByText("Héros")).toBeTruthy();
    expect(screen.queryByText("Rival")).toBeNull();
    expect(screen.queryByText("Carte Transcendance Exclusive à venir")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Mythique.*0,25/ }));
    expect(screen.getByText(/Aucune carte favorite/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Toutes" }));
    fireEvent.click(screen.getByRole("button", { name: "Retirer Héros des favoris" }));
    expect(JSON.parse(localStorage.getItem("zenkai:favorite-cards")!)).toEqual([]);
    expect(screen.getByRole("button", { name: "★ Mes favoris (0)" })).toBeTruthy();
    expect(screen.getByText("Contenu du pack Shonen Mix")).toBeTruthy();
  });

  it("reports storage failures without showing a successful favorite", () => {
    const error = vi.spyOn(toast, "error");
    render(<PreviewHarness customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage"); });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter Héros aux favoris" }));
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Impossible d'enregistrer"));
    expect(screen.getByRole("button", { name: "Ajouter Héros aux favoris" })).toHaveAttribute("aria-pressed", "false");
  });

  it("uses the actual card id for exclusive Transcendance favorites", () => {
    render(<PreviewHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter Goku Ultra Instinct aux favoris" }));
    expect(JSON.parse(localStorage.getItem("zenkai:favorite-cards")!)).toEqual(["goku-ui-transcendance"]);
    fireEvent.click(screen.getByRole("button", { name: "★ Mes favoris (1)" }));
    expect(screen.getByText("Goku Ultra Instinct")).toBeTruthy();
  });

  it("shows a locked Transcendance placeholder and filters by rarity with rates", () => {
    render(<PreviewHarness customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

    expect(screen.getByText("Contenu du pack Shonen Mix")).toBeTruthy();
    expect(screen.getByText("Carte Transcendance Exclusive à venir")).toBeTruthy();
    expect(screen.getAllByText("0,05 %")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Légendaire.*1,2/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Mythique.*0,25/ }));
    expect(screen.getByText("Rival")).toBeTruthy();
    expect(screen.queryByText("Héros")).toBeNull();
    expect(screen.queryByText("Carte Transcendance Exclusive à venir")).toBeNull();
  });

  it("uses the single configured Goku card for Shonen Mix by default", () => {
    render(<PreviewHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

    expect(screen.getByText("Goku Ultra Instinct")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Goku Ultra Instinct" })).toHaveAttribute("src", "/goku%20ui.png");
    expect(screen.queryByText("Carte Transcendance Exclusive à venir")).toBeNull();
  });

  it("shows Mythique Goku Black and Transcendance Goku Black Rosé in both assigned packs", () => {
    for (const pack of ["shonen", "antagoniste"] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      const mythicGokuBlack = screen.getByText("Goku Black").closest("article");
      expect(mythicGokuBlack).toHaveTextContent("Mythique · 0,25 %");
      expect(mythicGokuBlack?.querySelector(".flip-front")).toHaveClass("glow-mythique");
      expect(screen.getByText("Goku Black Rosé")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Goku Black Rosé" })).toHaveAttribute(
        "src",
        "/blackj%20goku%20rose.jpg",
      );
      expect(screen.queryByText("Carte Transcendance Exclusive à venir")).toBeNull();
      unmount();
    }
  });

  it("shows Naruto Mode Baryon in Shonen Mix and Protagoniste previews", () => {
    for (const [pack, label] of [["shonen", "Shonen Mix"], ["protagoniste", "Protagoniste"]] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      expect(screen.getByText(`Contenu du pack ${label}`)).toBeTruthy();
      expect(screen.getByText("Naruto Mode Baryon")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Naruto Mode Baryon" })).toHaveAttribute("src", "/naruto%20bayron.jpg");
      unmount();
    }
  });

  it("shows Borushiki in Shonen Mix and Protagoniste previews", () => {
    for (const [pack, label] of [["shonen", "Shonen Mix"], ["protagoniste", "Protagoniste"]] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      expect(screen.getByText(`Contenu du pack ${label}`)).toBeTruthy();
      expect(screen.getByText("Borushiki")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Borushiki" })).toHaveAttribute("src", "/borushiki.jpg");
      unmount();
    }
  });

  it("shows Ichigo Bankai in Shonen Mix and Protagoniste previews", () => {
    for (const [pack, label] of [["shonen", "Shonen Mix"], ["protagoniste", "Protagoniste"]] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      expect(screen.getByText(`Contenu du pack ${label}`)).toBeTruthy();
      expect(screen.getByText("Ichigo Kurosaki (Bankai)")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Ichigo Kurosaki (Bankai)" })).toHaveAttribute(
        "src",
        "/ichigo%20bankai.webp",
      );
      unmount();
    }
  });

  it("shows Ryomen Sukuna (Fuga) in Antagoniste and Shonen Mix previews", () => {
    for (const [pack, label] of [["antagoniste", "Antagoniste"], ["shonen", "Shonen Mix"]] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      expect(screen.getByText(`Contenu du pack ${label}`)).toBeTruthy();
      expect(screen.getByText("Ryomen Sukuna (Fuga)")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Ryomen Sukuna (Fuga)" })).toHaveAttribute(
        "src",
        "/sukuna%20eveil%201.jpg",
      );
      unmount();
    }
  });

  it("shows Monkey D. Luffy (Gear 5) in Shonen Mix and Protagoniste previews", () => {
    for (const [pack, label] of [["shonen", "Shonen Mix"], ["protagoniste", "Protagoniste"]] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      expect(screen.getByText(`Contenu du pack ${label}`)).toBeTruthy();
      expect(screen.getByText("Monkey D. Luffy (Gear 5)")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Monkey D. Luffy (Gear 5)" })).toHaveAttribute(
        "src",
        "/luffy%20gear%205.jpg",
      );
      unmount();
    }
  });
});
