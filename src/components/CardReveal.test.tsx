import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CardReveal } from "./CardReveal";
import type { Card } from "@/lib/cards";

const cards: Card[] = [
  { id: "riku", name: "Riku Tanaka", title: "Lycéen épéiste", rarity: "commune", description: "", sort_order: 1 },
  { id: "kaito", name: "Kaito Ren", title: "Samouraï", rarity: "rare", description: "", sort_order: 5 },
  { id: "ryujin", name: "Ryujin", title: "Dieu-dragon", rarity: "legendaire", description: "", sort_order: 10 },
];

describe("booster reveal one card at a time", () => {
  it("starts with a single face-down card and no next button", () => {
    render(<CardReveal cards={cards} onDone={() => {}} />);
    expect(screen.getAllByRole("button", { name: "Retourner la carte" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Carte suivante/ })).toBeNull();
  });

  it("flips on click, then moves to the next card with 'Carte suivante'", () => {
    render(<CardReveal cards={cards} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
    expect(screen.getByRole("button", { name: "Riku Tanaka, Commune" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Carte suivante/ }));
    expect(screen.getByRole("button", { name: "Retourner la carte" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Riku Tanaka, Commune" })).toBeNull();
  });

  it("shows the summary after the 3rd card", () => {
    const onDone = vi.fn();
    render(<CardReveal cards={cards} onDone={onDone} />);
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
      fireEvent.click(screen.getByRole("button", { name: /Carte suivante/ }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
    expect(screen.queryByRole("button", { name: /Carte suivante/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Voir le récapitulatif/ }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
