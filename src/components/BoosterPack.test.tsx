import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoosterPack } from "./BoosterPack";
import { PACK_ARTWORK } from "@/lib/cards";

describe("BoosterPack tearing animation", () => {
  it("uses the original public booster image", () => {
    expect(PACK_ARTWORK).toBe("/image_c1811ac7.jpg");
  });

  it("uses a horizontal tear and reveals the card back behind the pack", () => {
    const { container } = render(<BoosterPack state="tearing" />);

    expect(container.querySelector(".pack-card-stack, .pack-stack-card")).toBeNull();
    const sleeve = container.querySelector<HTMLElement>(".pack-sleeve");
    const cap = container.querySelector<HTMLElement>(".pack-cap-peel");
    expect(sleeve?.style.clipPath).toContain("15%");
    expect(cap?.style.clipPath).toContain("85%");
    const revealedCard = container.querySelector(".pack-first-card");
    const cardBack = container.querySelector(".pack-first-card img");
    expect(revealedCard).toHaveClass(
      "w-48",
      "h-[268px]",
      "overflow-hidden",
      "rounded-2xl",
      "bg-transparent",
    );
    expect(cardBack).toHaveAttribute("src", "/image_39f4fe98.jpg");
    expect(cardBack).toHaveClass("h-full", "w-full", "object-cover", "scale-[1.12]");
    expect(container.querySelector(".pack-art-glint, .pack-god-ray, .pack-seam-ray, .pack-opening-shard")).toBeNull();

    const packImages = container.querySelectorAll(".pack-art-image");
    expect(packImages).toHaveLength(2);
    for (const image of packImages) {
      expect(image).toHaveAttribute("src", PACK_ARTWORK);
      expect(image).toHaveClass(
        "object-cover",
        "rounded-xl",
        "scale-x-[1.15]",
        "scale-y-[1.12]",
        "drop-shadow-[0_15px_35px_rgba(168,85,247,0.35)]",
      );
    }
    expect(container.querySelector(".pack-art-css")).toHaveClass(
      "overflow-hidden",
      "rounded-xl",
      "w-48",
      "h-80",
    );
    expect(container.querySelector(".pack-body")?.className).not.toMatch(/\b(?:bg-|border|shadow-)/);
    expect(container.querySelector(".pack-category-badge")).toHaveTextContent("ZENKAI");
  });
});
