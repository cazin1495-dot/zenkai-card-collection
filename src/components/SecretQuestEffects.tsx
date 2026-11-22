import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  creditPendingSecrets,
  SECRET_QUESTS,
  unlockSecret,
  type SecretQuestId,
} from "@/lib/quests";

const KONAMI = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
];
const WORD = ["z", "e", "n", "k", "a", "i"];

export function SecretQuestEffects() {
  const [queue, setQueue] = useState<SecretQuestId[]>([]);
  useEffect(() => {
    try {
      creditPendingSecrets();
    } catch {
      toast.error("Crédit des anciens succès secrets impossible. Vérifie le stockage local.");
    }
    let keys: string[] = [];
    let logoClicks = 0;
    const unlock = (id: SecretQuestId) => {
      try {
        unlockSecret(id);
      } catch {
        toast.error("Succès secret indisponible. Vérifie le stockage local.");
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        (target instanceof Element &&
          target.closest(
            "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']",
          ))
      ) {
        keys = [];
        return;
      }
      if (event.repeat) return;
      keys = [...keys, event.key.toLowerCase()].slice(-KONAMI.length);
      if (keys.slice(-WORD.length).join(",") === WORD.join(",")) unlock("word");
      if (keys.join(",") === KONAMI.join(",")) unlock("konami");
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-secret-logo]")) {
        logoClicks++;
        if (logoClicks === 10) {
          unlock("clicker");
          logoClicks = 0;
        }
      } else {
        logoClicks = 0;
      }
    };
    const onUnlock = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const quest = SECRET_QUESTS.find((item) => item.id === event.detail);
      if (quest) setQueue((current) => [...current, quest.id]);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    window.addEventListener("zenkai:secret-unlocked", onUnlock);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
      window.removeEventListener("zenkai:secret-unlocked", onUnlock);
    };
  }, []);
  const currentId = queue[0];
  const quest = SECRET_QUESTS.find((item) => item.id === currentId);
  if (!quest) return null;
  return (
    <div
      key={quest.id}
      className="secret-reveal pointer-events-auto fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-black/92 px-4 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Fermer la révélation"
        className="absolute inset-0 w-full cursor-pointer"
        onClick={(event) => {
          event.stopPropagation();
          setQueue((current) => current.slice(1));
        }}
      />
      <div
        role="status"
        aria-live="polite"
        className="secret-reveal-plaque pointer-events-none relative w-full max-w-xl rounded-2xl border-2 border-yellow-300 bg-gradient-to-br from-violet-950 via-black to-amber-950 p-7 text-center shadow-[0_0_45px_rgba(168,85,247,0.65),inset_0_0_32px_rgba(253,224,71,0.15)] sm:p-10"
      >
        <p className="text-xs font-black tracking-[0.2em] text-violet-200 sm:text-sm">
          ✦ MISSION SECRÈTE ACCOMPLIE ✦
        </p>
        <p className="mt-4 font-display text-2xl font-black text-yellow-300 [text-shadow:0_0_18px_rgba(253,224,71,0.8)] sm:text-4xl">
          {quest.name}
        </p>
        <p className="mt-3 text-sm text-violet-200">{quest.action}</p>
        <div className="mt-4 rounded-xl border border-yellow-300/60 bg-amber-400/15 px-4 py-3 text-amber-100">
          <p className="text-sm font-bold text-amber-100">
            Récompenses créditées :{" "}
            <span className="text-lg font-black text-yellow-200">
              +{quest.zen.toLocaleString("fr-FR")} Zen · +{quest.xp} XP
            </span>
          </p>
          {"title" in quest && (
            <p className="mt-1 text-sm font-bold">Titre débloqué : {quest.title}</p>
          )}
        </div>
        <p className="secret-reveal-hint mt-3 text-xs text-violet-200">
          Clique n'importe où pour continuer
        </p>
        <span aria-hidden="true" className="absolute left-4 top-4 text-yellow-300">
          ✦
        </span>
        <span aria-hidden="true" className="absolute bottom-4 right-4 text-violet-300">
          ✦
        </span>
      </div>
    </div>
  );
}
