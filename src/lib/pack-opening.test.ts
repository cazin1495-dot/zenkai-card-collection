import { describe, expect, it } from "vitest";
import { packSealToken } from "./pack-opening";

describe("pack seal rarity cues", () => {
  it("uses subtle white for Commune and Rare", () => {
    expect(packSealToken("commune")).toBe("var(--flash)");
    expect(packSealToken("rare")).toBe("var(--flash)");
  });
  it("uses violet for Épique", () => expect(packSealToken("epique")).toBe("var(--rarity-epique)"));
  it("uses gold for Légendaire", () => expect(packSealToken("legendaire")).toBe("var(--rarity-legendaire)"));
  it("uses ruby for Mythique", () => expect(packSealToken("mythique")).toBe("var(--rarity-mythique)"));
});