import { cn } from "@/lib/utils";
import { CARD_ART, RARITY, type Card } from "@/lib/cards";

type Props = {
  card: Card;
  flipped?: boolean;
  className?: string;
  count?: number;
  locked?: boolean;
};

/** Trading card with a flip animation and a rarity-coloured outline. */
export function AnimeCard({ card, flipped = true, className, count, locked }: Props) {
  const r = RARITY[card.rarity];
  return (
    <div className={cn("flip-scene aspect-[2/3] w-full", className)}>
      <div className={cn("flip-inner size-full", flipped && "flipped")}>
        {/* Back */}
        <div className="flip-face card-back grid place-items-center rounded-2xl border border-border">
          <span className="font-display text-xl font-bold tracking-[0.3em] text-foreground/70">ZENKAI</span>
        </div>

        {/* Front */}
        <div
          className={cn(
            "flip-face flip-front overflow-hidden rounded-2xl bg-surface",
            locked ? "border border-border" : r.glow,
          )}
        >
          <img
            src={CARD_ART[card.id]}
            alt={card.name}
            loading="lazy"
            className={cn("size-full object-cover", locked && "opacity-25 grayscale")}
          />
          {card.rarity === "legendaire" && !locked && (
            <div className="holo-sheen pointer-events-none absolute inset-0 animate-sheen" />
          )}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2.5">
            <span
              className={cn(
                "rounded-full bg-background/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur",
                r.text,
              )}
            >
              {r.label}
            </span>
            {count && count > 1 ? (
              <span className="rounded-full bg-gradient-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                ×{count}
              </span>
            ) : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-3 pt-10">
            <p className="font-display text-sm font-bold leading-tight sm:text-base">
              {locked ? "???" : card.name}
            </p>
            <p className={cn("text-[11px] font-medium", r.text)}>{locked ? "Non obtenue" : card.title}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
