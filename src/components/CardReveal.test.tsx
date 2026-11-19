import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CardReveal } from "./CardReveal";
import type { PulledCard } from "@/lib/cards";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));

const cards: PulledCard[] = [
  { id: "riku", name: "Riku Tanaka", title: "Lycéen épéiste", rarity: "commune" as const, description: "", sort_order: 1 },
  { id: "kaito", name: "Kaito Ren", title: "Samouraï", rarity: "rare" as const, description: "", sort_order: 5 },
  { id: "ryujin", name: "Ryujin", title: "Dieu-dragon", rarity: "legendaire" as const, description: "", sort_order: 10 },
].map((card, i) => ({ userCardId: `uc-${i}`, card }));

describe("booster reveal one card at a time", () => {
  it("reveals on the first card click and advances only on the second click", () => {
    render(<CardReveal cards={cards} onDone={() => {}} />);
    const hidden = screen.getByRole("button", { name: "Retourner la carte" });
    hidden.setPointerCapture = vi.fn();
    fireEvent.pointerDown(hidden, { clientX: 0, pointerId: 1 });
    fireEvent.pointerUp(hidden);
    fireEvent.click(hidden);
    fireEvent.click(screen.getByRole("button", { name: "Riku Tanaka, Commune" }));
    fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
    expect(screen.getByRole("button", { name: "Kaito Ren, Rare" })).toBeTruthy();
  });
  it("opens the summary by clicking the last revealed card", () => {
    const onDone = vi.fn();
    render(<CardReveal cards={cards} onDone={onDone} />);
    for (const item of cards) {
      fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
      const rarity = item.card.rarity === "commune" ? "Commune" : item.card.rarity === "rare" ? "Rare" : "Légendaire";
      fireEvent.click(screen.getByRole("button", { name: `${item.card.name}, ${rarity}` }));
    }
    expect(onDone).toHaveBeenCalledTimes(1);
  });
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
