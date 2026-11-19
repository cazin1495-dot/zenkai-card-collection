import { useRef, useState, type PointerEvent } from "react";
import { ChevronRight, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/AnimeCard";
import { RARITY, type Card } from "@/lib/cards";
import { cn } from "@/lib/utils";

const SWIPE_DISTANCE = 50;

type Props = {
  cards: Card[];
  onDone: () => void;
};

/** Reveals booster cards one at a time: tap or swipe to flip, then "Carte suivante". */
export function CardReveal({ cards, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);

  const card = cards[index];
  if (!card) return null;
  const r = RARITY[card.rarity];
  const isLast = index === cards.length - 1;

  function flip() {
    if (flipped) return;
    setFlipped(true);
    setDragX(0);
  }

  function next() {
    if (isLast) {
      onDone();
      return;
    }
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (flipped) return;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (startX.current === null || flipped) return;
    const dx = e.clientX - startX.current;
    setDragX(dx);
    if (Math.abs(dx) > SWIPE_DISTANCE) {
      startX.current = null;
      flip();
    }
  }
  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    setDragX(0);
    flip();
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div
        className="mb-4 flex items-center gap-2"
        aria-label={`Carte ${index + 1} sur ${cards.length}`}
      >
        {cards.map((_, i) => (
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

      <div className="relative">
        {/* Rarity burst behind the card once it's revealed */}
        {flipped && (
          <div
            key={`burst-${index}`}
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl animate-rarity-burst",
              r.bg,
              card.rarity === "legendaire" && "size-96",
            )}
          />
        )}

        <div key={`card-${index}`} className="animate-card-in">
          <button
            type="button"
            onClick={flip}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              startX.current = null;
              setDragX(0);
            }}
            aria-label={flipped ? `${card.name}, ${r.label}` : "Retourner la carte"}
            className={cn(
              "relative block w-52 touch-none select-none transition-transform sm:w-60",
              !flipped && "cursor-pointer",
            )}
            style={{
              transform: dragX
                ? `translateX(${dragX * 0.4}px) rotate(${dragX * 0.06}deg)`
                : undefined,
            }}
          >
            <div className={cn(!flipped && "animate-suspense")}>
              <AnimeCard card={card} flipped={flipped} />
            </div>
          </button>
        </div>
      </div>

      <div className="mt-6 flex min-h-24 flex-col items-center gap-3 text-center">
        {flipped ? (
          <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 [animation-delay:500ms] [animation-fill-mode:both]">
            <p className={cn("font-display text-xs font-bold uppercase tracking-[0.3em]", r.text)}>
              {r.label}
            </p>
            <Button variant="hero" size="lg" className="rounded-full" onClick={next}>
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
