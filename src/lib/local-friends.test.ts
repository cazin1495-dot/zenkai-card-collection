// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addLocalFriend,
  getLocalFriends,
  localFriendsKey,
  removeLocalFriend,
} from "./local-friends";

describe("local friends", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("isolates accounts, rejects duplicates and removes only the chosen contact", () => {
    addLocalFriend("alice", { id: "bob", username: "Bob" });
    addLocalFriend("alice", { id: "carol", username: "Carol" });
    expect(getLocalFriends("other")).toEqual([]);
    expect(() => addLocalFriend("alice", { id: "bob", username: "Bob" })).toThrow();
    expect(() => addLocalFriend("alice", { id: "alice", username: "Alice" })).toThrow();
    removeLocalFriend("alice", "bob");
    expect(getLocalFriends("alice")).toEqual([{ id: "carol", username: "Carol" }]);
  });

  it("reports invalid or unavailable storage instead of losing the list", () => {
    localStorage.setItem(localFriendsKey("alice"), "invalid json");
    expect(() => getLocalFriends("alice")).toThrow();
    localStorage.removeItem(localFriendsKey("alice"));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage full");
    });
    expect(() => addLocalFriend("alice", { id: "bob", username: "Bob" })).toThrow("storage full");
    expect(getLocalFriends("alice")).toEqual([]);
  });
});
