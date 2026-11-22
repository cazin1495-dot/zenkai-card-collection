import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoosterArtwork } from "./BoosterArtwork";
import { PACK_ARTWORK } from "@/lib/cards";

describe("BoosterArtwork fallback", () => {
  it("uses the default booster artwork when the source is empty", () => {
    const { getByRole } = render(<BoosterArtwork src="" alt="Booster Shonen Mix" />);

    expect(getByRole("img")).toHaveAttribute("src", PACK_ARTWORK);
  });

  it("switches to the default booster artwork if the source fails to load", () => {
    const { getByRole } = render(
      <BoosterArtwork src="/missing-image.jpg" alt="Booster Shonen Mix" />,
    );
    const image = getByRole("img");

    fireEvent.error(image);

    expect(getByRole("img")).toHaveAttribute("src", PACK_ARTWORK);
  });

  it("uses a newly selected pack image after the previous image failed", () => {
    const { getByRole, rerender } = render(<BoosterArtwork src="/missing.jpg" alt="Booster" />);
    fireEvent.error(getByRole("img"));
    rerender(<BoosterArtwork src="/pack-sport-2.png" alt="Booster" />);
    expect(getByRole("img")).toHaveAttribute("src", "/pack-sport-2.png");
  });

  it("reports a failed Protagoniste image without replacing it with another pack", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { getByRole } = render(<BoosterArtwork src="/pack-protagoniste.png" alt="Booster Protagoniste" />);
      fireEvent.error(getByRole("img"));
      expect(getByRole("img")).toHaveAttribute("src", "/pack-protagoniste.png");
      expect(error).toHaveBeenCalledWith("Impossible de charger la pochette Protagoniste :", "/pack-protagoniste.png");
    } finally {
      error.mockRestore();
    }
  });
});
