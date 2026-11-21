import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { normalizeCatalogCard, type Card, type PackId } from "@/lib/cards";
import { BoosterPreviewDialog } from "./BoosterPreviewDialog";
import type { CustomTranscendanceCard } from "@/lib/transcendance-cards";

const cards: Card[] = [
  { id: "common", name: "Héros", title: "Shonen", rarity: "commune", description: "", sort_order: 1, category: "shonen" },
  { id: "mythic", name: "Rival", title: "Shonen", rarity: "mythique", description: "", sort_order: 2, category: "shonen" },
  { id: "other-pack", name: "Autre", title: "Seinen", rarity: "legendaire", description: "", sort_order: 3, category: "seinen" },
  normalizeCatalogCard({
    id: "goku-black",
    name: "Goku Black",
    title: "Dragon Ball Super",
    rarity: "rare",
    description: "",
    sort_order: 4,
    category: "seinen",
  }),
];

function PreviewHarness({ customCards, pack = "shonen" }: { customCards?: readonly CustomTranscendanceCard[]; pack?: PackId }) {
  const [open, setOpen] = useState(false);
  return (
    <BoosterPreviewDialog
      cards={cards}
      pack={pack}
      packLabel={pack === "antagoniste" ? "Antagoniste" : pack === "protagoniste" ? "Protagoniste" : "Shonen Mix"}
      {...(customCards === undefined ? {} : { customCards })}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

describe("booster content preview", () => {
  it("shows a locked Transcendance placeholder and filters by rarity with rates", () => {
    render(<PreviewHarness customCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

    expect(screen.getByText("Contenu du pack Shonen Mix")).toBeTruthy();
    expect(screen.getByText("Carte Transcendance Exclusive à venir")).toBeTruthy();
    expect(screen.getAllByText("0,05 %")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Légendaire.*1,2/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Mythique.*0,25/ }));
    expect(screen.getByText("Rival")).toBeTruthy();
    expect(screen.queryByText("Héros")).toBeNull();
    expect(screen.queryByText("Carte Transcendance Exclusive à venir")).toBeNull();
  });

  it("uses the single configured Goku card for Shonen Mix by default", () => {
    render(<PreviewHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

    expect(screen.getByText("Goku Ultra Instinct")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Goku Ultra Instinct" })).toHaveAttribute("src", "/goku%20ui.png");
    expect(screen.queryByText("Carte Transcendance Exclusive à venir")).toBeNull();
  });

  it("shows Mythique Goku Black and Transcendance Goku Black Rosé in both assigned packs", () => {
    for (const pack of ["shonen", "antagoniste"] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      const mythicGokuBlack = screen.getByText("Goku Black").closest("article");
      expect(mythicGokuBlack).toHaveTextContent("Mythique · 0,25 %");
      expect(mythicGokuBlack?.querySelector(".flip-front")).toHaveClass("glow-mythique");
      expect(screen.getByText("Goku Black Rosé")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Goku Black Rosé" })).toHaveAttribute(
        "src",
        "/blackj%20goku%20rose.jpg",
      );
      expect(screen.queryByText("Carte Transcendance Exclusive à venir")).toBeNull();
      unmount();
    }
  });

  it("shows Naruto Mode Baryon in Shonen Mix and Protagoniste previews", () => {
    for (const [pack, label] of [["shonen", "Shonen Mix"], ["protagoniste", "Protagoniste"]] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      expect(screen.getByText(`Contenu du pack ${label}`)).toBeTruthy();
      expect(screen.getByText("Naruto Mode Baryon")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Naruto Mode Baryon" })).toHaveAttribute("src", "/naruto%20bayron.jpg");
      unmount();
    }
  });

  it("shows Borushiki in Shonen Mix and Protagoniste previews", () => {
    for (const [pack, label] of [["shonen", "Shonen Mix"], ["protagoniste", "Protagoniste"]] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      expect(screen.getByText(`Contenu du pack ${label}`)).toBeTruthy();
      expect(screen.getByText("Borushiki")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Borushiki" })).toHaveAttribute("src", "/borushiki.jpg");
      unmount();
    }
  });

  it("shows Ichigo Bankai in Shonen Mix and Protagoniste previews", () => {
    for (const [pack, label] of [["shonen", "Shonen Mix"], ["protagoniste", "Protagoniste"]] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      expect(screen.getByText(`Contenu du pack ${label}`)).toBeTruthy();
      expect(screen.getByText("Ichigo Kurosaki (Bankai)")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Ichigo Kurosaki (Bankai)" })).toHaveAttribute(
        "src",
        "/ichigo%20bankai.webp",
      );
      unmount();
    }
  });

  it("shows Ryomen Sukuna (Fuga) in Antagoniste and Shonen Mix previews", () => {
    for (const [pack, label] of [["antagoniste", "Antagoniste"], ["shonen", "Shonen Mix"]] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      expect(screen.getByText(`Contenu du pack ${label}`)).toBeTruthy();
      expect(screen.getByText("Ryomen Sukuna (Fuga)")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Ryomen Sukuna (Fuga)" })).toHaveAttribute(
        "src",
        "/sukuna%20eveil%201.jpg",
      );
      unmount();
    }
  });

  it("shows Monkey D. Luffy (Gear 5) in Shonen Mix and Protagoniste previews", () => {
    for (const [pack, label] of [["shonen", "Shonen Mix"], ["protagoniste", "Protagoniste"]] as const) {
      const { unmount } = render(<PreviewHarness pack={pack} />);
      fireEvent.click(screen.getByRole("button", { name: "Voir les cartes du pack" }));

      expect(screen.getByText(`Contenu du pack ${label}`)).toBeTruthy();
      expect(screen.getByText("Monkey D. Luffy (Gear 5)")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Monkey D. Luffy (Gear 5)" })).toHaveAttribute(
        "src",
        "/luffy%20gear%205.jpg",
      );
      unmount();
    }
  });
});
