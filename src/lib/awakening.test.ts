import { describe, expect, it, vi } from "vitest";
import { AWAKENING_DURATION_MS, awakeningPhraseIndex, awakeningSpinProgress, canRevealEvolution, playAwakeningAudio } from "./awakening";
import { cardArt } from "./cards";
import ultraInstinct from "@/assets/goku-ultra-instinct.png.asset.json";

describe("original awakening audio", () => {
  it("reveals after seven seconds", () => expect(AWAKENING_DURATION_MS).toBe(7000));
  it("accelerates the rotation only during the final two seconds", () => {
    expect(awakeningSpinProgress(4.999)).toBe(0);
    expect(awakeningSpinProgress(5)).toBe(0);
    expect(awakeningSpinProgress(6)).toBe(0.5);
    expect(awakeningSpinProgress(7)).toBe(1);
  });
  it("shows the first phrase only from audio time 0.4 to 3.8 seconds", () => {
    expect(awakeningPhraseIndex(0)).toBe(null);
    expect(awakeningPhraseIndex(0.399)).toBe(null);
    expect(awakeningPhraseIndex(0.4)).toBe(0);
    expect(awakeningPhraseIndex(3.799)).toBe(0);
    expect(awakeningPhraseIndex(3.8)).toBe(null);
  });
  it("shows the second phrase only from audio time 4.0 to 7.0 seconds", () => {
    expect(awakeningPhraseIndex(3.999)).toBe(null);
    expect(awakeningPhraseIndex(4)).toBe(1);
    expect(awakeningPhraseIndex(6.999)).toBe(1);
    expect(awakeningPhraseIndex(7)).toBe(null);
  });
  it("plays immediately with the original audio at 100 percent and no controls", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const video = { muted: true, volume: 0, controls: true, play } as unknown as HTMLVideoElement;
    playAwakeningAudio(video);
    expect(play).toHaveBeenCalledTimes(1);
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(1);
    expect(video.controls).toBe(false);
  });
  it("reveals the evolved card only when the video ends and success is confirmed", () => {
    expect(canRevealEvolution(false, "transcended")).toBe(false);
    expect(canRevealEvolution(true, "transcended")).toBe(true);
    expect(canRevealEvolution(true, null)).toBe(false);
    expect(canRevealEvolution(true, "failed")).toBe(false);
  });
  it("uses the supplied colour portrait for evolved Goku and retains the base portrait", () => {
    const card = { id: "al-246", image_url: "original.png" };
    expect(cardArt(card, true)).toBe(ultraInstinct.url);
    expect(cardArt(card, false)).toBe("original.png");
    expect(cardArt({ id: "other", image_url: "other.png" }, true)).toBe("other.png");
  });
});
