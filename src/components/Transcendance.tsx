import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/AnimeCard";
import { supabase } from "@/integrations/supabase/client";
import { cardIdentity, GOKU_CARD_ID, TRANSCEND_CHANCE_LABEL, type Card } from "@/lib/cards";
import { AWAKENING_TIMING, GOKU_AWAKENING_QUOTE, speakAwakening } from "@/lib/awakening";
import { playCharge, playExplosion, playFizzle } from "@/lib/sfx";
import { cn } from "@/lib/utils";

type Result = "transcended" | "failed";
type Stage = "charge" | "explosion" | "reveal" | "done";

const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  return { x: Math.cos(a) * 220, y: Math.sin(a) * 300, d: (i % 6) * 0.3 };
});

/** Shown once per mythique copy, with the current test probability. */
export function TranscendButton({
  userCardId,
  card,
  onResult,
  className,
  size = "sm",
}: {
  userCardId: string;
  card: Card;
  onResult?: (r: Result) => void;
  className?: string;
  size?: "sm" | "xs";
}) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<Result | null>(null);
  const [open, setOpen] = useState(false);
  const [spokenIndex, setSpokenIndex] = useState(0);
  const stopSpeech = useRef<() => void>(() => {});
  const quote = card.id === GOKU_CARD_ID ? GOKU_AWAKENING_QUOTE : card.quote ?? "";

  useEffect(() => {
    // Prime the asynchronous browser voice catalogue before the user clicks.
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    return () => stopSpeech.current();
  }, []);

  async function attempt() {
    if (open) return;
    setSpokenIndex(0);
    stopSpeech.current = speakAwakening(quote, setSpokenIndex);
    playCharge(1.5, 0.045);
    setOpen(true);
    setResult(null);
    const { data, error } = await supabase.rpc("attempt_transcendance", { _user_card_id: userCardId });
    if (error) {
      stopSpeech.current();
      setOpen(false);
      toast.error(error.message.includes("already_attempted") ? "Cet exemplaire a déjà tenté l'éveil." : "L'éveil n'a pas pu être lancé.");
      return;
    }
    const r: Result = data ? "transcended" : "failed";
    setResult(r);
    queryClient.invalidateQueries({ queryKey: ["collection"] });
  }

  function close() {
    stopSpeech.current();
    setOpen(false);
    if (result) onResult?.(result);
  }

  return (
    <>
      <Button
        type="button"
        variant="transcend"
        size="sm"
        onClick={attempt}
        disabled={open}
        className={cn("h-auto min-h-9 w-full max-w-64 whitespace-normal rounded-lg px-3 py-2 text-center leading-snug", size === "xs" && "gap-1 px-2 text-[10px]", className)}
      >
        <Sparkles /> Tenter la Transcendance · {TRANSCEND_CHANCE_LABEL}
      </Button>
      {open && <AwakeningScene card={card} quote={quote} spokenIndex={spokenIndex} result={result} onClose={close} />}
    </>
  );
}

function AwakeningScene({ card, quote, spokenIndex, result, onClose }: { card: Card; quote: string; spokenIndex: number; result: Result | null; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("charge");

  useEffect(() => {
    const timers = [
      window.setTimeout(() => { setStage("explosion"); playExplosion(0.22); }, AWAKENING_TIMING.explosion),
      window.setTimeout(() => setStage("reveal"), AWAKENING_TIMING.reveal),
      window.setTimeout(() => setStage("done"), AWAKENING_TIMING.complete),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (result === "failed") playFizzle();
  }, [result]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const cinematic = result !== "failed";
  const shaking = stage === "charge";
  const transcended = result === "transcended" && (stage === "reveal" || stage === "done");

  return createPortal(
    <div role="dialog" aria-modal aria-label="Éveil Transcendance" data-stage={stage} className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-letterbox">
      {cinematic && (
        <>
          <div className="absolute inset-x-0 top-0 h-[12vh] origin-top animate-letterbox bg-letterbox" />
          <div className="absolute inset-x-0 bottom-0 h-[12vh] origin-bottom animate-letterbox bg-letterbox" />
        </>
      )}

      <div className="relative flex max-h-[72dvh] w-full flex-col items-center justify-center">
        {/* Aura */}
        {cinematic && (
          <>
            <div aria-hidden className={cn("awakening-aura pointer-events-none absolute", stage === "charge" ? "awakening-charge" : "awakening-divine")} />
            {stage === "charge" && <div aria-hidden className="awakening-rays pointer-events-none absolute" />}
            {PARTICLES.map((p, i) => (
              <span
                key={i}
                aria-hidden
                className={cn("absolute left-1/2 top-1/2 size-2 rounded-full bg-rarity-transcendance", transcended ? "awakening-mote" : "animate-particle")}
                style={{ ["--px" as string]: `${p.x}px`, ["--py" as string]: `${p.y}px`, animationDelay: `${p.d}s` }}
              />
            ))}
          </>
        )}
        {!cinematic && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="absolute size-40 animate-smoke rounded-full bg-[var(--smoke)] blur-2xl"
                style={{ left: `${-20 + i * 20}%`, top: `${30 + (i % 2) * 25}%`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}

        <div className={cn(stage === "charge" && "awakening-rise", transcended && stage === "reveal" && "awakening-reveal")}>
          <div className={cn(shaking && "animate-quake")}>
            <div className="flip-scene w-[min(15rem,34dvh,65vw)]">
              <AnimeCard card={card} transcended={transcended} />
            </div>
          </div>
        </div>

        <div className="relative z-40 mt-7 min-h-24 max-w-xl px-6 text-center">
          {stage === "done" && transcended && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-90 duration-700">
              <p className="font-display text-3xl font-black uppercase text-gradient-transcend sm:text-4xl">Transcendance</p>
               <p className="text-sm text-muted-foreground">{cardIdentity(card, true).name} a dépassé ses limites pour toujours.</p>
              <Button variant="hero" className="rounded-full" onClick={onClose}>Continuer</Button>
            </div>
          )}
          {stage === "done" && result === "failed" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500">
              <p className="font-display text-2xl font-black uppercase text-muted-foreground">Éveil échoué</p>
              <p className="text-sm text-muted-foreground">{card.name} reste Mythique.</p>
              <Button variant="glass" className="rounded-full" onClick={onClose}><X /> Fermer</Button>
            </div>
          )}
          {stage === "done" && !result && <p className="text-sm text-muted-foreground">Éveil en cours…</p>}
        </div>
      </div>

      {quote && cinematic && (
        <p aria-label={quote} className="absolute inset-x-0 bottom-[3dvh] z-[60] mx-auto max-w-3xl px-5 text-center text-base font-bold italic leading-relaxed sm:text-xl">
          {quote.split(/(\s+)/).map((word, index, words) => {
            const start = words.slice(0, index).join("").length;
            return <span key={index} className={start <= spokenIndex ? "text-rarity-transcendance" : "text-rarity-legendaire"}>{word}</span>;
          })}
        </p>
      )}
      {stage === "explosion" && <>
        <div aria-hidden className="awakening-shockwave pointer-events-none absolute z-50" />
        <div aria-hidden className="awakening-flash pointer-events-none absolute inset-0 z-50 bg-flash" />
      </>}
    </div>,
    document.body,
  );
}
