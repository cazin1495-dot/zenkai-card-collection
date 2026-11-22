import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "./cards";
import {
  completedAlbumCount,
  DEFAULT_PLAYER_PROFILE,
  getPlayerProfile,
  PLAYER_PROFILE_KEY,
  PLAYER_PROFILE_UPDATED,
  profileCards,
  profileTitles,
  savePlayerProfile,
  unlockedProfileFrames,
} from "./player-profile";

const card = (id: string, rarity: Card["rarity"], series = "Anime"): Card => ({
  id,
  name: id,
  rarity,
  series,
  title: "",
  description: "",
  sort_order: 0,
});
const base = { card_id: "a", transcended: false };
const awakened = { card_id: "a", transcended: true };
const allowed = {
  ownedIds: new Set(["a", "b"]),
  frames: new Set<"steel" | "solar">(["steel", "solar"]),
  titles: new Set(["Novice Zenkai", "Collectionneur"]),
};

describe("profil local", () => {
  beforeEach(() => localStorage.clear());

  it("persiste les huit emplacements et notifie après la sauvegarde", () => {
    const listener = vi.fn();
    window.addEventListener(PLAYER_PROFILE_UPDATED, listener);
    try {
      savePlayerProfile(
        {
          ...DEFAULT_PLAYER_PROFILE,
          username: " Alice ",
          avatarCardId: "a",
          avatarFrame: "solar",
          showcaseCardIds: ["a", "b", null, null, null, "b", null, "a"],
        },
        allowed,
      );
      expect(getPlayerProfile()).toMatchObject({
        username: "Alice",
        avatarCardId: "a",
        showcaseCardIds: ["a", "b", null, null, null, "b", null, "a"],
      });
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(PLAYER_PROFILE_UPDATED, listener);
    }
  });

  it("migre les quatre anciens emplacements sans modifier leur ordre", () => {
    localStorage.setItem(
      PLAYER_PROFILE_KEY,
      JSON.stringify({
        ...DEFAULT_PLAYER_PROFILE,
        username: "Alice",
        showcaseCardIds: ["a", null, "b", "a"],
      }),
    );
    const listener = vi.fn();
    window.addEventListener(PLAYER_PROFILE_UPDATED, listener);
    try {
      const profile = getPlayerProfile();
      expect(profile.username).toBe("Alice");
      expect(profile.showcaseCardIds).toEqual(["a", null, "b", "a", null, null, null, null]);
      expect(JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY)!)).toEqual(profile);
      expect(getPlayerProfile()).toEqual(profile);
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(PLAYER_PROFILE_UPDATED, listener);
    }
  });

  it("refuse les cartes non possédées, titres et cadres verrouillés sans écraser le profil", () => {
    savePlayerProfile(DEFAULT_PLAYER_PROFILE, allowed);
    const original = localStorage.getItem(PLAYER_PROFILE_KEY);
    expect(() =>
      savePlayerProfile({ ...DEFAULT_PLAYER_PROFILE, avatarCardId: "missing" }, allowed),
    ).toThrow();
    expect(() =>
      savePlayerProfile(
        {
          ...DEFAULT_PLAYER_PROFILE,
          showcaseCardIds: [null, null, null, null, null, null, null, "missing"],
        },
        allowed,
      ),
    ).toThrow();
    expect(() =>
      savePlayerProfile({ ...DEFAULT_PLAYER_PROFILE, avatarFrame: "rainbow" }, allowed),
    ).toThrow();
    expect(() =>
      savePlayerProfile({ ...DEFAULT_PLAYER_PROFILE, equippedTitle: "Légende Rétro" }, allowed),
    ).toThrow();
    expect(() =>
      savePlayerProfile({ ...DEFAULT_PLAYER_PROFILE, username: " " }, allowed),
    ).toThrow();
    expect(localStorage.getItem(PLAYER_PROFILE_KEY)).toBe(original);
  });

  it("signale un stockage invalide ou une écriture impossible", () => {
    localStorage.setItem(PLAYER_PROFILE_KEY, "{}");
    expect(() => getPlayerProfile()).toThrow();
    const invalid = JSON.stringify({
      ...DEFAULT_PLAYER_PROFILE,
      showcaseCardIds: ["a", null, null, null, null],
    });
    localStorage.setItem(PLAYER_PROFILE_KEY, invalid);
    expect(() => getPlayerProfile()).toThrow();
    expect(localStorage.getItem(PLAYER_PROFILE_KEY)).toBe(invalid);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota dépassé");
    });
    try {
      expect(() => savePlayerProfile(DEFAULT_PLAYER_PROFILE, allowed)).toThrow("Quota dépassé");
    } finally {
      setItem.mockRestore();
    }
  });

  it("choisit la copie éveillée et applique les seuils des cadres", () => {
    const cards = [card("a", "rare"), card("b", "mythique")];
    const owned = profileCards(cards, [
      base,
      { card_id: "b", transcended: false },
      awakened,
      { card_id: "missing", transcended: false },
    ]);
    expect(owned.map((item) => item.card.id)).toEqual(["a", "b"]);
    expect(owned[0]?.copy.transcended).toBe(true);
    expect([...unlockedProfileFrames(1, [], [])]).toEqual(["steel"]);
    expect([...unlockedProfileFrames(2, [], [])]).toEqual(["steel", "solar"]);
    expect([...unlockedProfileFrames(4, [], [])]).toEqual(["steel", "solar", "imperial"]);
    expect(unlockedProfileFrames(1, owned, [awakened]).has("rainbow")).toBe(true);
    expect(
      unlockedProfileFrames(
        1,
        [],
        [{ card_id: "special", transcended: false, customTranscendance: true }],
      ).has("rainbow"),
    ).toBe(true);
  });

  it("réunit les titres débloqués et compte les albums complets par identité unique", () => {
    const titles = profileTitles(
      15,
      ["Anime"],
      { unlocked: ["konami"], claimed: ["konami"], recycled: 0 },
      ["Anime", "Autre"],
    );
    expect(titles.find((title) => title.name === "Initié")?.unlocked).toBe(true);
    expect(titles.find((title) => title.name === "Légende Rétro")?.unlocked).toBe(true);
    expect(titles.find((title) => title.name === "Oiseau de Nuit")?.unlocked).toBe(false);
    expect(titles.find((title) => title.name === "Maître Anime")?.unlocked).toBe(true);
    expect(titles.find((title) => title.name === "Maître Autre")?.unlocked).toBe(false);
    expect(
      completedAlbumCount(
        [card("a", "rare"), card("a", "rare"), card("b", "rare"), card("c", "rare", "Autre")],
        new Set(["a", "b"]),
      ),
    ).toBe(1);
  });
});
