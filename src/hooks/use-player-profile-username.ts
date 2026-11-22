import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getPlayerProfile, playerUsernameQuery, PLAYER_PROFILE_UPDATED, type PlayerProfile } from "@/lib/player-profile";

export function usePlayerProfileUsername() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [localProfile, setLocalProfile] = useState<PlayerProfile | null>(null);
  const query = useQuery({ ...playerUsernameQuery(userId ?? ""), enabled: !!userId });

  useEffect(() => {
    const refresh = () => {
      try {
        setLocalProfile(getPlayerProfile());
      } catch {
        setLocalProfile(null);
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

  useEffect(() => {
    if (userId && query.isError) {
      toast.error("Impossible de vérifier le pseudo définitif. Vérifie ta connexion.");
    }
  }, [userId, query.isError]);

  const localLocked = userId && localProfile?.lockedUsername?.userId === userId
    ? localProfile.lockedUsername.username
    : null;
  return {
    username: userId ? query.data ?? localLocked : localProfile?.username ?? null,
    serverUsername: userId ? query.data : undefined,
    isLoading: !!userId && query.isPending,
    isError: !!userId && query.isError,
    refetch: query.refetch,
  };
}
