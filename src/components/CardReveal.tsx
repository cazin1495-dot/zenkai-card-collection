import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, FastForward, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimeCard, displayRarity, type CardBackTheme } from "@/components/AnimeCard";
import { RARITY, RARITY_ORDER, TRANSCEND_CHANCE_LABEL, rarityRank, type PulledCard } from "@/lib/cards";
import { cn } from "@/lib/utils";
import { openingEffects, RARITY_GLOW_CONFIG } from "@/lib/pack-opening";
import { useFavoriteCards } from "@/lib/favorites";

const SWIPE_DISTANCE = 50;
const TRANSCENDANCE_REVEAL_MS = 3000;

export function NewCardBadge({ inRow = false }: { inRow?: boolean }) {
  return <span className={cn("rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-black shadow-md", !inRow && "absolute right-0 top-0 z-30")}>NOUVEAU</span>;
}

type Props = {
  cards: PulledCard[];
  onDone: () => void;
  /** Awakening outcome per copy (userCardId). */
  awakened?: Record<string, "transcended" | "failed">;
  onAwaken?: (userCardId: string, r: "transcended" | "failed") => void;
  backTheme?: CardBackTheme;
};

/** Tap once to reveal, tap again to advance; swipe reveals without also advancing. */
export function CardReveal({
  cards,
  onDone,
  awakened = {},
  onAwaken,
  backTheme,
}: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [revealSequence, setRevealSequence] = useState(false);
  const [impactOrigin, setImpactOrigin] = useState<{ x: number; y: number } | null>(null);
  const { favoriteCardIds } = useFavoriteCards();
  const cardScene = useRef<HTMLDivElement | null>(null);
  const startX = useRef<number | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    if (!revealSequence) return;
    const finish = () => {
      swiped.current = false;
      setRevealSequence(false);
    };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = (event: MediaQueryListEvent) => { if (event.matches) finish(); };
    const updateOrigin = () => {
      const bounds = cardScene.current?.getBoundingClientRect();
      if (bounds) setImpactOrigin({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
    };
    const timer = window.setTimeout(finish, TRANSCENDANCE_REVEAL_MS);
    motion.addEventListener("change", onMotionChange);
    window.addEventListener("resize", updateOrigin);
    window.addEventListener("scroll", updateOrigin, true);
    updateOrigin();
    if (motion.matches) finish();
    return () => {
      window.clearTimeout(timer);
      motion.removeEventListener("change", onMotionChange);
      window.removeEventListener("resize", updateOrigin);
      window.removeEventListener("scroll", updateOrigin, true);
    };
  }, [revealSequence]);

  function getEffectiveRarity(candidate: PulledCard) {
    return displayRarity(candidate.card, awakened[candidate.userCardId] === "transcended" || candidate.transcended, candidate.customTranscendance);
  }

  function getRarityLevel(candidate: PulledCard): number {
    return RARITY_ORDER.length - 1 - rarityRank(getEffectiveRarity(candidate));
  }

  const item = cards[index];
  if (!item) return null;
  const card = item.card;
  const state = awakened[item.userCardId];
  const transcended = state === "transcended" || item.transcended === true;
  const customTranscendance = item.customTranscendance === true;
  const rarity = getEffectiveRarity(item);
  const isTranscendence = rarity === "transcendance";
  const r = RARITY[rarity];
  const glow = RARITY_GLOW_CONFIG[rarity];
  const isLast = index === cards.length - 1;
  const glowStyle: CSSProperties & { "--rarity-glow-color": string } = {
    "--rarity-glow-color": glow.color,
  };

  function flip() {
    if (flipped || revealSequence) return;
    setFlipped(true);
    if (isTranscendence && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealSequence(true);
    }
    setDragX(0);
  }

  function next() {
    if (revealSequence) return;
    if (isLast) {
      onDone();
      return;
    }
    setFlipped(false);
    setDragX(0);
    startX.current = null;
    swiped.current = false;
    setIndex((i) => i + 1);
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    swiped.current = false;
    if (flipped || revealSequence) return;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
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
    if (revealSequence) return;
    if (flipped) next();
    else flip();
  }

  const minTargetLevel = Math.max(3, getRarityLevel(item) + 1);
  const nextRareIndex = cards.findIndex(
    (candidate, candidateIndex) => candidateIndex > index && getRarityLevel(candidate) >= minTargetLevel,
  );
  const nextRare = cards[nextRareIndex];
  const nextRareRarity = nextRare ? getEffectiveRarity(nextRare) : null;

  function skipToNextRare() {
    if (!revealSequence && nextRareIndex >= 0) {
      setIndex(nextRareIndex);
      setFlipped(false);
      setDragX(0);
      startX.current = null;
      swiped.current = false;
    }
  }

  function fullSkip() {
    setRevealSequence(false);
    onDone();
  }

  return (
    <div className="flex w-full flex-col items-center bg-transparent">
      {revealSequence && createPortal(
        <>
        <div className="transcendence-blackout fixed inset-0 z-[100] grid place-items-center overflow-hidden">
          <div role="status" aria-label="Révélation Transcendance" className="transcendence-blackout-content pointer-events-none relative grid w-full place-items-center">
            <div aria-hidden className="transcendence-rift" />
            <div aria-hidden className="transcendence-invocation-ring transcendence-invocation-ring-gold" />
            <div aria-hidden className="transcendence-invocation-ring transcendence-invocation-ring-rainbow" />
            <div aria-hidden className="transcendence-blackout-stars">
              {Array.from({ length: 6 }, (_, i) => <span key={i}>✦</span>)}
            </div>
            <div aria-hidden className="transcendence-blackout-title-glow">
              <p className="transcendence-blackout-title">
                {"✦ TRANSCENDANCE ✦".split("").map((letter, index) => (
                  <span key={index} className="transcendence-blackout-letter" style={{ animationDelay: `${0.5 + index * 0.06}s, 0s` }}>{letter === " " ? "\u00a0" : letter}</span>
                ))}
              </p>
              <p className="transcendence-blackout-subtitle">ÉVEIL ULTIME · {TRANSCEND_CHANCE_LABEL.replace(".", ",")}</p>
              <p className="transcendence-blackout-rate-note">TAUX STANDARD</p>
            </div>
          </div>
          <div aria-hidden className="transcendence-blackout-flash pointer-events-none absolute inset-0" />
          <Button variant="glass" size="sm" onClick={fullSkip} className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 z-10 min-h-11">Full Skip</Button>
        </div>
        <div aria-hidden className="transcendence-slam-overlay pointer-events-none fixed inset-0 z-[101] overflow-hidden">
          {[0, 1].map((wave) => (
            <div key={wave} className={cn("transcendence-shockwave", wave === 1 && "transcendence-shockwave-second")}
              style={{ left: impactOrigin?.x ?? "50%", top: impactOrigin?.y ?? "50%" }} />
          ))}
        </div>
        </>,
        document.body,
      )}
      <div
        className="mb-4 flex max-w-full flex-wrap items-center justify-center gap-2"
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
        ref={cardScene}
        className={cn(
          "relative isolate bg-transparent",
          openingEffects(rarity).suspense && "card-reveal-premium",
          isTranscendence && "card-reveal-transcendence mt-9",
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
          {isTranscendence && flipped && <div className="transcendence-reveal-flash" />}
          {Array.from({ length: glow.particles }, (_, particle) => (
            <span className="rarity-glow-particle" key={particle} />
          ))}
        </div>
        {isTranscendence && flipped && <>
          <div aria-hidden className="transcendence-divine-rays pointer-events-none" />
          <div className="transcendence-ultimate-seal pointer-events-none">
            <span>✦ TRANSCENDANCE ULTIME · {TRANSCEND_CHANCE_LABEL.replace(".", ",")} ✦</span>
            <small>TAUX STANDARD</small>
          </div>
        </>}
        {isTranscendence && flipped && <div aria-hidden className="transcendence-arrival-stars pointer-events-none">
          {Array.from({ length: 12 }, (_, i) => <span key={i}>✦</span>)}
        </div>}
        <div
          key={`card-${index}`}
          className={cn(
            "relative z-10 bg-transparent",
            isTranscendence && flipped && "transcendence-card-settled",
            isTranscendence && revealSequence ? "transcendence-card-arrival"
              : flipped && glow.shake && !isTranscendence ? "rarity-micro-shake"
                : !flipped && "animate-card-in",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={activateCard}
            aria-disabled={revealSequence || undefined}
            tabIndex={revealSequence ? -1 : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              startX.current = null;
              setDragX(0);
            }}
            aria-label={flipped ? `${card.name}, ${r.label}` : "Retourner la carte"}
            className="relative block h-auto w-[min(260px,calc(100vw-2rem))] cursor-pointer touch-pan-y select-none rounded-none bg-transparent p-0 transition-transform hover:bg-transparent sm:w-[310px]"
            style={{
              transform: dragX
                ? `translateX(${dragX * 0.4}px) rotate(${dragX * 0.06}deg)`
                : undefined,
            }}
          >
            <div className={cn("card-reveal-flip bg-transparent", isTranscendence && !flipped && "transcendence-card-anticipation")}>
              <AnimeCard card={card} flipped={flipped} transcended={transcended} customTranscendance={customTranscendance} backTheme={backTheme} />
            </div>
          </Button>
          {flipped && (item.isNew || favoriteCardIds.includes(card.id)) && (
            <div className="pointer-events-none absolute right-0 top-0 z-30 flex gap-1">
              {item.isNew && <NewCardBadge inRow />}
              {favoriteCardIds.includes(card.id) && <span className="rounded-full border border-amber-300/70 bg-violet-950 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.7)]">★ FAVORI</span>}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex min-h-24 flex-col items-center gap-3 text-center">
        {flipped ? (
          <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 [animation-delay:500ms] [animation-fill-mode:both]">
            <p className={cn("font-display text-xs font-bold uppercase tracking-[0.3em]", r.text)}>
              {r.label}
            </p>
            <div className="flex flex-col items-center gap-2">
              <Button variant="hero" size="lg" className="rounded-full" onClick={next} disabled={revealSequence}>
                {isLast ? "Voir le récapitulatif" : "Carte suivante"}
                <ChevronRight />
              </Button>
            </div>
          </div>
        ) : (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Hand className="size-4 animate-bounce" /> Clique ou glisse la carte pour la retourner
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {nextRareRarity && (
          <Button variant="ghost" size="sm" onClick={skipToNextRare} disabled={revealSequence} className={cn(
            nextRareRarity === "transcendance"
              ? "bg-gradient-to-r from-amber-400 via-violet-600 to-amber-400 font-bold text-white shadow-[0_0_16px_rgba(251,191,36,0.5)] hover:bg-transparent hover:text-white hover:brightness-110"
              : nextRareRarity === "mythique"
                ? "bg-rose-600 font-bold text-white shadow-[0_0_12px_var(--rarity-mythique)] hover:bg-rose-500 hover:text-white"
                : nextRareRarity === "legendaire"
                  ? "bg-amber-500 font-bold text-black hover:bg-amber-400 hover:text-black"
                  : "bg-purple-600/80 text-white hover:bg-purple-500 hover:text-white",
          )}>
            <FastForward /> Skip → Prochaine {RARITY[nextRareRarity].label}
          </Button>
        )}
        {!revealSequence && <Button variant="glass" size="sm" onClick={fullSkip}>Full Skip</Button>}
      </div>
    </div>
  );
}
