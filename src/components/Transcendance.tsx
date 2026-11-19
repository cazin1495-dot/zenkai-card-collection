import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/AnimeCard";
import { supabase } from "@/integrations/supabase/client";
import { cardIdentity, type Card } from "@/lib/cards";
import { playCharge, playExplosion, playFizzle } from "@/lib/sfx";
import { cn } from "@/lib/utils";

type Result = "transcended" | "failed";
type Stage = "charge" | "quote" | "spin" | "done" | "smoke" | "failed";

const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  return { x: Math.cos(a) * 220, y: Math.sin(a) * 300, d: (i % 6) * 0.3 };
});

/** "Tenter la Transcendance (1 %)" — shown once per mythique copy. */
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

  async function attempt() {
    if (open) return;
    setOpen(true);
    setResult(null);
    const [{ data, error }] = await Promise.all([
      supabase.rpc("attempt_transcendance", { _user_card_id: userCardId }),
      new Promise((r) => setTimeout(r, 1800)),
    ]);
    if (error) {
      setOpen(false);
      toast.error(error.message.includes("already_attempted") ? "Cet exemplaire a déjà tenté l'éveil." : "L'éveil n'a pas pu être lancé.");
      return;
    }
    const r: Result = data ? "transcended" : "failed";
    setResult(r);
    queryClient.invalidateQueries({ queryKey: ["collection"] });
  }

  function close() {
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
        <Sparkles /> Tenter la Transcendance
      </Button>
      {open && <AwakeningScene card={card} result={result} onClose={close} />}
    </>
  );
}

function AwakeningScene({ card, result, onClose }: { card: Card; result: Result | null; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("charge");

  useEffect(() => {
    playCharge(3.4);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!result) return;
    const timers: number[] = [];
    if (result === "transcended") {
      setStage("quote");
      timers.push(window.setTimeout(() => setStage("spin"), 2600));
      timers.push(window.setTimeout(() => playExplosion(), 3200));
      timers.push(window.setTimeout(() => setStage("done"), 4100));
    } else {
      setStage("smoke");
      playFizzle();
      timers.push(window.setTimeout(() => setStage("failed"), 1600));
    }
    return () => timers.forEach(clearTimeout);
  }, [result]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const cinematic = result !== "failed";
  const shaking = stage === "charge" || stage === "quote" || stage === "smoke";
  const transcended = stage === "done";

  return createPortal(
    <div role="dialog" aria-modal aria-label="Éveil Transcendance" className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-background/95 backdrop-blur">
      {cinematic && (
        <>
          <div className="absolute inset-x-0 top-0 h-[12vh] origin-top animate-letterbox bg-letterbox" />
          <div className="absolute inset-x-0 bottom-0 h-[12vh] origin-bottom animate-letterbox bg-letterbox" />
        </>
      )}

      <div className="relative flex max-h-[76dvh] w-full flex-col items-center justify-center">
        {/* Aura */}
        {cinematic && stage !== "done" && (
          <>
            <div aria-hidden className="absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 animate-swirl rounded-full bg-gradient-rainbow opacity-40 blur-3xl" />
            <div aria-hidden className="absolute left-1/2 top-1/2 size-[380px] -translate-x-1/2 -translate-y-1/2 animate-swirl rounded-full border-4 border-dashed border-rarity-transcendance/60 blur-[2px] [animation-direction:reverse]" />
            {PARTICLES.map((p, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute left-1/2 top-1/2 size-2 animate-particle rounded-full bg-rarity-transcendance shadow-glow"
                style={{ ["--px" as string]: `${p.x}px`, ["--py" as string]: `${p.y}px`, animationDelay: `${p.d}s` }}
              />
            ))}
          </>
        )}
        {transcended && (
          <div aria-hidden className="absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rarity-transcendance/30 blur-3xl animate-halo" />
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

        <div className={cn(cinematic && (stage === "charge" || stage === "quote") && "animate-ascend")}>
          <div className={cn(shaking && "animate-quake")}>
            <div className={cn("flip-scene w-[min(15rem,40dvh)]", stage === "spin" && "animate-spin-3d")} style={{ transformStyle: "preserve-3d" }}>
              <AnimeCard card={card} transcended={transcended} />
            </div>
          </div>
        </div>

        <div className="relative z-40 mt-8 min-h-28 max-w-xl px-6 text-center">
          {stage === "charge" && <p className="animate-pulse font-display text-sm uppercase tracking-[0.4em] text-muted-foreground">Éveil en cours…</p>}
          {(stage === "quote" || stage === "spin") && card.quote && (
            <p className="animate-quote font-display text-lg font-bold italic text-foreground sm:text-2xl">« {card.quote} »</p>
          )}
          {stage === "done" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-90 duration-700">
              <p className="font-display text-3xl font-black uppercase text-gradient-transcend sm:text-4xl">Transcendance</p>
               <p className="text-sm text-muted-foreground">{cardIdentity(card, true).name} a dépassé ses limites pour toujours.</p>
              <Button variant="hero" className="rounded-full" onClick={onClose}>Continuer</Button>
            </div>
          )}
          {stage === "failed" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500">
              <p className="font-display text-2xl font-black uppercase text-muted-foreground">Éveil échoué</p>
              <p className="text-sm text-muted-foreground">{card.name} reste Mythique.</p>
              <Button variant="glass" className="rounded-full" onClick={onClose}><X /> Fermer</Button>
            </div>
          )}
        </div>
      </div>

      {stage === "spin" && <div aria-hidden className="pointer-events-none absolute inset-0 z-50 animate-flash bg-flash" />}
    </div>,
    document.body,
  );
}
