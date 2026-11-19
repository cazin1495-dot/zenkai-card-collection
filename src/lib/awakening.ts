import transformation from "@/assets/goku-transformation.m4a.asset.json";

export const AWAKENING_AUDIO_URL = transformation.url;
export const AWAKENING_DURATION_MS = 7000;
export const AWAKENING_PHRASE_CHANGE_MS = 3500;
export const AWAKENING_PHRASES = [
  "Mais ceux qui ont fait du mal à mes amis...",
  "Je ne le pardonnerai jamais !",
] as const;
export function awakeningPhraseIndex(elapsedMs: number) {
  return elapsedMs < AWAKENING_PHRASE_CHANGE_MS ? 0 : 1;
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