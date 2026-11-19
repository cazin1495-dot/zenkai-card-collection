import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Play, Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/AnimeCard";
import { supabase } from "@/integrations/supabase/client";
import { cardIdentity, TRANSCEND_CHANCE_LABEL, type Card } from "@/lib/cards";
import { AWAKENING_VIDEO_URL, canRevealEvolution, playAwakeningVideo } from "@/lib/awakening";
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const running = useRef(false);
  const [open, setOpen] = useState(false);
  const [ended, setEnded] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [playbackError, setPlaybackError] = useState(false);

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
    void playAwakeningVideo(video).catch(() => setPlaybackError(true));
  }

  async function attempt() {
    if (running.current) return;
    running.current = true;
    // Mount the video synchronously so play() remains inside the user's click gesture.
    flushSync(() => {
      setResult(null);
      setEnded(false);
      setPlaybackError(false);
      setOpen(true);
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

  const evolved = canRevealEvolution(ended, result);
  return <>
    <Button type="button" variant="transcend" size="sm" onClick={attempt} disabled={open}
      className={cn("h-auto min-h-9 w-full max-w-64 whitespace-normal rounded-lg px-3 py-2 text-center leading-snug", size === "xs" && "gap-1 px-2 text-[10px]", className)}>
      <Sparkles /> Tenter la Transcendance · {TRANSCEND_CHANCE_LABEL}
    </Button>
    {open && createPortal(
      <div role="dialog" aria-modal aria-label="Éveil Transcendance" data-stage={ended ? "done" : "video"} className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-letterbox">
        {!ended ? <>
          <video ref={videoRef} src={AWAKENING_VIDEO_URL} playsInline preload="auto" controls={false}
            className="absolute inset-0 size-full object-contain" aria-label="Transformation de Son Goku"
            onEnded={() => setEnded(true)} onError={() => setPlaybackError(true)} />
          {playbackError && <div className="relative z-10 flex flex-col items-center gap-4 bg-background/90 p-6">
            <p className="text-sm text-foreground">La vidéo n’a pas pu démarrer.</p>
            <Button variant="transcend" onClick={play}><Play /> Relancer la vidéo</Button>
            <Button variant="glass" onClick={() => setEnded(true)}>Continuer</Button>
          </div>}
        </> : <div className="relative flex max-h-[90dvh] w-full flex-col items-center justify-center gap-6 px-5">
          {evolved && <div aria-hidden className="awakening-aura awakening-divine pointer-events-none absolute" />}
          {result ? <>
            <div className="relative w-[min(17rem,42dvh,65vw)] animate-in fade-in duration-700">
              <AnimeCard card={card} transcended={evolved} />
            </div>
            <div className="relative flex flex-col items-center gap-3 text-center">
              <p className={cn("font-display text-2xl font-black uppercase sm:text-3xl", evolved ? "text-gradient-transcend" : "text-muted-foreground")}>{evolved ? "Transcendance" : "Éveil échoué"}</p>
              <p className="text-sm text-muted-foreground">{cardIdentity(card, evolved).name}</p>
              <Button variant="hero" onClick={close}>{evolved ? "Continuer" : <><X /> Fermer</>}</Button>
            </div>
          </> : <p className="text-sm text-muted-foreground">Éveil en cours…</p>}
        </div>}
      </div>, document.body,
    )}
  </>;
}
