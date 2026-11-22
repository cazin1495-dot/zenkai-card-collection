import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGuestBalance, PLAYER_XP_KEY, updateGuestState } from "./guest-collection";
import { claimAlbum, claimDailyLogin, claimQuest, DAILY_LOGIN_KEY, DAILY_LOGIN_REWARDS, getDailyLogin, getQuestState, observeQuestCollection, recordBoosterOpen, recordQuestActivity } from "./quests";
import { addXp, getPlayerXp, levelProgress } from "./level";
import type { Card } from "./cards";

const card: Card = { id: "one", name: "One", title: "", description: "", rarity: "mythique", sort_order: 0, series: "Anime" };
const second: Card = { ...card, id: "two", rarity: "commune" };

describe("local quests and albums", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 0, 1, 12)); });
  afterEach(() => vi.useRealTimers());

  it("tracks daily actions, claims atomically once, and resets at local midnight", () => {
    recordQuestActivity(null, "boosters", 3);
    expect(() => claimQuest(null, "open10")).toThrow();
    expect(claimQuest(null, "open3")).toBe(120);
    expect(getGuestBalance()).toBe(620);
    expect(() => claimQuest(null, "open3")).toThrow();
    vi.setSystemTime(new Date(2026, 0, 2, 0));
    expect(getQuestState(null).boosters).toBe(0);
    recordQuestActivity(null, "boosters", 10);
    expect(claimQuest(null, "open3")).toBe(120);
    expect(claimQuest(null, "open10")).toBe(350);
    expect(getGuestBalance()).toBe(1090);
  });

  it("retains achievement milestones and separates accounts and local collection", () => {
    const copies = Array.from({ length: 25 }, (_, i) => ({ card_id: i ? `id-${i}` : card.id, transcended: i === 1 }));
    observeQuestCollection("alice", [card], copies);
    observeQuestCollection("alice", [card], []);
    expect(getQuestState("alice")).toMatchObject({ unique: 25, mythic: true, transcendance: true });
    expect(getQuestState(null).unique).toBe(0);
    expect(getQuestState("bob").unique).toBe(0);
    expect(claimQuest("alice", "unique25")).toBe(250);
    expect(claimQuest("alice", "mythic")).toBe(400);
    expect(claimQuest("alice", "transcendance")).toBe(1000);
    expect(() => claimQuest("alice", "mythic")).toThrow();
  });

  it("requires each distinct album card and persists its title and reward", () => {
    const copies = [{ card_id: "one", transcended: false }, { card_id: "one", transcended: true }];
    expect(() => claimAlbum(null, "Anime", [card, second], copies)).toThrow("incomplet");
    copies.push({ card_id: "two", transcended: false });
    expect(claimAlbum(null, "Anime", [card, second], copies)).toBe(500);
    expect(getQuestState(null).albums).toEqual(["Anime"]);
    expect(getGuestBalance()).toBe(1000);
    expect(() => claimAlbum(null, "Anime", [card, second], copies)).toThrow("déjà");
  });

  it("does not mark rewards claimed when storage fails", () => {
    recordQuestActivity(null, "recycled", 5);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage full"); });
    expect(() => claimQuest(null, "recycle5")).toThrow("storage full");
    expect(getGuestBalance()).toBe(500);
    expect(getQuestState(null).dailyClaimed).toEqual([]);
    vi.restoreAllMocks();
  });

  it("awards booster and unique discovery XP once, including repeat guest simulations", () => {
    recordBoosterOpen(null, 10, ["old"], ["old", "new", "new", "new2"]);
    expect(getPlayerXp()).toBe(330);
    expect(localStorage.getItem(PLAYER_XP_KEY)).toBe("330");
    expect(levelProgress(getPlayerXp())).toEqual({ level: 1, progress: 330 });
    expect(getGuestBalance()).toBe(500);
    recordBoosterOpen(null, 1, [], ["new", "new2"]);
    expect(getPlayerXp()).toBe(355);
    expect(getGuestBalance()).toBe(500);
  });

  it("awards each level bonus and emits a level-up after the atomic claim", () => {
    const listener = vi.fn();
    window.addEventListener("zenkai:level-up", listener);
    recordQuestActivity(null, "boosters", 24);
    expect(getGuestBalance()).toBe(600);
    expect(claimQuest(null, "open10")).toBe(350);
    expect(getPlayerXp()).toBe(700);
    expect(getGuestBalance()).toBe(950);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0].detail).toEqual({ from: 1, to: 2 });
    window.removeEventListener("zenkai:level-up", listener);
  });

  it("credits each level bonus when a gain crosses multiple thresholds", () => {
    updateGuestState((state) => ({ state: addXp(state, 1200), result: undefined }));
    expect(getPlayerXp()).toBe(1200);
    expect(levelProgress(getPlayerXp())).toEqual({ level: 3, progress: 0 });
    expect(getGuestBalance()).toBe(700);
  });

  it("records new collection discoveries after seeding existing cards without retroactive XP", () => {
    const first = [{ card_id: "one", transcended: false }];
    observeQuestCollection(null, [card, second], first);
    expect(getPlayerXp()).toBe(0);
    observeQuestCollection(null, [card, second], [...first, { card_id: "two", transcended: false }]);
    observeQuestCollection(null, [card, second], first);
    observeQuestCollection(null, [card, second], [...first, { card_id: "two", transcended: false }]);
    expect(getPlayerXp()).toBe(40);
    recordQuestActivity(null, "recycled", 5);
    expect(getPlayerXp()).toBe(65);
  });

  it("rolls back the XP key if committing the associated reward fails", () => {
    recordQuestActivity(null, "boosters", 10);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "zenkai_guest_collection") throw new Error("storage full");
      return original.call(this, key, value);
    });
    expect(() => claimQuest(null, "open10")).toThrow("storage full");
    expect(getPlayerXp()).toBe(250);
    expect(localStorage.getItem(PLAYER_XP_KEY)).toBe("250");
    expect(getGuestBalance()).toBe(500);
    expect(getQuestState(null).dailyClaimed).toEqual([]);
    vi.restoreAllMocks();
  });

  it("claims seven consecutive days once and starts a new cycle", () => {
    for (let day = 1; day <= 7; day++) {
      vi.setSystemTime(new Date(2026, 0, day, 12));
      expect(getDailyLogin()).toMatchObject({ day, claimed: false });
      expect(claimDailyLogin()).toEqual({ day, ...DAILY_LOGIN_REWARDS[day - 1] });
      expect(getDailyLogin()).toMatchObject({ streak: day, day, claimed: true });
      expect(() => claimDailyLogin()).toThrow("déjà");
    }
    expect(JSON.parse(localStorage.getItem(DAILY_LOGIN_KEY)!)).toEqual({ streak: 7, lastClaimDate: "2026-01-07" });
    expect(getPlayerXp()).toBe(1100);
    expect(getGuestBalance()).toBe(3150);
    vi.setSystemTime(new Date(2026, 0, 8, 12));
    expect(getDailyLogin()).toEqual({ streak: 0, day: 1, claimed: false });
    expect(claimDailyLogin().day).toBe(1);
  });

  it("resets a missed day across month boundaries and rejects invalid or future data", () => {
    vi.setSystemTime(new Date(2026, 0, 31, 12));
    claimDailyLogin();
    vi.setSystemTime(new Date(2026, 1, 1, 12));
    expect(claimDailyLogin().day).toBe(2);
    vi.setSystemTime(new Date(2026, 1, 3, 12));
    expect(getDailyLogin()).toEqual({ streak: 0, day: 1, claimed: false });
    localStorage.setItem(DAILY_LOGIN_KEY, JSON.stringify({ streak: 1, lastClaimDate: "2026-02-30" }));
    expect(() => getDailyLogin()).toThrow();
    localStorage.setItem(DAILY_LOGIN_KEY, JSON.stringify({ streak: 1, lastClaimDate: "2026-02-04" }));
    expect(() => claimDailyLogin()).toThrow();
  });

  it("rolls back the daily claim and XP if the balance cannot be saved", () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "zenkai_guest_collection") throw new Error("storage full");
      return original.call(this, key, value);
    });
    expect(() => claimDailyLogin()).toThrow("storage full");
    expect(localStorage.getItem(DAILY_LOGIN_KEY)).toBeNull();
    expect(getPlayerXp()).toBe(0);
    expect(getGuestBalance()).toBe(500);
    vi.restoreAllMocks();
  });

  it("preserves the previous streak if a later claim cannot be saved", () => {
    claimDailyLogin();
    vi.setSystemTime(new Date(2026, 0, 2, 12));
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "zenkai_guest_collection") throw new Error("storage full");
      return original.call(this, key, value);
    });
    expect(() => claimDailyLogin()).toThrow("storage full");
    expect(JSON.parse(localStorage.getItem(DAILY_LOGIN_KEY)!)).toEqual({ streak: 1, lastClaimDate: "2026-01-01" });
    expect(getDailyLogin()).toMatchObject({ day: 2, claimed: false });
    expect(getPlayerXp()).toBe(50);
    expect(getGuestBalance()).toBe(600);
    vi.restoreAllMocks();
  });
});
