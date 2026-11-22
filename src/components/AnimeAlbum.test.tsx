import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnimeAlbum } from "./AnimeAlbum";
import { getGuestBalance } from "@/lib/guest-collection";
import type { Card } from "@/lib/cards";

vi.mock("@/components/Transcendance", () => ({
  InspectableCard: ({ card }: { card: Card }) => <div>{card.name}</div>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const cards: Card[] = [
  {
    id: "a",
    name: "Alpha",
    title: "",
    description: "",
    rarity: "rare",
    sort_order: 0,
    series: "Série A",
    image_url: "/alpha.png",
  },
  {
    id: "b",
    name: "Bêta",
    title: "",
    description: "",
    rarity: "mythique",
    sort_order: 1,
    series: "Série A",
    image_url: "/beta.png",
  },
  {
    id: "c",
    name: "Gamma",
    title: "",
    description: "",
    rarity: "commune",
    sort_order: 2,
    series: "Série B",
  },
];

describe("anime album", () => {
  beforeEach(() => localStorage.clear());
  it("counts unique owned ids, locks missing cards and claims a completed series once", () => {
    const copies = [
      { card_id: "a", transcended: false },
      { card_id: "a", transcended: true },
    ];
    const { rerender, unmount } = render(
      <AnimeAlbum cards={cards} copies={copies} userId={null} />,
    );
    expect(screen.getByRole("button", { name: /Série A.*1 \/ 2 cartes débloquées/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Série A/ }));
    const series = screen.getByRole("heading", { name: "Série A" }).closest("section")!;
    expect(within(series).getByText("1 / 2 cartes débloquées")).toBeTruthy();
    expect(within(series).getByText("Mythique · Verrouillée")).toBeTruthy();
    expect(within(series).getByRole("button")).toBeDisabled();
    rerender(
      <AnimeAlbum
        cards={cards}
        copies={[...copies, { card_id: "b", transcended: false }]}
        userId={null}
      />,
    );
    fireEvent.click(within(series).getByRole("button"));
    expect(getGuestBalance()).toBe(1000);
    expect(within(series).getByRole("button")).toBeDisabled();
    unmount();
    render(
      <AnimeAlbum
        cards={cards}
        copies={[...copies, { card_id: "b", transcended: false }]}
        userId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Série A/ }));
    expect(screen.getByRole("button", { name: "Réclamée · Titre Maître Série A" })).toBeDisabled();
  });

  it("recherche les animes et affiche seulement l'album sélectionné, puis revient à la liste", () => {
    render(<AnimeAlbum cards={cards} copies={[]} userId={null} />);
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getByRole("button", { name: /Série B.*0 \/ 1 cartes débloquées/ })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher un anime" }), {
      target: { value: "serie b" },
    });
    expect(screen.queryByRole("button", { name: /Série A/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Série B/ }));
    expect(screen.getByRole("heading", { name: "Série B" })).toBeTruthy();
    expect(screen.getByText("Gamma")).toBeTruthy();
    expect(screen.queryByText("Alpha")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "← Retour à la liste des animes" }));
    expect(screen.getByRole("searchbox", { name: "Rechercher un anime" })).toHaveValue("serie b");
    expect(screen.getByRole("button", { name: /Série B/ })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher un anime" }), {
      target: { value: "introuvable" },
    });
    expect(screen.getByText("Aucun anime ne correspond à la recherche.")).toBeTruthy();
  });
});
