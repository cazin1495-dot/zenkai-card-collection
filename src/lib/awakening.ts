import transformation from "@/assets/goku-transformation.m4a.asset.json";

export const AWAKENING_AUDIO_URL = transformation.url;
export const AWAKENING_DURATION_MS = 7000;
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