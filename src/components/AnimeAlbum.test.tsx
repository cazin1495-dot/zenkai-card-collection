import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnimeAlbum } from "./AnimeAlbum";
import { getGuestBalance } from "@/lib/guest-collection";
import type { Card } from "@/lib/cards";

vi.mock("@/components/Transcendance", () => ({ InspectableCard: ({ card }: { card: Card }) => <div>{card.name}</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const cards: Card[] = [
  { id: "a", name: "Alpha", title: "", description: "", rarity: "rare", sort_order: 0, series: "Série A", image_url: "/alpha.png" },
  { id: "b", name: "Bêta", title: "", description: "", rarity: "mythique", sort_order: 1, series: "Série A", image_url: "/beta.png" },
  { id: "c", name: "Gamma", title: "", description: "", rarity: "commune", sort_order: 2, series: "Série B" },
];

describe("anime album", () => {
  beforeEach(() => localStorage.clear());
  it("counts unique owned ids, locks missing cards and claims a completed series once", () => {
    const copies = [{ card_id: "a", transcended: false }, { card_id: "a", transcended: true }];
    const { rerender, unmount } = render(<AnimeAlbum cards={cards} copies={copies} userId={null} />);
    const series = screen.getByRole("heading", { name: "Série A" }).closest("section")!;
    expect(within(series).getByText("1 / 2 cartes débloquées")).toBeTruthy();
    expect(within(series).getByText("Mythique · Verrouillée")).toBeTruthy();
    expect(within(series).getByRole("button")).toBeDisabled();
    rerender(<AnimeAlbum cards={cards} copies={[...copies, { card_id: "b", transcended: false }]} userId={null} />);
    fireEvent.click(within(series).getByRole("button"));
    expect(getGuestBalance()).toBe(1000);
    expect(within(series).getByRole("button")).toBeDisabled();
    unmount();
    render(<AnimeAlbum cards={cards} copies={[...copies, { card_id: "b", transcended: false }]} userId={null} />);
    expect(screen.getByRole("button", { name: "Réclamée · Titre Maître Série A" })).toBeDisabled();
  });
});
