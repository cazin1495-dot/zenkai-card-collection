import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ChevronRight, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimeCard, type CardBackTheme } from "@/components/AnimeCard";
import { CardCinema } from "@/components/Transcendance";
import { RARITY, type PulledCard } from "@/lib/cards";
import { cn } from "@/lib/utils";
import { openingEffects, RARITY_GLOW_CONFIG } from "@/lib/pack-opening";

const SWIPE_DISTANCE = 50;

type Props = {
  cards: PulledCard[];
  onDone: () => void;
  /** Awakening outcome per copy (userCardId). */
  awakened?: Record<string, "transcended" | "failed">;
  onAwaken?: (userCardId: string, r: "transcended" | "failed") => void;
  backTheme?: CardBackTheme;
};

/** Tap once to reveal, tap again to advance; swipe reveals without also advancing. */
export function CardReveal({ cards, onDone, awakened = {}, onAwaken, backTheme }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [cinema, setCinema] = useState(false);
  const [flash, setFlash] = useState(false);
  const startX = useRef<number | null>(null);
  const swiped = useRef(false);

  const item = cards[index];
  if (!item) return null;
  const card = item.card;
  const state = awakened[item.userCardId];
  const transcended = state === "transcended";
  const customTranscendance = item.customTranscendance === true;
  const rarity = transcended || customTranscendance ? "transcendance" : card.rarity;
  const isTranscendence = rarity === "transcendance";
  const r = RARITY[rarity];
  const glow = RARITY_GLOW_CONFIG[rarity];
  const isLast = index === cards.length - 1;
  const glowStyle: CSSProperties & { "--rarity-glow-color": string } = {
    "--rarity-glow-color": glow.color,
  };

  function flip() {
    if (flipped) return;
    setFlipped(true);
    setCinema(transcended && !customTranscendance);
    setDragX(0);
  }

  function next() {
    if (isLast) {
      onDone();
      return;
    }
    setFlipped(false);
    setCinema(false); setFlash(false);
    setIndex((i) => i + 1);
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    swiped.current = false;
    if (flipped) return;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (startX.current === null || flipped) return;
    const dx = e.clientX - startX.current;
    setDragX(dx);
    if (Math.abs(dx) > SWIPE_DISTANCE) {
      swiped.current = true;
      startX.current = null;
      flip();
    }
  }
  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    setDragX(0);
  }

  function activateCard() {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (cinema) return;
    if (flipped) next();
    else flip();
  }

  return (
    <div className="flex w-full flex-col items-center bg-transparent">
      <div
        className="mb-4 flex items-center gap-2"
        aria-label={`Carte ${index + 1} sur ${cards.length}`}
      >
        {Array.from({ length: cards.length }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              i < index
                ? "w-6 bg-foreground/60"
                : i === index
                  ? "w-10 bg-gradient-primary"
                  : "w-6 bg-muted",
            )}
          />
        ))}
      </div>

      <div
        className={cn(
          "relative isolate bg-transparent",
          openingEffects(rarity).suspense && "card-reveal-premium",
          isTranscendence && "card-reveal-transcendence",
        )}
        data-rarity={rarity}
        data-transcendence-id={isTranscendence ? card.id : undefined}
        data-revealed={flipped ? "true" : "false"}
      >
        <div
          aria-hidden
          className="rarity-glow-layer"
          data-glow={glow.effect}
          data-particle-tone={glow.particleTone}
          data-revealed={flipped ? "true" : "false"}
          style={glowStyle}
        >
          <div className="rarity-glow-blur" />
          <div className="rarity-glow-secondary" />
          {flipped && glow.flash && <div className="rarity-glow-flash" />}
          {Array.from({ length: glow.particles }, (_, particle) => (
            <span className="rarity-glow-particle" key={particle} />
          ))}
        </div>
        <div
          key={`card-${index}`}
          className={cn(
            "relative z-10 bg-transparent",
            flipped && glow.shake ? "rarity-micro-shake" : "animate-card-in",
          )}
        >
          {cinema ? <div className="w-52 sm:w-60"><CardCinema card={card} onDone={() => { setCinema(false); setFlash(true); }} /></div> : <Button
            type="button"
            variant="ghost"
            onClick={activateCard}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              startX.current = null;
              setDragX(0);
            }}
            aria-label={flipped ? `${card.name}, ${r.label}` : "Retourner la carte"}
            className={cn(
              "relative block h-auto w-52 cursor-pointer touch-none select-none rounded-none bg-transparent p-0 transition-transform hover:bg-transparent sm:w-60",
            )}
            style={{
              transform: dragX
                ? `translateX(${dragX * 0.4}px) rotate(${dragX * 0.06}deg)`
                : undefined,
            }}
          >
            <div className={cn("card-reveal-flip bg-transparent", isTranscendence && !flipped && "transcendence-card-anticipation")}>
              <AnimeCard card={card} flipped={flipped} transcended={transcended} customTranscendance={customTranscendance} backTheme={backTheme} />
            </div>
            {isTranscendence && flipped && <div aria-hidden className="transcendence-reveal-flash pointer-events-none absolute inset-0 z-20 rounded-2xl" />}
          </Button>}
          {flash && <div aria-hidden className="card-cinema-flash pointer-events-none absolute inset-0" />}
        </div>
      </div>

      <div className="mt-6 flex min-h-24 flex-col items-center gap-3 text-center">
        {flipped ? (
          <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 [animation-delay:500ms] [animation-fill-mode:both]">
            <p className={cn("font-display text-xs font-bold uppercase tracking-[0.3em]", r.text)}>
              {r.label}
            </p>
            <Button variant="hero" size="lg" className="rounded-full" onClick={next} disabled={cinema}>
              {isLast ? "Voir le récapitulatif" : "Carte suivante"}
              <ChevronRight />
            </Button>
          </div>
        ) : (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Hand className="size-4 animate-bounce" /> Clique ou glisse la carte pour la retourner
          </p>
        )}
      </div>
    </div>
  );
}
