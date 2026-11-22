import { useEffect, useState } from "react";
import { getSecretQuests, type SecretQuestState } from "@/lib/quests";

export function useSecretQuests() {
  const [snapshot, setSnapshot] = useState<{ state: SecretQuestState | null; error: boolean }>({
    state: null,
    error: false,
  });
  useEffect(() => {
    const refresh = () => {
      try {
        setSnapshot({ state: getSecretQuests(), error: false });
      } catch {
        setSnapshot({ state: null, error: true });
      }
    };
    refresh();
    window.addEventListener("zenkai:guest-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("zenkai:guest-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return snapshot;
}
