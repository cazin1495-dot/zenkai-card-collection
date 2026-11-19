import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Play, SkipForward, Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/AnimeCard";
import { supabase } from "@/integrations/supabase/client";
import { cardIdentity, TRANSCEND_CHANCE_LABEL, type Card } from "@/lib/cards";
import { AWAKENING_AUDIO_URL, AWAKENING_PHRASES, AWAKENING_PHRASE_WINDOWS, awakeningPhraseIndex, canRevealEvolution, playAwakeningAudio } from "@/lib/awakening";
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
  return <>
    <Button type="button" variant="transcend" size="sm" onClick={attempt} disabled={open}
      className={cn("h-auto min-h-9 w-full max-w-64 whitespace-normal rounded-lg px-3 py-2 text-center leading-snug", size === "xs" && "gap-1 px-2 text-[10px]", className)}>
      <Sparkles /> Tenter la Transcendance · {TRANSCEND_CHANCE_LABEL}
    </Button>
    {open && createPortal(
      <div role="dialog" aria-modal aria-label="Éveil Transcendance" data-stage={ended ? "done" : "audio"} className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-letterbox">
        {!ended ? <>
          <audio ref={videoRef} src={AWAKENING_AUDIO_URL} preload="auto" controls={false} aria-hidden className="hidden" onEnded={() => setEnded(true)} onError={() => setPlaybackError(true)} />
          {phraseIndex !== null && <p key={phraseIndex} data-phrase={phraseIndex} style={{ animationDelay: `${-(audioTime - AWAKENING_PHRASE_WINDOWS[phraseIndex].start)}s`, animationPlayState: "paused" }} className={cn("cinema-quote relative mx-auto max-w-4xl px-8 text-center font-sans font-semibold leading-relaxed", phraseIndex === 0 ? "cinema-quote-first text-xl sm:text-3xl" : "cinema-quote-impact text-2xl sm:text-4xl")}>
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
        </> : <div className="relative flex max-h-[90dvh] w-full flex-col items-center justify-center gap-6 px-5">
          {result ? <>
            <div className={cn("relative w-[min(17rem,42dvh,65vw)]", evolved ? "anime-card-arrival" : "animate-in fade-in duration-700")}>
              <AnimeCard card={card} transcended={evolved} />
            </div>
            <div className="relative flex flex-col items-center gap-3 text-center">
              <p className={cn("font-display text-2xl font-black uppercase sm:text-3xl", evolved ? "text-gradient-transcend" : "text-muted-foreground")}>{evolved ? "Transcendance" : "Éveil échoué"}</p>
              <p className="text-sm text-muted-foreground">{cardIdentity(card, evolved).name}</p>
              <Button variant="hero" onClick={close}>{evolved ? "Continuer" : <><X /> Fermer</>}</Button>
            </div>
          </> : <p className="text-sm text-muted-foreground">Éveil en cours…</p>}
        </div>}
        {evolved && <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div aria-hidden className="awakening-shockwave absolute" />
          <div aria-hidden className="anime-outro-flash absolute inset-0 bg-flash" />
        </div>}
      </div>, document.body,
    )}
  </>;
}
