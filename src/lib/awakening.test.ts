import { describe, expect, it, vi } from "vitest";
import { AWAKENING_DURATION_MS, AWAKENING_ALTERNATION_MS, awakeningAlternation, awakeningPhraseIndex, canRevealEvolution, playAwakeningAudio } from "./awakening";
import { cardArt } from "./cards";
import ultraInstinct from "@/assets/goku-ultra-instinct.png.asset.json";

describe("original awakening audio", () => {
  it("reveals after seven seconds", () => expect(AWAKENING_DURATION_MS).toBe(7000));
  it("alternates from the start for approximately 2.2 seconds", () => {
    expect(AWAKENING_ALTERNATION_MS).toBe(2220);
    expect(awakeningAlternation(0).awakenedOpacity).toBe(0);
    expect(awakeningAlternation(0.35).awakenedOpacity).toBe(1);
    expect(awakeningAlternation(0.7).awakenedOpacity).toBe(0);
    expect(awakeningAlternation(2.219).phase).toBe("alternating");
  });
  it("finishes with one 250ms flash and holds the awakened face", () => {
    expect(awakeningAlternation(2.22).phase).toBe("flash");
    expect(awakeningAlternation(2.469).phase).toBe("flash");
    expect(awakeningAlternation(2.47)).toEqual({ progress: 1, awakenedOpacity: 1, phase: "settled" });
  });
  it("softens contrast for the fastest swaps", () => {
    expect(awakeningAlternation(1.8).awakenedOpacity).toBe(0.45);
    expect(awakeningAlternation(1.9).awakenedOpacity).toBe(0.55);
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
