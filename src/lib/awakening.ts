export const GOKU_AWAKENING_QUOTE = "Voici le pouvoir qui dépasse les dieux... L'Ultra Instinct !";
export const AWAKENING_TIMING = { explosion: 1500, reveal: 2500, complete: 4000 } as const;
export const AWAKENING_VOICE = { pitch: 0.85, rate: 0.95, volume: 1 } as const;

/** Voice APIs do not expose gender: prefer known masculine French voices, then any French voice. */
export function selectFrenchVoice(voices: SpeechSynthesisVoice[]) {
  const french = voices.filter((voice) => /^fr(?:-|_)/i.test(voice.lang));
  return french.find((voice) => /thomas|daniel|henri|paul|mathieu|nicolas|pierre|male\b/i.test(voice.name) && !/female/i.test(voice.name))
    ?? french.find((voice) => voice.default)
    ?? french[0];
}

/** Called synchronously from the click so browsers permit speech and audio playback. */
export function speakAwakening(text: string, onWord: (index: number) => void) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return () => {};
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = selectFrenchVoice(synth.getVoices());
  if (voice) utterance.voice = voice;
  utterance.lang = "fr-FR";
  Object.assign(utterance, AWAKENING_VOICE);
  utterance.onboundary = (event) => onWord(event.charIndex);
  utterance.onend = () => onWord(text.length);
  synth.speak(utterance);
  return () => {
    utterance.onboundary = null;
    utterance.onend = null;
    synth.cancel();
  };
}