export type LocalFriend = { id: string; username: string };

export function localFriendsKey(userId: string) {
  return `zenkai:friends:${userId}`;
}

export function getLocalFriends(userId: string): LocalFriend[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(localFriendsKey(userId));
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item: unknown) =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>)["id"] === "string" &&
        typeof (item as Record<string, unknown>)["username"] === "string",
    )
  )
    throw new Error("Liste locale d'amis invalide.");
  if (new Set(parsed.map((friend) => friend.id)).size !== parsed.length) {
    throw new Error("Liste locale d'amis invalide.");
  }
  return parsed;
}

export function addLocalFriend(userId: string, friend: LocalFriend) {
  if (friend.id === userId) throw new Error("Tu ne peux pas t'ajouter toi-même.");
  const friends = getLocalFriends(userId);
  if (
    friends.some(
      (existing) =>
        existing.id === friend.id ||
        existing.username.trim().toLocaleLowerCase() === friend.username.trim().toLocaleLowerCase(),
    )
  ) {
    throw new Error("Ce joueur figure déjà dans ta liste.");
  }
  const updated = [...friends, friend];
  window.localStorage.setItem(localFriendsKey(userId), JSON.stringify(updated));
  return updated;
}

export function removeLocalFriend(userId: string, friendId: string) {
  const friends = getLocalFriends(userId);
  const updated = friends.filter((friend) => friend.id !== friendId);
  window.localStorage.setItem(localFriendsKey(userId), JSON.stringify(updated));
  return updated;
}
