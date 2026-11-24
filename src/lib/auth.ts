import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { betaEnded, hasBetaAccess } from "./beta";

export async function signInWithGoogle() {
  try {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (!res?.error) return res;
  } catch {}
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

const LOCAL_GUEST_KEY = "zenkai:local-guest";

export function canUseLocalGuestMode() {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  const hote = window.location.hostname;
  if (hote.includes("localhost") || hote.includes("127.0.0.1") || hote.includes("github.dev") || hote.includes("id-preview--")) return true;
  if (window.localStorage.getItem("zenkai_acces_createur") === "1") return true;
  return !betaEnded() && hasBetaAccess();
}

export function connexionDeveloppeur() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("zenkai_acces_createur", "1");
    window.localStorage.setItem(LOCAL_GUEST_KEY, "true");
  } catch {}
  window.location.href = "/";
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
