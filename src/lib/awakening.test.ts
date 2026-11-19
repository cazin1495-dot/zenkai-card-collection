import { describe, expect, it, vi } from "vitest";
import { AWAKENING_DURATION_MS, awakeningPhraseIndex, canRevealEvolution, playAwakeningAudio } from "./awakening";
import { cardArt } from "./cards";
import ultraInstinct from "@/assets/goku-ultra-instinct.png.asset.json";

describe("original awakening audio", () => {
  it("reveals after seven seconds", () => expect(AWAKENING_DURATION_MS).toBe(7000));
  it("keeps only the first phrase from zero until 3.5 seconds", () => {
    expect(awakeningPhraseIndex(0)).toBe(0);
    expect(awakeningPhraseIndex(3499)).toBe(0);
  });
  it("switches to the second phrase at 3.5 seconds through seven seconds", () => {
    expect(awakeningPhraseIndex(3500)).toBe(1);
    expect(awakeningPhraseIndex(6999)).toBe(1);
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
