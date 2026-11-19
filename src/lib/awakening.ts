import transformation from "@/assets/goku-transformation.m4a.asset.json";

export const AWAKENING_AUDIO_URL = transformation.url;
export const AWAKENING_DURATION_MS = 7000;
export const AWAKENING_QUOTE = "Mais ceux qui ont fait du mal à mes amis... je ne le pardonnerai jamais !";
export function awakeningWordCount(elapsedMs: number) {
  const total = AWAKENING_QUOTE.split(" ").length;
  return Math.min(total, Math.max(1, Math.floor(elapsedMs / 6000 * total) + 1));
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