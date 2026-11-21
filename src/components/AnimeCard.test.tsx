import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimeCard } from "./AnimeCard";
import type { Card } from "@/lib/cards";

const card: Card = {
  id: "test-card",
  name: "Riku Tanaka",
  title: "Lycéen épéiste",
  rarity: "commune",
  description: "",
  sort_order: 1,
  image_url: "/test-card.jpg",
};

describe("AnimeCard illustration", () => {
  it("uses a cropped image and shows the gradient fallback when loading fails", () => {
    render(<AnimeCard card={card} />);
    const illustration = screen.getByRole("img", { name: card.name });

    expect(illustration.tagName).toBe("IMG");
    expect(illustration.classList.contains("object-cover")).toBe(true);

    fireEvent.error(illustration);

    const fallback = screen.getByRole("img", { name: card.name });
    expect(fallback.tagName).toBe("DIV");
    expect(fallback.classList.contains("card-art-fallback")).toBe(true);
  });
});
