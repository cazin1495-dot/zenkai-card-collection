import transformation from "@/assets/goku-transformation.mp4.asset.json";

export const AWAKENING_VIDEO_URL = transformation.url;

/** Run within the click gesture; never mute the original soundtrack. */
export function playAwakeningVideo(video: HTMLVideoElement) {
  video.muted = false;
  video.volume = 1;
  video.controls = false;
  return video.play();
}

export function canRevealEvolution(ended: boolean, result: "transcended" | "failed" | null) {
  return ended && result === "transcended";
}