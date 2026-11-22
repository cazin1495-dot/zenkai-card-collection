import { beforeEach, describe, expect, it, vi } from "vitest";
import { acceptFriendRequest, sendFriendRequest, splitFriendships, type Friendship } from "./friendships";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, from: () => ({ insert: mocks.insert, update: mocks.update }) } }));
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: [{ id: "bob", username: "Bob" }], error: null }); mocks.insert.mockResolvedValue({ error: null }); mocks.update.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockReturnValue({ eq: mocks.eq, select: mocks.select }); mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle }); });
describe("friendship rules", () => {
  it("only sends pending requests in the signed-in requester's name", async () => {
    await sendFriendRequest("alice", "  Bob_1  ");
    expect(mocks.rpc).toHaveBeenCalledWith("find_friend_player", { _username: "Bob_1" });
    expect(mocks.insert).toHaveBeenCalledWith({ requester_id: "alice", addressee_id: "bob", status: "pending" });
  });
  it("rejects a self-request without inserting", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: "alice", username: "Alice" }], error: null });
    await expect(sendFriendRequest("alice", "Alice")).rejects.toThrow(); expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects inverse duplicate relationships instead of accepting automatically", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    await expect(sendFriendRequest("alice", "Bob")).rejects.toThrow("existe déjà"); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("accepts only pending requests addressed to the current user", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "request" }, error: null });
    await acceptFriendRequest("request", "alice");
    expect(mocks.update).toHaveBeenCalledWith({ status: "accepted" }); expect(mocks.eq.mock.calls).toEqual([["id", "request"], ["addressee_id", "alice"], ["status", "pending"]]);
  });
  it("fails on an unavailable or unauthorized request", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(acceptFriendRequest("request", "mallory")).rejects.toThrow("plus disponible");
  });
  it("partitions pending requests by participant and includes only accepted friends", () => {
    const base = { created_at: "2026-11-22", requester_username: "Bob", addressee_username: "Alice", requester_id: "bob", addressee_id: "alice" };
    const rows: Friendship[] = [
      { ...base, id: "incoming", status: "pending" },
      { ...base, id: "outgoing", requester_id: "alice", addressee_id: "carol", status: "pending" },
      { ...base, id: "friend", status: "accepted" },
      { ...base, id: "private", requester_id: "carol", addressee_id: "dave", status: "pending" },
    ];
    const lists = splitFriendships(rows, "alice");
    expect(lists.received.map(row => row.id)).toEqual(["incoming"]); expect(lists.sent.map(row => row.id)).toEqual(["outgoing"]); expect(lists.accepted.map(row => row.id)).toEqual(["friend"]);
  });
});
