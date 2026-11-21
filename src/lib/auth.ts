import { supabase } from "@/integrations/supabase/client";

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export function isOAuthCallbackPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/auth/callback" || path === "/oauth/callback" || path === "/~oauth";
}
