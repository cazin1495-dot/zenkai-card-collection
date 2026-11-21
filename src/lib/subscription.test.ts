// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getPlus, plusAvatarImage, setPlus } from "./subscription";
import { getGuestBalance } from "./guest-collection";

describe("local Zenkai+ test state", () => {
  beforeEach(() => localStorage.clear());

  it("isolates accounts and does not credit a connected player in local guest currency", () => {
    setPlus("alice", false, { active: true });
    setPlus("alice", false, { avatar: "goku" });
    expect(getPlus("alice", false)).toEqual({ active: true, avatar: "goku" });
    expect(getPlus("bob", false)).toEqual({ active: false, avatar: null });
    expect(getGuestBalance()).toBe(500);
    setPlus("alice", false, { active: false });
    expect(getPlus("alice", false).avatar).toBe("goku");
  });

  it("rejects avatar selection when inactive or unknown", () => {
    expect(() => setPlus("alice", false, { avatar: "goku" })).toThrow();
    setPlus("alice", false, { active: true });
    expect(() => setPlus("alice", false, { avatar: "invalid" })).toThrow();
  });

  it("uses catalog portraits for Gojo and Firefly", () => {
    const cards = [
      { id: "al-127691", name: "Gojo", title: "", description: "", rarity: "mythique" as const, sort_order: 0, image_url: "/gojo.jpg" },
      { id: "hsr-1", name: "Firefly", title: "", description: "", rarity: "mythique" as const, sort_order: 0, image_url: "/firefly.jpg" },
    ];
    expect(plusAvatarImage("gojo", cards)).toBe("/gojo.jpg");
    expect(plusAvatarImage("firefly", cards)).toBe("/firefly.jpg");
    expect(plusAvatarImage("gojo", [])).toBeUndefined();
  });
});
