import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CardReveal } from "./CardReveal";
import type { PulledCard } from "@/lib/cards";
import { sortBoosterCardsByRarity } from "@/lib/booster-order";
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
    const { container } = render(<CardReveal cards={cards} onDone={() => {}} />);
    expect(screen.getAllByRole("button", { name: "Retourner la carte" })).toHaveLength(1);
    expect(container.querySelectorAll(".flip-scene")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Carte suivante/ })).toBeNull();
  });

  it("keeps the selected pack back mounted during the flip", () => {
    const { container } = render(
      <CardReveal
        cards={cards}
        onDone={() => {}}
        backTheme={{
          image: "/image_39f4fe98.jpg",
        }}
      />,
    );
    const packArt = container.querySelector(".flip-face img");

    expect(packArt).toHaveAttribute("src", "/image_39f4fe98.jpg");
    expect(packArt).toHaveClass("scale-[1.12]", "object-cover");
    fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
    expect(container.querySelector(".flip-face img")).toBe(packArt);
  });

  it("flips on click, then moves to the next card with 'Carte suivante'", () => {
    const { container } = render(<CardReveal cards={cards} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
    expect(screen.getByRole("button", { name: "Riku Tanaka, Commune" })).toBeTruthy();
    expect(container.querySelector(".card-personal-halo, .animate-suspense")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Carte suivante/ }));
    expect(screen.getByRole("button", { name: "Retourner la carte" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Riku Tanaka, Commune" })).toBeNull();
    expect(container.querySelectorAll(".flip-scene")).toHaveLength(1);
  });

  it("shows a rarity halo before the flip and flashes an epic card when revealed", () => {
    const epicCard = { ...cards[1]!.card, rarity: "epique" as const };
    const { container } = render(
      <CardReveal cards={[{ userCardId: "uc-epic", card: epicCard }]} onDone={() => {}} />,
    );

    expect(container.querySelector(".rarity-glow-layer")).toHaveAttribute("data-glow", "pulse");
    expect(container.querySelector(".rarity-glow-blur")).toBeTruthy();
    expect(container.querySelector(".rarity-glow-flash")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
    expect(container.querySelector(".rarity-glow-flash")).toBeTruthy();
  });

  it("adds golden particles around a legendary card before it is revealed", () => {
    const legendaryCard = { ...cards[2]!.card, rarity: "legendaire" as const };
    const { container } = render(
      <CardReveal cards={[{ userCardId: "uc-legendary", card: legendaryCard }]} onDone={() => {}} />,
    );

    expect(container.querySelector(".rarity-glow-layer")).toHaveAttribute("data-glow", "double");
    expect(container.querySelectorAll(".rarity-glow-particle")).toHaveLength(6);
  });

  it("vibrates the Transcendance card back and flashes when the card is revealed", () => {
    const card = {
      ...cards[2]!.card,
      id: "goku-ui-transcendance",
      name: "Goku Ultra Instinct",
      rarity: "mythique" as const,
      image_url: "/goku%20ui.png",
    };
    const { container } = render(
      <CardReveal
        cards={[{ userCardId: "uc-goku-ui", card, customTranscendance: true }]}
        onDone={() => {}}
      />,
    );

    expect(container.querySelector(".relative.isolate")).toHaveClass("card-reveal-transcendence");
    expect(container.querySelector(".transcendence-card-anticipation")).toBeTruthy();
    expect(container.querySelectorAll(".rarity-glow-particle")).toHaveLength(16);
    expect(container.querySelector(".transcendence-reveal-flash")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));

    expect(container.querySelector(".transcendence-card-anticipation")).toBeNull();
    expect(container.querySelector(".transcendence-reveal-flash")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Goku Ultra Instinct, Transcendance" })).toBeTruthy();
  });

  it("reveals a sorted booster from the lowest rarity to the highest", () => {
    const unsorted: PulledCard[] = [
      { userCardId: "uc-rare", card: cards[1]!.card },
      { userCardId: "uc-common", card: cards[0]!.card },
      {
        userCardId: "uc-transcendance",
        card: { ...cards[2]!.card, id: "goku-ui", name: "Goku UI", rarity: "mythique" },
        customTranscendance: true,
      },
      {
        userCardId: "uc-uncommon",
        card: { ...cards[0]!.card, id: "mei", name: "Mei", rarity: "non_commune" },
      },
      {
        userCardId: "uc-mythic",
        card: { ...cards[0]!.card, id: "goku", name: "Goku", rarity: "mythique" },
      },
    ];
    const ordered = sortBoosterCardsByRarity(unsorted);
    const labels = [
      "Riku Tanaka, Commune",
      "Mei, Peu Commune",
      "Kaito Ren, Rare",
      "Goku, Mythique",
      "Goku UI, Transcendance",
    ];

    render(<CardReveal cards={ordered} onDone={() => {}} />);
    for (let index = 0; index < labels.length; index++) {
      const label = labels[index];
      if (!label) throw new Error(`Missing expected card label at index ${index}.`);
      fireEvent.click(screen.getByRole("button", { name: "Retourner la carte" }));
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
      if (index < labels.length - 1) {
        fireEvent.click(screen.getByRole("button", { name: /Carte suivante/ }));
      }
    }
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
