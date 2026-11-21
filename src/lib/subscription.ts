import {
  getGuestPlus,
  setGuestPlusActive,
  setGuestPlusAvatar,
  type GuestPlus,
} from "./guest-collection";
import { cardArt, type Card } from "./cards";

export type PlusState = Pick<GuestPlus, "active" | "avatar">;
export const PLUS_AVATARS = [
  { id: "goku", name: "Goku Ultra Instinct", image: "/goku%20ui.png" },
  { id: "gojo", name: "Gojo", cardId: "al-127691" },
  { id: "luffy", name: "Luffy Gear 5", image: "/luffy%20gear%205.jpg" },
  { id: "sukuna", name: "Sukuna Fuga", image: "/sukuna%20eveil%201.jpg" },
  { id: "firefly", name: "Firefly", cardId: "hsr-1" },
] as const;
export const PLUS_UPDATED = "zenkai:plus-updated";

export function plusAvatarImage(id: string | null | undefined, cards: readonly Card[]): string | undefined {
  const avatar = PLUS_AVATARS.find((item) => item.id === id);
  if (!avatar) return undefined;
  if ("image" in avatar) return avatar.image;
  const card = cards.find((item) => item.id === avatar.cardId);
  return card ? cardArt(card) || undefined : undefined;
}

export function plusKey(userId: string) {
  return `zenkai:plus:${userId}`;
}

export function getPlus(userId: string | null, guest: boolean): PlusState {
  if (guest) return getGuestPlus();
  if (!userId || typeof window === "undefined") return { active: false, avatar: null };
  const raw = window.localStorage.getItem(plusKey(userId));
  if (raw === null) return { active: false, avatar: null };
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("État Zenkai+ invalide.");
  const state = parsed as Record<string, unknown>;
  if (
    typeof state["active"] !== "boolean" ||
    (state["avatar"] !== null && typeof state["avatar"] !== "string")
  ) {
    throw new Error("État Zenkai+ invalide.");
  }
  return { active: state["active"], avatar: state["avatar"] };
}

export function setPlus(userId: string | null, guest: boolean, update: Partial<PlusState>) {
  if (!userId && !guest) throw new Error("Connecte-toi ou utilise le mode invité.");
  if (update.active !== undefined && update.avatar !== undefined)
    throw new Error("Une seule modification Zenkai+ à la fois.");
  if (
    update.avatar !== undefined &&
    update.avatar !== null &&
    !PLUS_AVATARS.some((avatar) => avatar.id === update.avatar)
  ) {
    throw new Error("Avatar Zenkai+ inconnu.");
  }
  if (guest) {
    if (update.active !== undefined) return setGuestPlusActive(update.active);
    if (update.avatar) setGuestPlusAvatar(update.avatar);
  } else {
    if (!userId) throw new Error("Compte indisponible.");
    const state = { ...getPlus(userId, false), ...update };
    if (update.avatar && !state.active) throw new Error("Active Zenkai+ pour choisir un avatar.");
    window.localStorage.setItem(plusKey(userId), JSON.stringify(state));
    window.dispatchEvent(new Event(PLUS_UPDATED));
  }
  return 0;
}
