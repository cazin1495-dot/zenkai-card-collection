import { lovable } from "@/integrations/lovable/index";

export function signInWithGoogle() {
  return lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
}

const LOCAL_GUEST_KEY = "zenkai:local-guest";

export function isLocalGuestMode() {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.localStorage.getItem(LOCAL_GUEST_KEY) === "true"
  );
}

export function setLocalGuestMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled && import.meta.env.DEV) window.localStorage.setItem(LOCAL_GUEST_KEY, "true");
  else window.localStorage.removeItem(LOCAL_GUEST_KEY);
}

export function isOAuthCallbackPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/auth/callback" || path === "/oauth/callback" || path === "/~oauth";
}
