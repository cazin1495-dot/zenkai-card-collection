import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnimeCard } from "./AnimeCard";
import { InspectableCard } from "./Transcendance";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "@/lib/transcendance-cards";
import { DEMON_SLAYER_MYTHIC_CARDS, type Card } from "@/lib/cards";

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
  it("renders Demon Slayer cards with the normal Mythique styling", () => {
    for (const character of DEMON_SLAYER_MYTHIC_CARDS) {
      const { container, unmount } = render(<AnimeCard card={character} />);
      const image = screen.getByRole("img", { name: character.name });
      expect(image).toHaveAttribute("src", character.image_url);
      expect(image).toHaveClass("object-cover");
      expect(image).toHaveStyle({ objectPosition: "center", transform: "scale(0.92)" });
      expect(container.querySelector(".flip-front")).toHaveClass("glow-mythique");
      expect(container.querySelector(".premium-energy-frame")).toBeNull();
      expect(container.querySelector(".transcendance-sparkles-overlay")).toBeNull();
      expect(screen.getByText("Mythique")).toBeTruthy();
      unmount();
    }
  });

  it("renders Shigaraki with Bakugo's layout and centered artwork", () => {
    const bakugo = CUSTOM_TRANSCENDANCE_CARDS.find((item) => item.id === "trans-bakugo");
    const shigaraki = CUSTOM_TRANSCENDANCE_CARDS.find((item) => item.id === "trans-shigaraki");
    if (!bakugo || !shigaraki) throw new Error("Carte Transcendance absente.");
    const { container } = render(<AnimeCard card={customTranscendanceAsCard(shigaraki)} customTranscendance />);
    const { container: reference } = render(<AnimeCard card={customTranscendanceAsCard(bakugo)} customTranscendance />);
    const image = screen.getByRole("img", { name: shigaraki.name });
    expect(image).toHaveAttribute("src", "/shigaraki.jpg");
    expect(image).toHaveClass("object-cover");
    expect(image).toHaveStyle({ objectPosition: "center", transform: "scale(0.92)" });
    for (const selector of [".flip-scene", ".holo-tilt", ".flip-front", ".premium-energy-frame", ".premium-awakened-aura", ".tcg-inner-frame", ".premium-glass-label", ".transcendance-sparkles-overlay"]) {
      expect(container.querySelector(selector)).toHaveClass(...Array.from(reference.querySelector(selector)!.classList));
    }
    expect(container.querySelector(".flip-front")).toHaveAttribute("data-transcendence-id", "trans-shigaraki");
  });

  it("renders the Gon exclusive with the shared frame, sparkles, and tilt", () => {
    const gon = CUSTOM_TRANSCENDANCE_CARDS.find((item) => item.id === "trans-gon");
    const goku = CUSTOM_TRANSCENDANCE_CARDS.find((item) => item.id === "goku-ui-transcendance");
    if (!gon) throw new Error("Gon Transcendance absent.");
    if (!goku) throw new Error("Goku Transcendance absent.");
    const { container } = render(<InspectableCard card={customTranscendanceAsCard(gon)} customTranscendance />);
    const { container: reference } = render(<InspectableCard card={customTranscendanceAsCard(goku)} customTranscendance />);
    expect(screen.getByRole("img", { name: gon.name })).toHaveAttribute("src", "/gon%20adulte.webp");
    for (const selector of [
      ".flip-scene", ".holo-tilt", ".flip-front", ".zenkai-transcendance-card", ".premium-energy-frame",
      ".transcendance-sparkles-overlay",
      ".premium-awakened-aura", ".tcg-inner-frame", ".premium-glass-label",
    ]) {
      const actual = container.querySelector(selector);
      const expected = reference.querySelector(selector);
      expect(actual, selector).toBeTruthy();
      expect(expected, selector).toBeTruthy();
      expect(actual?.className, selector).toBe(expected?.className);
    }
    const scene = container.querySelector(".flip-scene");
    const tilt = container.querySelector(".holo-tilt");
    if (!(scene instanceof HTMLDivElement) || !(tilt instanceof HTMLDivElement)) {
      throw new Error("Expected the Gon Transcendance scene and tilt layer.");
    }
    vi.spyOn(scene, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 280, width: 200, height: 280, toJSON: () => ({}),
    });
    fireEvent(scene, new MouseEvent("pointermove", { bubbles: true, clientX: 150, clientY: 70 }));
    expect(tilt).toHaveAttribute("data-active", "true");
    expect(tilt.style.getPropertyValue("--holo-x")).toBe("75%");
    expect(tilt.style.getPropertyValue("--holo-y")).toBe("25%");
    fireEvent.pointerLeave(scene);
    expect(tilt).toHaveAttribute("data-active", "false");
  });

  it("uses a cropped image and shows the gradient fallback when loading fails", () => {
    render(<AnimeCard card={card} />);
    const illustration = screen.getByRole("img", { name: card.name });

    expect(illustration.tagName).toBe("IMG");
    expect(illustration.classList.contains("object-cover")).toBe(true);
    expect(illustration).toHaveStyle({ objectPosition: "center top" });

    fireEvent.error(illustration);

    const fallback = screen.getByRole("img", { name: card.name });
    expect(fallback.tagName).toBe("DIV");
    expect(fallback.classList.contains("card-art-fallback")).toBe(true);
  });

  it("applies the custom portrait position in normal and comparison faces", () => {
    const bakugo = CUSTOM_TRANSCENDANCE_CARDS.find((item) => item.id === "trans-bakugo");
    if (!bakugo) throw new Error("Bakugo Transcendance absent.");
    const card = customTranscendanceAsCard(bakugo);
    const { container: face, unmount } = render(<AnimeCard card={card} />);
    expect(screen.getByRole("img", { name: bakugo.name })).toHaveAttribute("src", "/katchan.jpg");
    expect(screen.getByRole("img", { name: bakugo.name })).toHaveStyle({ objectPosition: "center", transform: "scale(0.92)" });
    expect(face.querySelector(".flip-front")).toHaveStyle({ backgroundColor: "#0a0a0a" });
    unmount();
    const { container } = render(<AnimeCard card={card} comparisonForm="base" />);
    const portraits = container.querySelectorAll("img.form-portrait");
    expect(portraits).toHaveLength(2);
    portraits.forEach((portrait) => expect(portrait).toHaveStyle({ objectPosition: "center", transform: "scale(0.92)" }));
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
      "rounded-xl",
      "scale-[1.12]",
    );
    expect(artwork?.parentElement).toHaveClass("overflow-hidden", "rounded-xl");
    expect(back).toHaveClass("bg-transparent");
    expect(back).not.toHaveClass("border", "tcg-card-back", "bg-black", "bg-neutral-950", "bg-zinc-950");
  });

  it("crops the Shojo card back while keeping the flip faces mounted", () => {
    const { container, rerender } = render(<AnimeCard card={card} flipped={false} backTheme={{ image: "/card-back-shojo.png" }} />);
    const back = container.querySelector(".flip-face img");
    expect(back).toHaveAttribute("src", "/card-back-shojo.png");
    expect(back).toHaveClass("w-full", "h-full", "object-cover", "object-center", "scale-[1.22]", "rounded-[inherit]");
    expect(back?.parentElement).toHaveClass("overflow-hidden", "rounded-xl");
    rerender(<AnimeCard card={card} flipped backTheme={{ image: "/card-back-shojo.png" }} />);
    expect(container.querySelector(".flip-inner")).toHaveClass("flipped");
    expect(container.querySelector(".flip-face img")).toBe(back);
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

  it("preserves the artwork beneath transparent sparkles and a rainbow frame", () => {
    const { container } = render(<AnimeCard card={card} customTranscendance />);
    const scene = container.querySelector(".flip-scene");
    const tilt = container.querySelector(".holo-tilt");
    const artwork = container.querySelector("img.reverse-art");

    expect(container.querySelector(".premium-energy-frame")).toBeTruthy();
    expect(container.querySelector(".zenkai-transcendance-holo, .holo-prism, .holo-glitter, .reverse-foil, .tcg-light-sweep, .transcendence-cosmic-bg, .transcendence-prismatic-surround")).toBeNull();
    expect(container.querySelector(".premium-energy-frame")).toHaveClass("z-30", "pointer-events-none");
    expect(container.querySelector(".tcg-inner-frame")).toHaveClass("z-30", "pointer-events-none");
    expect(artwork).toHaveClass("z-20", "h-full", "w-full", "object-cover", "mix-blend-normal", "opacity-100");
    const sparkles = container.querySelector(".transcendance-sparkles-overlay");
    expect(sparkles).toHaveAttribute("aria-hidden", "true");
    expect(sparkles).toHaveStyle({ position: "absolute", pointerEvents: "none", zIndex: "22" });
    if (!(sparkles instanceof HTMLElement)) throw new Error("Expected the sparkle overlay.");
    expect(sparkles.style.background).toBe("");
    expect(sparkles.style.mixBlendMode).toBe("");
    expect(sparkles.style.filter).toBe("");
    expect(sparkles.style.opacity).toBe("");
    const lights = Array.from(sparkles?.querySelectorAll<SVGSVGElement>(".transcendance-sparkle-light") ?? []);
    expect(lights.length).toBeGreaterThanOrEqual(32);
    expect(lights.length).toBeLessThanOrEqual(40);
    const sizes = lights.map((light) => parseFloat(light.style.width));
    expect(sizes.some((size) => size >= 14 && size <= 20)).toBe(true);
    expect(sizes.some((size) => size >= 8 && size <= 12)).toBe(true);
    expect(sizes.some((size) => size >= 4 && size <= 6)).toBe(true);
    expect(new Set(lights.map((light) => light.style.color)).size).toBe(6);
    const delays = lights.map((light) => parseFloat(light.style.animationDelay));
    expect(Math.min(...delays)).toBe(0);
    expect(Math.max(...delays)).toBe(2.5);
    expect(container.querySelector(".premium-holo-sweep, .tcg-engraving")).toBeNull();
    expect(container.querySelector(".premium-rarity-badge")?.parentElement).toHaveClass("z-30");
    const name = container.querySelector(".premium-glass-label p");
    expect(name).toHaveClass("tcg-nameplate");
    expect(name?.parentElement).toHaveClass("z-30");
    expect(container.querySelector(".relic-filigree, .premium-energy-particles")).toBeNull();
    expect(container.querySelector(".premium-bottom-shade")).toBeNull();
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
    expect(regularContainer.querySelector(".zenkai-transcendance-card")).toBeNull();
    expect(regularContainer.querySelector(".zenkai-transcendance-holo")).toBeNull();
    expect(regularContainer.querySelector(".transcendance-sparkles-overlay")).toBeNull();
    expect(regularContainer.querySelector(".transcendence-prismatic-surround")).toBeNull();
    expect(regularContainer.querySelector(".premium-energy-spark")).toBeNull();
    expect(regularContainer.querySelector(".tcg-nameplate")).toBeNull();
  });

  it("recognizes a catalog Transcendance without an explicit rendering flag", () => {
    const { container } = render(<AnimeCard card={{ ...card, transcendance_series_number: "ZEN-099-TR" }} />);
    expect(container.querySelector(".zenkai-transcendance-card")).toBeTruthy();
    expect(container.querySelector(".transcendance-sparkles-overlay")).toBeTruthy();
    expect(screen.getByText("Transcendance")).toHaveClass("premium-rarity-badge");
  });

  it("applies the rainbow frame, sparkles and collector seal to every exclusive", () => {
    for (const exclusive of CUSTOM_TRANSCENDANCE_CARDS) {
      const { container, unmount } = render(<AnimeCard card={customTranscendanceAsCard(exclusive)} />);
      expect(container.querySelector(".premium-energy-frame")).toBeTruthy();
      expect(container.querySelector(".tcg-inner-frame")).toBeTruthy();
      expect(container.querySelector(".zenkai-transcendance-holo, .holo-prism, .reverse-foil")).toBeNull();
      expect(container.querySelector(".transcendance-sparkles-overlay")).toBeTruthy();
      expect(container.querySelector(".premium-glass-label .relic-seal")).toHaveTextContent("✦ TRANSCENDANCE ✦");
      expect(screen.getByRole("img", { name: exclusive.name })).toHaveClass("object-cover", "mix-blend-normal", "opacity-100");
      unmount();
    }
  });

  it("uses the edge decorations for evolved copies without exposing them on locked cards", () => {
    const { container } = render(<AnimeCard card={card} transcended comparisonForm="awakened" />);
    expect(container.querySelector(".form-portrait-stack")).toHaveClass("z-20");
    expect(container.querySelector(".premium-rarity-badge")).toBeTruthy();
    expect(container.querySelector(".premium-energy-frame")).toBeTruthy();
    expect(container.querySelector(".tcg-inner-frame")).toBeTruthy();
    expect(container.querySelectorAll(".form-portrait.object-cover")).toHaveLength(2);
    expect(container.querySelector(".zenkai-transcendance-holo")).toBeNull();
    expect(container.querySelector(".transcendance-sparkles-overlay")).toBeTruthy();
    expect(container.querySelector(".relic-seal")).toBeTruthy();

    const { container: locked } = render(<AnimeCard card={card} transcended locked />);
    expect(locked.querySelector(".premium-energy-frame")).toBeNull();
    expect(locked.querySelector(".premium-energy-spark")).toBeNull();
    expect(locked.querySelector(".zenkai-transcendance-card")).toBeNull();
    expect(locked.querySelector(".zenkai-transcendance-holo")).toBeNull();
    expect(locked.querySelector(".transcendance-sparkles-overlay")).toBeNull();
    expect(locked.querySelector(".relic-filigree")).toBeNull();
    expect(locked.querySelector(".relic-halo")).toBeNull();
    expect(locked.querySelector(".transcendence-prismatic-surround")).toBeNull();

    const { container: hidden } = render(<AnimeCard card={card} transcended flipped={false} />);
    expect(hidden.querySelector(".premium-awakened-aura")).toBeNull();
  });

  it("preserves the full-art source for Goku Black Rosé", () => {
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

  it("preserves the original art layer for Naruto Mode Baryon", () => {
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

  it("preserves the original art layer for Borushiki", () => {
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

  it("preserves the original art layer for Ichigo Bankai", () => {
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

  it("preserves the original art layer for Ryomen Sukuna (Fuga)", () => {
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

  it("preserves the original art layer for Monkey D. Luffy (Gear 5)", () => {
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
    expect(container.querySelector(".premium-bottom-shade")).toBeNull();
    expect(container.querySelector(".premium-awakened-aura")).toBeTruthy();
    expect(container.textContent).toContain("ZEN-007-TR");
    expect(screen.getByRole("img", { name: luffyCard.name })).toHaveAttribute("src", luffyCard.image_url);
    expect(screen.getByRole("img", { name: luffyCard.name })).toHaveClass(
      "mix-blend-normal",
      "opacity-100",
      "z-20",
    );
  });
});
