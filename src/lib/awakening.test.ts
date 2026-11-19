import { describe, expect, it, vi } from "vitest";
import { AWAKENING_TIMING, AWAKENING_VOICE, selectFrenchVoice, speakAwakening } from "./awakening";

const voice = (name: string, lang: string) => ({ name, lang, default: false } as SpeechSynthesisVoice);

describe("awakening timing", () => {
  it("charges for 1.5 seconds", () => expect(AWAKENING_TIMING.explosion).toBe(1500));
  it("reveals Ultra Instinct at 2.5 seconds", () => expect(AWAKENING_TIMING.reveal).toBe(2500));
  it("finishes its three stages at 4 seconds", () => expect(AWAKENING_TIMING.complete).toBe(4000));
});

describe("awakening speech", () => {
  it("uses a deep pitch of 0.85", () => expect(AWAKENING_VOICE.pitch).toBe(0.85));
  it("uses a speaking rate of 0.95", () => expect(AWAKENING_VOICE.rate).toBe(0.95));
  it("speaks at full volume", () => expect(AWAKENING_VOICE.volume).toBe(1));
  it("prefers a masculine French voice over English and other French voices", () => {
    const thomas = voice("Thomas", "fr-FR");
    expect(selectFrenchVoice([voice("Daniel", "en-US"), voice("Amélie", "fr-FR"), thomas])).toBe(thomas);
  });
  it("falls back to an available French voice", () => {
    const amelie = voice("Amélie", "fr-FR");
    expect(selectFrenchVoice([amelie])).toBe(amelie);
    expect(selectFrenchVoice([])).toBeUndefined();
  });
  it("speaks immediately and forwards speech boundaries for subtitles", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    const onWord = vi.fn();
    class Utterance { constructor(public text: string) {} }
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    vi.stubGlobal("window", { SpeechSynthesisUtterance: Utterance, speechSynthesis: { speak, cancel, getVoices: () => [voice("Thomas", "fr-FR")] } });
    try {
      const stop = speakAwakening("Une réplique", onWord);
      expect(speak).toHaveBeenCalledTimes(1);
      const utterance = speak.mock.calls[0]?.[0];
      expect(utterance).toMatchObject({ pitch: 0.85, rate: 0.95, volume: 1, lang: "fr-FR" });
      utterance.onboundary({ charIndex: 4 });
      expect(onWord).toHaveBeenCalledWith(4);
      stop();
      expect(cancel).toHaveBeenCalledTimes(2);
    } finally { vi.unstubAllGlobals(); }
  });
});