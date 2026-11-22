import { useEffect, useState } from "react";
import { getDailyLogin, getQuestState } from "@/lib/quests";

export function useQuests(userId: string | null) {
  const [snapshot, setSnapshot] = useState<{ state: ReturnType<typeof getQuestState> | null; error: boolean }>({ state: null, error: false });
  const [daily, setDaily] = useState<{ state: ReturnType<typeof getDailyLogin> | null; error: boolean }>({ state: null, error: false });
  useEffect(() => {
    let timer: number;
    const refresh = () => {
      try { setSnapshot({ state: getQuestState(userId), error: false }); }
      catch { setSnapshot({ state: null, error: true }); }
      try { setDaily({ state: getDailyLogin(), error: false }); }
      catch { setDaily({ state: null, error: true }); }
    };
    const schedule = () => {
      window.clearTimeout(timer);
      refresh();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      timer = window.setTimeout(schedule, Math.max(1, midnight.getTime() - Date.now()));
    };
    schedule();
    window.addEventListener("zenkai:guest-updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", schedule);
    return () => {
      window.removeEventListener("zenkai:guest-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", schedule);
      window.clearTimeout(timer);
    };
  }, [userId]);
  return { ...snapshot, daily: daily.state, dailyError: daily.error };
}
