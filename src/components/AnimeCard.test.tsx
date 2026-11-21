import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("fills the hidden card face with the provided full-bleed card-back image", () => {
    const { container } = render(
      <AnimeCard
        card={card}
        flipped={false}
        backTheme={{
          image: "/image_39f4fe98.jpg",
        }}
      />,
    );
    const back = container.querySelector(".flip-face");
    const scene = container.querySelector(".flip-scene");
    const artwork = container.querySelector(".flip-face img");

    expect(scene).toHaveClass("aspect-[2.5/3.5]");
    expect(artwork).toHaveAttribute("src", "/image_39f4fe98.jpg");
    expect(artwork).toHaveClass(
      "h-full",
      "w-full",
      "object-cover",
      "rounded-2xl",
      "scale-[1.12]",
    );
    expect(artwork?.parentElement).toHaveClass("overflow-hidden", "rounded-2xl");
    expect(back).toHaveClass("bg-transparent");
    expect(back).not.toHaveClass("border", "tcg-card-back", "bg-black", "bg-neutral-950", "bg-zinc-950");
  });

  it("shows a gold Goku fallback only while the custom image is unavailable", () => {
    const { container } = render(
      <AnimeCard card={{ ...card, id: "goku-ui-transcendance", image_url: "/goku%20ui.png" }} customTranscendance />,
    );
    const image = container.querySelector("img");

    expect(container.querySelector(".custom-transcendance-fallback")).toBeTruthy();
    if (!image) throw new Error("Expected custom Transcendance art.");
    fireEvent.load(image);
    expect(container.querySelector(".custom-transcendance-fallback")).toBeNull();
  });

  it("adds the animated prism and cursor-following hologram only to Transcendance cards", () => {
    const { container } = render(<AnimeCard card={card} customTranscendance />);
    const scene = container.querySelector(".flip-scene");
    const tilt = container.querySelector(".holo-tilt");
    const artwork = container.querySelector("img.reverse-art");

    expect(container.querySelector(".premium-energy-frame")).toBeTruthy();
    expect(container.querySelector(".holo-prism")).toBeTruthy();
    expect(container.querySelector(".holo-glitter")).toBeTruthy();
    expect(container.querySelector(".transcendence-cosmic-bg")).toHaveClass("z-0");
    expect(container.querySelector(".holo-prism")).toHaveClass("z-10");
    expect(container.querySelector(".premium-energy-frame")).toHaveClass("z-30");
    expect(artwork).toHaveClass("z-20", "h-full", "w-full", "object-cover", "mix-blend-normal", "opacity-100");
    expect(container.querySelector(".premium-rarity-badge")?.parentElement).toHaveClass("z-30");
    const name = container.querySelector(".premium-glass-label p");
    expect(name).toHaveClass("text-white", "drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]");
    expect(name).not.toHaveClass("tcg-nameplate", "border");
    expect(name?.parentElement).toHaveClass("z-30");
    if (!(scene instanceof HTMLDivElement) || !(tilt instanceof HTMLDivElement)) {
      throw new Error("Expected the Transcendance card scene and tilt layer.");
    }
    vi.spyOn(scene, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 280, width: 200, height: 280, toJSON: () => ({}),
    });
    fireEvent.pointerMove(scene, { clientX: 150, clientY: 70 });
    expect(tilt).toHaveAttribute("data-active", "true");

    const { container: regularContainer } = render(<AnimeCard card={card} />);
    expect(regularContainer.querySelector(".premium-energy-frame")).toBeNull();
    expect(regularContainer.querySelector(".holo-prism")).toBeNull();
  });

  it("uses the divine rose aura for Goku Black Rosé without changing the full-art source", () => {
    const roseCard = {
      ...card,
      id: "goku-black-rose-transcendance",
      name: "Goku Black Rosé",
      image_url: "/blackj%20goku%20rose.jpg",
    };
    const { container } = render(<AnimeCard card={roseCard} customTranscendance />);

    expect(container.querySelector(".flip-front")).toHaveAttribute("data-transcendence-id", roseCard.id);
    expect(container.querySelector(".holo-tilt")).toHaveAttribute("data-transcendence-id", roseCard.id);
    expect(screen.getByRole("img", { name: roseCard.name })).toHaveAttribute("src", roseCard.image_url);
    expect(screen.getByRole("img", { name: roseCard.name })).toHaveClass("mix-blend-normal", "opacity-100", "z-20");
  });

  it("uses a solar red aura for Naruto Mode Baryon while preserving the original art layer", () => {
    const narutoCard = {
      ...card,
      id: "naruto-baryon-transcendance",
      name: "Naruto Mode Baryon",
      image_url: "/naruto%20bayron.jpg",
    };
    const { container } = render(<AnimeCard card={narutoCard} customTranscendance />);

    expect(container.querySelector(".flip-front")).toHaveAttribute("data-transcendence-id", narutoCard.id);
    expect(container.querySelector(".holo-tilt")).toHaveAttribute("data-transcendence-id", narutoCard.id);
    expect(screen.getByRole("img", { name: narutoCard.name })).toHaveAttribute("src", narutoCard.image_url);
    expect(screen.getByRole("img", { name: narutoCard.name })).toHaveClass("mix-blend-normal", "opacity-100", "z-20");
  });

  it("uses a Karma blue-violet aura for Borushiki while keeping its art untouched", () => {
    const borushikiCard = {
      ...card,
      id: "borushiki-transcendance",
      name: "Borushiki",
      image_url: "/borushiki.jpg",
    };
    const { container } = render(<AnimeCard card={borushikiCard} customTranscendance />);

    expect(container.querySelector(".flip-front")).toHaveAttribute("data-transcendence-id", borushikiCard.id);
    expect(container.querySelector(".holo-tilt")).toHaveAttribute("data-transcendence-id", borushikiCard.id);
    expect(screen.getByRole("img", { name: borushikiCard.name })).toHaveAttribute("src", borushikiCard.image_url);
    expect(screen.getByRole("img", { name: borushikiCard.name })).toHaveClass(
      "mix-blend-normal",
      "opacity-100",
      "z-20",
    );
  });

  it("uses a blood-red and gold aura for Ichigo Bankai without blending the portrait", () => {
    const ichigoCard = {
      ...card,
      id: "ichigo-bankai-transcendance",
      name: "Ichigo Kurosaki (Bankai)",
      image_url: "/ichigo%20bankai.webp",
    };
    const { container } = render(<AnimeCard card={ichigoCard} customTranscendance />);

    expect(container.querySelector(".flip-front")).toHaveAttribute("data-transcendence-id", ichigoCard.id);
    expect(container.querySelector(".holo-tilt")).toHaveAttribute("data-transcendence-id", ichigoCard.id);
    expect(screen.getByRole("img", { name: ichigoCard.name })).toHaveAttribute("src", ichigoCard.image_url);
    expect(screen.getByRole("img", { name: ichigoCard.name })).toHaveClass(
      "mix-blend-normal",
      "opacity-100",
      "z-20",
    );
  });

  it("uses a blood-red and incandescent orange aura for Ryomen Sukuna (Fuga)", () => {
    const sukunaCard = {
      ...card,
      id: "sukuna-fuga-transcendance",
      name: "Ryomen Sukuna (Fuga)",
      image_url: "/sukuna%20eveil%201.jpg",
    };
    const { container } = render(<AnimeCard card={sukunaCard} customTranscendance />);

    expect(container.querySelector(".flip-front")).toHaveAttribute("data-transcendence-id", sukunaCard.id);
    expect(container.querySelector(".holo-tilt")).toHaveAttribute("data-transcendence-id", sukunaCard.id);
    expect(screen.getByRole("img", { name: sukunaCard.name })).toHaveAttribute("src", sukunaCard.image_url);
    expect(screen.getByRole("img", { name: sukunaCard.name })).toHaveClass(
      "mix-blend-normal",
      "opacity-100",
      "z-20",
    );
  });

  it("uses a pearly white and divine gold aura for Monkey D. Luffy (Gear 5)", () => {
    const luffyCard = {
      ...card,
      id: "luffy-gear-5-transcendance",
      name: "Monkey D. Luffy (Gear 5)",
      image_url: "/luffy%20gear%205.jpg",
      transcendance_series_number: "ZEN-007-TR",
    };
    const { container } = render(<AnimeCard card={luffyCard} customTranscendance />);

    expect(container.querySelector(".flip-front")).toHaveAttribute("data-transcendence-id", luffyCard.id);
    expect(container.querySelector(".holo-tilt")).toHaveAttribute("data-transcendence-id", luffyCard.id);
    expect(container.querySelector(".premium-bottom-shade")).toBeTruthy();
    expect(container.querySelector(".premium-holo-sweep")).toBeTruthy();
    expect(container.textContent).toContain("ZEN-007-TR");
    expect(screen.getByRole("img", { name: luffyCard.name })).toHaveAttribute("src", luffyCard.image_url);
    expect(screen.getByRole("img", { name: luffyCard.name })).toHaveClass(
      "mix-blend-normal",
      "opacity-100",
      "z-20",
    );
  });
});
