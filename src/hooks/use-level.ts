import { useEffect, useState } from "react";
import { getPlayerXp, levelProgress } from "@/lib/level";

export function useLevel() {
  const [xp, setXp] = useState<number | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const refresh = () => {
      try { setXp(getPlayerXp()); setError(false); }
      catch { setXp(null); setError(true); }
    };
    refresh();
    window.addEventListener("zenkai:guest-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("zenkai:guest-updated", refresh); window.removeEventListener("storage", refresh); };
  }, []);
  return { xp, error, ...(xp === null ? { level: null, progress: null } : levelProgress(xp)) };
}
