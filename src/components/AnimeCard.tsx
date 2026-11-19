import { cn } from "@/lib/utils";
import { cardArt, cardIdentity, RARITY, type Card, type Rarity } from "@/lib/cards";

type Props = {
  card: Card;
  flipped?: boolean | undefined;
  className?: string | undefined;
  count?: number | undefined;
  locked?: boolean | undefined;
  /** This copy evolved into Transcendance. */
  transcended?: boolean | undefined;
  compact?: boolean | undefined;
};

const SPARKS = [
  [8, 12], [88, 6], [94, 48], [4, 62], [80, 92], [20, 96], [50, -3], [-3, 30],
] as const;

export function displayRarity(card: Card, transcended?: boolean): Rarity {
  return transcended ? "transcendance" : card.rarity;
}

/** Sparkles + rainbow frame used around Transcendance cards. */
export function TranscendFrame() {
  return (
    <>
      <div aria-hidden className="divine-card-aura pointer-events-none absolute -inset-4 rounded-2xl" />
      <div aria-hidden className="frame-transcend" />
      <div aria-hidden className="pointer-events-none absolute -inset-6 z-20">
        {SPARKS.map(([x, y], i) => (
          <span
            key={i}
            className="absolute size-2.5 animate-twinkle rounded-[2px] bg-rarity-transcendance"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.2}s`, clipPath: "polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)" }}
          />
        ))}
        {SPARKS.map(([x, y], i) => (
          <span key={`mote-${i}`} aria-hidden className="divine-card-mote absolute size-1 rounded-full bg-flash"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.35}s` }} />
        ))}
      </div>
    </>
  );
}

/** Trading card with a flip animation and a rarity-coloured frame. */
export function AnimeCard({ card, flipped = true, className, count, locked, transcended, compact }: Props) {
  const rarity = displayRarity(card, transcended);
  const r = RARITY[rarity];
  const art = cardArt(card, transcended);
  const identity = cardIdentity(card, transcended);
  return (
    <div className={cn("flip-scene relative aspect-[2/3] w-full", className)}>
      {!locked && flipped && rarity === "mythique" && <div aria-hidden className="flame-aura" />}
      {!locked && flipped && rarity === "transcendance" && <TranscendFrame />}
      <div className={cn("flip-inner size-full", flipped && "flipped")}>
        <div className="flip-face card-back grid place-items-center rounded-2xl border border-border">
          <span className={cn("font-display font-bold tracking-[0.3em] text-foreground/70", compact ? "text-[10px]" : "text-xl")}>ZENKAI</span>
        </div>

        <div className={cn("flip-face flip-front overflow-hidden rounded-2xl bg-surface", locked ? "border border-border" : r.glow)}>
          {art ? (
            <img src={art} alt={identity.name} loading="lazy" className={cn("size-full object-cover", locked && "silhouette")} />
          ) : null}
          {(rarity === "legendaire" || rarity === "mythique" || rarity === "transcendance") && !locked && (
            <div className="holo-sheen pointer-events-none absolute inset-0 animate-sheen" />
          )}
          {rarity === "transcendance" && !locked && (
            <>
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-rarity-transcendance/40 via-transparent to-rarity-transcendance/20 mix-blend-screen" />
              <div aria-hidden className="divine-card-sheen pointer-events-none absolute inset-0" />
            </>
          )}
          <div className={cn("absolute inset-x-0 top-0 flex items-center justify-between", compact ? "p-1" : "p-2.5")}>
            <span
              className={cn(
                "rounded-full bg-background/85 font-semibold uppercase tracking-wider backdrop-blur",
                compact ? "px-1.5 py-px text-[7px]" : "px-2.5 py-0.5 text-[10px]",
                locked ? "text-muted-foreground" : r.text,
              )}
            >
              {r.label}
            </span>
            {count && count > 1 ? (
              <span className="rounded-full bg-gradient-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">×{count}</span>
            ) : null}
          </div>
          <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent", compact ? "p-1.5 pt-5" : "p-3 pt-10")}>
            <p className={cn("font-display font-bold leading-tight", compact ? "truncate text-[9px]" : "text-sm sm:text-base")}>
              {locked ? "???" : identity.name}
            </p>
            {!compact && (
              <p className={cn("text-[11px] font-medium", locked ? "text-muted-foreground" : r.text)}>
                {locked ? card.series ?? "Non obtenue" : identity.title}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
