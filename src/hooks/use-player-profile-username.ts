import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getCustomPlayerUsername, PLAYER_PROFILE_UPDATED } from "@/lib/player-profile";

export function usePlayerProfileUsername() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      try {
        setUsername(getCustomPlayerUsername());
      } catch {
        setUsername(null);
        toast.error("Pseudo local indisponible : vérifie le stockage du navigateur.");
      }
    };
    refresh();
    window.addEventListener(PLAYER_PROFILE_UPDATED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PLAYER_PROFILE_UPDATED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return username;
}
