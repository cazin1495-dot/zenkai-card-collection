import { lovable } from "@/integrations/lovable/index";
import { betaEnded, hasBetaAccess } from "./beta";

export function signInWithGoogle() {
  return lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
}

const LOCAL_GUEST_KEY = "zenkai:local-guest";

export function canUseLocalGuestMode() {
  return import.meta.env.DEV || (typeof window !== "undefined" && !betaEnded() && hasBetaAccess());
}

export function isLocalGuestMode() {
  return (
    canUseLocalGuestMode() &&
    typeof window !== "undefined" &&
    window.localStorage.getItem(LOCAL_GUEST_KEY) === "true"
  );
}

export function setLocalGuestMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled && canUseLocalGuestMode()) window.localStorage.setItem(LOCAL_GUEST_KEY, "true");
  else window.localStorage.removeItem(LOCAL_GUEST_KEY);
}

export function isOAuthCallbackPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/auth/callback" || path === "/oauth/callback" || path === "/~oauth";
}
