import { useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import { getPlus, PLUS_UPDATED, type PlusState } from "@/lib/subscription";

export function useZenkaiPlus() {
  const { session, guest } = useAuth();
  const userId = session?.user.id ?? null;
  const scope = guest ? "guest" : (userId ?? "");
  const [snapshot, setSnapshot] = useState<{
    scope: string;
    state: PlusState | null;
    error: boolean;
  }>({ scope: "", state: null, error: false });
  useEffect(() => {
    const refresh = () => {
      try {
        setSnapshot({ scope, state: getPlus(userId, guest), error: false });
      } catch {
        setSnapshot({ scope, state: null, error: true });
      }
    };
    refresh();
    window.addEventListener(PLUS_UPDATED, refresh);
    window.addEventListener("zenkai:guest-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PLUS_UPDATED, refresh);
      window.removeEventListener("zenkai:guest-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [guest, userId, scope]);
  return snapshot.scope === scope ? snapshot : { state: null, error: false };
}
