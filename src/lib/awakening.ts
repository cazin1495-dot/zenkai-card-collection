import transformation from "@/assets/goku-transformation.m4a.asset.json";

export const AWAKENING_AUDIO_URL = transformation.url;
export const AWAKENING_DURATION_MS = 7000;
export const AWAKENING_ALTERNATION_DELAYS = [350, 350, 280, 280, 210, 210, 150, 100, 70, 50, 50, 40, 40, 40] as const;
export const AWAKENING_ALTERNATION_MS = AWAKENING_ALTERNATION_DELAYS.reduce((sum, delay) => sum + delay, 0);
export const AWAKENING_FLASH_MS = 250;
/** Audio-clock driven; fast swaps soften contrast rather than strobing. */
export function awakeningAlternation(currentTime: number) {
  const time = Math.max(0, currentTime * 1000);
  let boundary = 0;
  for (const [index, delay] of AWAKENING_ALTERNATION_DELAYS.entries()) {
    boundary += delay;
    if (time < boundary) return {
      progress: time / AWAKENING_ALTERNATION_MS,
      awakenedOpacity: delay <= 150 ? (index % 2 ? 0.55 : 0.45) : index % 2,
      phase: "alternating" as const,
    };
  }
  return { progress: 1, awakenedOpacity: 1, phase: time < AWAKENING_ALTERNATION_MS + AWAKENING_FLASH_MS ? "flash" as const : "settled" as const };
}
export const AWAKENING_PHRASE_WINDOWS = [{ start: 0.4, end: 3.8 }, { start: 4, end: 7 }] as const;
export const AWAKENING_PHRASES = [
  "Mais ceux qui ont fait du mal à mes amis...",
  "Je ne le pardonnerai jamais !",
] as const;
export function awakeningPhraseIndex(currentTime: number): 0 | 1 | null {
  const [first, second] = AWAKENING_PHRASE_WINDOWS;
  if (currentTime >= first.start && currentTime < first.end) return 0;
  if (currentTime >= second.start && currentTime < second.end) return 1;
  return null;
}

/** Run within the click gesture; never mute the original soundtrack. */
export function playAwakeningAudio(video: HTMLMediaElement) {
  video.muted = false;
  video.volume = 1;
  video.controls = false;
  return video.play();
}

export function canRevealEvolution(ended: boolean, result: "transcended" | "failed" | null) {
  return ended && result === "transcended";
}