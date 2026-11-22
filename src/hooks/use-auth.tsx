import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { canUseLocalGuestMode, isLocalGuestMode, setLocalGuestMode } from "@/lib/auth";

type AuthState = { session: Session | null; ready: boolean; guest: boolean };
type AuthContextValue = AuthState & { enterGuestMode: () => void; leaveGuestMode: () => void };

const AuthContext = createContext<AuthContextValue>({
  session: null,
  ready: false,
  guest: false,
  enterGuestMode: () => {},
  leaveGuestMode: () => {},
});

/** Single app-wide auth listener: keeps the session in context and refreshes data on sign-in/out. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, ready: false, guest: false });
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (search.has("error") || search.has("error_code") || hash.has("error")) {
        const description = search.get("error_description") ?? hash.get("error_description");
        toast.error(
          description
            ? `La connexion a échoué : ${description}`
            : "La connexion a échoué. Réessaie.",
        );
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setLocalGuestMode(false);
      setState({ session, ready: true, guest: !session && isLocalGuestMode() });
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setLocalGuestMode(false);
      setState({ session, ready: true, guest: !session && isLocalGuestMode() });
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  function enterGuestMode() {
    if (state.session || !canUseLocalGuestMode()) {
      toast.error("Le mode invité local n'est pas disponible.");
      return;
    }
    setLocalGuestMode(true);
    setState((current) => ({ ...current, guest: true }));
  }

  function leaveGuestMode() {
    setLocalGuestMode(false);
    setState((current) => ({ ...current, guest: false }));
  }

  return (
    <AuthContext.Provider value={{ ...state, enterGuestMode, leaveGuestMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
