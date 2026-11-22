import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { BoosterPack } from "./BoosterPack";
import { CARD_BACK_BY_PACK, PACK_ARTWORK, PACK_ARTWORK_BY_PACK } from "@/lib/cards";

describe("BoosterPack tearing animation", () => {
  it("accepts a horizontal pointer gesture or keyboard activation while opening", () => {
    const onTear = vi.fn();
    const { rerender } = render(<BoosterPack state="opening" onTear={onTear} />);
    const pack = screen.getByRole("button", { name: "Déchirer le booster" });
    fireEvent(pack, new MouseEvent("pointerdown", { bubbles: true, clientX: 100 }));
    fireEvent(pack, new MouseEvent("pointermove", { bubbles: true, clientX: 70 }));
    expect(onTear).not.toHaveBeenCalled();
    fireEvent(pack, new MouseEvent("pointermove", { bubbles: true, clientX: 40 }));
    fireEvent(pack, new MouseEvent("pointermove", { bubbles: true, clientX: 20 }));
    expect(onTear).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(pack, { key: "Enter" });
    expect(onTear).toHaveBeenCalledTimes(2);
    rerender(<BoosterPack state="tearing" onTear={onTear} />);
    expect(screen.queryByRole("button", { name: "Déchirer le booster" })).toBeNull();
  });

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
      "rounded-xl",
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
        "object-center",
        "rounded-xl",
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

  it("uses the cropped Shojo artwork on both torn halves and its exclusive card back", () => {
    const { container } = render(
      <BoosterPack state="tearing" artwork={PACK_ARTWORK_BY_PACK.shojo} backImage={CARD_BACK_BY_PACK.shojo} />,
    );
    const images = container.querySelectorAll(".pack-art-image");
    expect(images).toHaveLength(2);
    images.forEach((image) => {
      expect(image).toHaveAttribute("src", "/pack-shojo-aligned.png");
      expect(image).toHaveClass("h-full", "w-full", "object-cover", "object-center");
      expect(image.closest(".pack-art")).toHaveClass("overflow-hidden");
    });
    const back = container.querySelector(".pack-first-card img");
    expect(back).toHaveAttribute("src", "/card-back-shojo.png");
    expect(back).toHaveClass("h-full", "w-full", "rounded-[inherit]", "object-center", "scale-[1.22]");
    expect(back?.parentElement).toHaveClass("overflow-hidden", "rounded-xl", "w-48", "h-[268px]");
  });

  it("uses the Protagoniste artwork on both aligned torn halves", () => {
    const { container } = render(<BoosterPack state="tearing" artwork={PACK_ARTWORK_BY_PACK.protagoniste} />);
    const images = container.querySelectorAll(".pack-art-image");
    expect(images).toHaveLength(2);
    images.forEach((image) => {
      expect(image).toHaveAttribute("src", "/pack-protagoniste.png");
      expect(image).toHaveClass("h-full", "w-full", "object-cover", "object-center");
      expect(image.closest(".pack-art")).toHaveClass("overflow-hidden", "w-48", "h-80");
    });
  });

  it.each(Object.entries(PACK_ARTWORK_BY_PACK))("uses the same opening template for %s", (_pack, artwork) => {
    const { container } = render(<BoosterPack state="tearing" artwork={artwork} />);
    const images = container.querySelectorAll(".pack-art-image");
    expect(images).toHaveLength(2);
    images.forEach((image) => {
      expect(image).toHaveAttribute("src", artwork);
      expect(image).toHaveClass("h-full", "w-full", "object-cover", "object-center");
      expect(image.className).not.toMatch(/scale-/);
      expect(image.closest(".pack-art")).toHaveClass("w-48", "h-80", "overflow-hidden", "rounded-xl");
    });
  });

  it("keeps the aligned artwork canvases at the Shonen reference dimensions", () => {
    for (const pack of ["seinen", "shojo", "sport", "antagoniste", "protagoniste"] as const) {
      const image = readFileSync(`public${PACK_ARTWORK_BY_PACK[pack]}`);
      expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(image.readUInt32BE(16)).toBe(896);
      expect(image.readUInt32BE(20)).toBe(1185);
    }
  });
});
