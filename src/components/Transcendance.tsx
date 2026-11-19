import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal, flushSync } from "react-dom";
import { Play, SkipForward, Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AnimeCard } from "@/components/AnimeCard";
import { FormFlipCard } from "@/components/FormFlipCard";
import { supabase } from "@/integrations/supabase/client";
import { cardArt, cardIdentity, TRANSCEND_CHANCE_LABEL, type Card } from "@/lib/cards";
import { AWAKENING_AUDIO_URL, AWAKENING_PHRASES, AWAKENING_PHRASE_WINDOWS, awakeningAlternation, awakeningPhraseIndex, canRevealEvolution, playAwakeningAudio } from "@/lib/awakening";
import { cn } from "@/lib/utils";

type Result = "transcended" | "failed";

export function TranscendButton({ userCardId, card, onResult, className, size = "sm" }: {
  userCardId: string;
  card: Card;
  onResult?: (r: Result) => void;
  className?: string;
  size?: "sm" | "xs";
}) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLAudioElement | null>(null);
  const running = useRef(false);
  const [open, setOpen] = useState(false);
  const [ended, setEnded] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [playbackError, setPlaybackError] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [form, setForm] = useState<"base" | "awakened">("awakened");
  const [formBusy, setFormBusy] = useState(false);
  const cinematicStack = useRef<HTMLDivElement | null>(null);
  const [framesReady, setFramesReady] = useState(false);

  useEffect(() => {
    // Warm both portraits before the click without delaying original audio.
    for (const awakened of [false, true]) {
      const image = new Image();
      image.src = cardArt(card, awakened);
    }
  }, [card]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const images = Array.from(cinematicStack.current?.querySelectorAll("img") ?? []);
    void Promise.all(images.map(image => image.decode().catch(() => undefined))).then(() => {
      if (!cancelled) setFramesReady(images.length === 2 && images.every(image => image.complete && image.naturalWidth > 0));
    });
    return () => { cancelled = true; };
  }, [open, card]);

  useEffect(() => {
    if (!open) return;
    if (ended || playbackError) return;
    let frame = 0;
    function syncAudio() {
      setAudioTime(videoRef.current?.currentTime ?? 0);
      frame = window.requestAnimationFrame(syncAudio);
    }
    frame = window.requestAnimationFrame(syncAudio);
    return () => window.cancelAnimationFrame(frame);
  }, [open, ended, playbackError]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  function play() {
    const video = videoRef.current;
    if (!video) return;
    setPlaybackError(false);
    void playAwakeningAudio(video).catch(() => setPlaybackError(true));
  }

  async function attempt() {
    if (running.current) return;
    running.current = true;
    // Mount audio synchronously so play() remains inside the user's click gesture.
    flushSync(() => {
      setResult(null);
      setEnded(false);
      setPlaybackError(false);
      setOpen(true);
      setAudioTime(0);
      setForm("awakened");
      setFormBusy(false);
      setFramesReady(false);
    });
    play();
    const { data, error } = await supabase.rpc("attempt_transcendance", { _user_card_id: userCardId });
    if (error) {
      videoRef.current?.pause();
      setOpen(false);
      running.current = false;
      toast.error(error.message.includes("already_attempted") ? "Cet exemplaire a déjà tenté l'éveil." : "L'éveil n'a pas pu être lancé.");
      return;
    }
    setResult(data ? "transcended" : "failed");
  }

  function close() {
    videoRef.current?.pause();
    setOpen(false);
    running.current = false;
    void queryClient.invalidateQueries({ queryKey: ["collection"] });
    if (result) onResult?.(result);
  }

  function skip() {
    videoRef.current?.pause();
    setEnded(true);
  }

  const evolved = canRevealEvolution(ended, result);
  const phraseIndex = awakeningPhraseIndex(audioTime);
  const alternation = awakeningAlternation(audioTime);
  const previewOpacity = framesReady && result !== "failed" ? alternation.awakenedOpacity : 0;
  const showingEvolved = evolved && form === "awakened";
  return <>
    <Button type="button" variant="transcend" size="sm" onClick={attempt} disabled={open}
      className={cn("h-auto min-h-9 w-full max-w-64 whitespace-normal rounded-lg px-3 py-2 text-center leading-snug", size === "xs" && "gap-1 px-2 text-[10px]", className)}>
      <Sparkles /> Tenter la Transcendance · {TRANSCEND_CHANCE_LABEL}
    </Button>
    {open && createPortal(
      <div role="dialog" aria-modal aria-label="Éveil Transcendance" data-stage={ended ? "done" : "audio"} className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-letterbox">
        {!ended ? <>
          <audio ref={videoRef} src={AWAKENING_AUDIO_URL} preload="auto" controls={false} aria-hidden className="hidden" onEnded={() => setEnded(true)} onError={() => setPlaybackError(true)} />
          <div className="awakening-orbit-scene relative grid place-items-center">
            <div aria-hidden className="awakening-orbits pointer-events-none absolute">
              {[0, 1, 2].map((i) => <span key={i} className="awakening-orbit absolute" style={{ "--orbit-index": i, animationDelay: `${-audioTime}s`, animationPlayState: "paused" } as CSSProperties} />)}
              {Array.from({ length: 18 }, (_, i) => <span key={`p-${i}`} className="awakening-dust absolute" style={{ left: `${12 + (i * 31 % 78)}%`, top: `${15 + (i * 23 % 70)}%`, animationDelay: `${-(audioTime + i * 0.29)}s`, animationPlayState: "paused" }} />)}
            </div>
            <div aria-hidden className="awakening-silver-column pointer-events-none absolute" style={{ opacity: alternation.progress * 0.65 }} />
            <div ref={cinematicStack} data-phase={alternation.phase} data-ready={framesReady} className="awakening-central-card relative aspect-[2/3] w-[min(15rem,38dvh,58vw)]" style={{ "--charge": alternation.progress, "--preview-opacity": previewOpacity, animationDelay: `${-(alternation.phase === "settled" ? audioTime - 2.47 : audioTime)}s`, animationPlayState: "paused" } as CSSProperties}>
              <div className="awakening-alternate-base absolute inset-0"><AnimeCard card={card} preload /></div>
              <div aria-hidden className="awakening-alternate-evolved absolute inset-0"><AnimeCard card={card} transcended preload /></div>
              <div aria-hidden className="awakening-charge-halo pointer-events-none absolute inset-0 rounded-2xl" />
            </div>
          </div>
          {phraseIndex !== null && <p key={phraseIndex} data-phrase={phraseIndex} style={{ animationDelay: `${-(audioTime - AWAKENING_PHRASE_WINDOWS[phraseIndex].start)}s`, animationPlayState: "paused" }} className={cn("cinema-quote awakening-subtitle absolute inset-x-0 mx-auto max-w-3xl px-7 text-center font-sans text-sm font-medium leading-relaxed sm:text-lg", phraseIndex === 0 ? "cinema-quote-first" : "cinema-quote-impact")}>
            {AWAKENING_PHRASES[phraseIndex]}
          </p>}
          <Button variant="ghost" size="sm" onClick={skip} className="absolute bottom-5 right-5 z-20 gap-1 text-xs text-muted-foreground hover:text-foreground">
            Passer <SkipForward className="size-3.5" />
          </Button>
          {playbackError && <div className="relative z-10 flex flex-col items-center gap-4 bg-background/90 p-6">
            <p className="text-sm text-foreground">Le son n’a pas pu démarrer.</p>
            <Button variant="transcend" onClick={play}><Play /> Relancer le son</Button>
            <Button variant="glass" onClick={skip}>Continuer</Button>
          </div>}
          {alternation.phase === "flash" && framesReady && result === "transcended" && <div aria-hidden className="awakening-clean-flash pointer-events-none absolute inset-0 z-30" style={{ animationDelay: `${-(audioTime - 2.22)}s`, animationPlayState: "paused" }} />}
        </> : <div className="relative flex max-h-[90dvh] w-full flex-col items-center justify-center gap-6 px-5">
          {result ? <>
            <div className={cn("relative w-[min(17rem,42dvh,65vw)]", evolved ? "awakening-settle" : "animate-in fade-in duration-700")}>
              {evolved ? <FormFlipCard card={card} form={form} onBusyChange={setFormBusy} /> : <AnimeCard card={card} />}
            </div>
            <div className="relative flex flex-col items-center gap-3 text-center">
              <p className="text-sm font-medium text-rarity-transcendance">{evolved ? cardIdentity(card, showingEvolved).name : "Éveil échoué"}</p>
              {evolved && <ToggleGroup data-form={form} type="single" value={form} disabled={formBusy} onValueChange={(value) => { if (!formBusy && (value === "base" || value === "awakened") && value !== form) setForm(value); }} aria-label="Forme de Son Goku" className="form-selector relative isolate grid grid-cols-2 gap-0 rounded-md border border-border bg-surface/70 p-1">
                <span aria-hidden className="form-selector-indicator pointer-events-none absolute rounded-sm bg-accent" />
                <ToggleGroupItem value="base" size="sm" className="relative z-10 px-3 text-xs data-[state=on]:bg-transparent data-[state=on]:text-accent-foreground">Forme de base</ToggleGroupItem>
                <ToggleGroupItem value="awakened" size="sm" className="relative z-10 px-3 text-xs data-[state=on]:bg-transparent data-[state=on]:text-accent-foreground">Forme Éveillée</ToggleGroupItem>
              </ToggleGroup>}
              <Button variant="hero" onClick={close}>{evolved ? "Continuer" : <><X /> Fermer</>}</Button>
            </div>
          </> : <p className="text-sm text-muted-foreground">Éveil en cours…</p>}
        </div>}
      </div>, document.body,
    )}
  </>;
}
