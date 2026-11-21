import { useRef, useState, type PointerEvent } from "react";
import { Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardArt, cardIdentity, RARITY, type Card, type Rarity } from "@/lib/cards";

type Props = {
  card: Card;
  backTheme?: CardBackTheme | undefined;
  flipped?: boolean | undefined;
  className?: string | undefined;
  count?: number | undefined;
  locked?: boolean | undefined;
  /** This copy evolved into Transcendance. */
  transcended?: boolean | undefined;
  /** This is a dedicated custom card, not an evolved copy. */
  customTranscendance?: boolean | undefined;
  compact?: boolean | undefined;
  comparisonForm?: "base" | "awakened" | undefined;
  transformationKey?: number | undefined;
};

export type CardBackTheme = { image: string };

export function displayRarity(card: Card, transcended?: boolean, customTranscendance?: boolean): Rarity {
  return transcended || customTranscendance ? "transcendance" : card.rarity;
}

function CardIllustration({
  src,
  alt,
  className,
  fallbackClassName,
  loading = "lazy",
  ariaHidden = false,
}: {
  src: string;
  alt: string;
  className: string;
  fallbackClassName?: string | undefined;
  loading?: "eager" | "lazy";
  ariaHidden?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const fallback = (exposeToAccessibility: boolean) => (
    <div
      role={!ariaHidden && exposeToAccessibility ? "img" : undefined}
      aria-label={!ariaHidden && exposeToAccessibility ? alt || undefined : undefined}
      aria-hidden={ariaHidden || !exposeToAccessibility}
      className={cn(className, "card-art-fallback", fallbackClassName)}
    />
  );
  if (!src || failedSource === src) {
    return fallback(true);
  }
  return (
    <>
      {loadedSource !== src && fallback(false)}
      <img
        src={src}
        alt={alt}
        aria-hidden={ariaHidden}
        loading={loading}
        onLoad={() => setLoadedSource(src)}
        onError={() => setFailedSource(src)}
        className={cn(className, "object-cover")}
      />
    </>
  );
}

/** Prism frame and pointer-reactive holographic layers, kept behind the illustration. */
export function TranscendFrame() {
  return <>
    <div aria-hidden className="transcendence-cosmic-bg pointer-events-none absolute inset-0 z-0" />
    <div aria-hidden className="premium-energy-frame pointer-events-none absolute inset-0 z-30" />
    <div aria-hidden className="tcg-inner-frame pointer-events-none absolute z-30" />
    <div aria-hidden className="tcg-corners pointer-events-none absolute inset-0 z-30">
      {[0, 1, 2, 3].map((corner) => <span key={corner} className="tcg-corner" data-corner={corner} />)}
    </div>
    <div aria-hidden className="reverse-foil pointer-events-none absolute inset-0 z-10" />
    <div aria-hidden className="holo-prism pointer-events-none absolute inset-0 z-10" />
    <div aria-hidden className="holo-glitter pointer-events-none absolute inset-0 z-10" />
    <div aria-hidden className="tcg-engraving pointer-events-none absolute inset-0 z-10" />
    <div aria-hidden className="tcg-light-sweep pointer-events-none absolute inset-0 z-10" />
    <div aria-hidden className="premium-energy-particles pointer-events-none absolute inset-0 z-10">
      {Array.from({ length: 10 }, (_, i) => <span key={i} className="premium-energy-spark absolute" style={{ left: `${8 + (i * 29 % 85)}%`, top: `${35 + (i * 17 % 60)}%`, animationDelay: `${-i * 0.41}s` }} />)}
    </div>
  </>;
}

/** Trading card with a flip animation and a rarity-coloured frame. */
export function AnimeCard({ card, backTheme, flipped = true, className, count, locked, transcended, customTranscendance, compact, comparisonForm, transformationKey = 0 }: Props) {
  const rarity = displayRarity(card, transcended, customTranscendance);
  const r = RARITY[rarity];
  const art = cardArt(card, transcended);
  const identity = cardIdentity(card, transcended);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const interactive = rarity === "transcendance" && flipped && !locked;
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (!interactive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    const target = tiltRef.current;
    if (!target) return;
    target.style.setProperty("--tilt-x", `${(0.5 - y) * 16}deg`);
    target.style.setProperty("--tilt-y", `${(x - 0.5) * 16}deg`);
    target.style.setProperty("--holo-x", `${x * 100}%`);
    target.style.setProperty("--holo-y", `${y * 100}%`);
    target.dataset["active"] = "true";
  }
  function resetTilt() {
    const target = tiltRef.current;
    if (!target) return;
    target.style.setProperty("--tilt-x", "0deg");
    target.style.setProperty("--tilt-y", "0deg");
    target.dataset["active"] = "false";
  }
  return (
    <div onPointerMove={tilt} onPointerDown={tilt} onPointerLeave={resetTilt} onPointerUp={resetTilt} onPointerCancel={resetTilt}
      className={cn("flip-scene relative aspect-[2.5/3.5] w-full bg-transparent", interactive && "holo-interactive", className)}>
      <div
        ref={tiltRef}
        data-transcendence-id={rarity === "transcendance" ? card.id : undefined}
        className={cn("relative size-full bg-transparent", interactive && "holo-tilt")}
      >
      {!locked && flipped && rarity === "mythique" && <div aria-hidden className="flame-aura" />}
      {!locked && flipped && rarity === "transcendance" && <div aria-hidden className="premium-awakened-aura pointer-events-none absolute inset-0 z-0 rounded-2xl" />}
      <div className={cn("flip-inner size-full bg-transparent", flipped && "flipped")}>
        <div
          className={cn(
            "flip-face grid place-items-center overflow-hidden rounded-2xl bg-transparent",
            !backTheme && "card-back border border-border",
          )}
        >
          {backTheme ? (
            <div className="absolute inset-0 size-full overflow-hidden rounded-2xl bg-transparent">
              <img
                src={backTheme.image}
                alt=""
                aria-hidden
                loading="eager"
                className="h-full w-full scale-[1.12] rounded-2xl object-cover"
              />
            </div>
          ) : (
            <span className={cn("font-display font-bold tracking-[0.3em] text-foreground/70", compact ? "text-[10px]" : "text-xl")}>ZENKAI</span>
          )}
        </div>

        <div
          data-compact={compact ? "true" : "false"}
          data-transcendence-id={rarity === "transcendance" ? card.id : undefined}
          className={cn("flip-face flip-front overflow-hidden rounded-2xl bg-transparent", locked ? "border border-border" : rarity === "transcendance" ? "reverse-card" : r.glow)}
        >
          {comparisonForm ? (
            <div className="form-portrait-stack absolute inset-0 overflow-hidden" data-form={comparisonForm}>
              <CardIllustration
                src={cardArt(card, false)}
                alt={comparisonForm === "base" ? cardIdentity(card, false).name : ""}
                ariaHidden={comparisonForm !== "base"}
                loading="eager"
                className="form-portrait form-portrait-base absolute inset-0 size-full"
              />
              <CardIllustration
                src={cardArt(card, true)}
                alt={comparisonForm === "awakened" ? cardIdentity(card, true).name : ""}
                ariaHidden={comparisonForm !== "awakened"}
                loading="eager"
                className="form-portrait form-portrait-awakened absolute inset-0 size-full"
              />
            </div>
          ) : art ? (
            <CardIllustration
              src={art}
              alt={identity.name}
              fallbackClassName={customTranscendance ? "custom-transcendance-fallback" : undefined}
              className={cn(
                rarity === "transcendance" && !locked
                  ? "reverse-art z-20 h-full w-full mix-blend-normal opacity-100"
                  : "size-full",
                locked && "silhouette",
              )}
            />
          ) : null}
          {rarity === "transcendance" && !locked && (
            <div
              aria-hidden
              className="premium-holo-sweep pointer-events-none absolute inset-0 z-[21] overflow-hidden rounded-2xl"
            />
          )}
          {rarity === "transcendance" && !locked && (
            <div
              aria-hidden
              className="premium-bottom-shade pointer-events-none absolute inset-x-0 bottom-0 z-[25] h-[22%] bg-gradient-to-t from-black/80 via-black/35 to-transparent"
            />
          )}
          {(rarity === "legendaire" || rarity === "mythique") && !locked && (
            <div className="holo-sheen pointer-events-none absolute inset-0 animate-sheen" />
          )}
          {rarity === "transcendance" && !locked && <TranscendFrame />}
          <div className={cn(
            "absolute inset-x-0 top-0 flex items-start justify-between gap-1",
            rarity === "transcendance" && !locked ? "z-30" : "z-10",
            compact ? "p-1" : "p-2.5",
          )}>
            <span
              className={cn(
                "inline-flex min-w-0 items-center gap-1 rounded-md font-semibold uppercase",
                rarity === "transcendance" && !locked ? "premium-rarity-badge" : "bg-background/85 backdrop-blur",
                compact ? "px-1.5 py-px text-[7px]" : rarity === "transcendance" ? "px-1.5 py-0.5 text-[8px]" : "px-2.5 py-0.5 text-[10px]",
                locked ? "text-muted-foreground" : r.text,
              )}
            >
              {rarity === "transcendance" && !locked && <Star aria-hidden className={cn("shrink-0", compact ? "size-2" : "size-3")} />}
              {r.label}
            </span>
            {count && count > 1 ? (
              <span className="shrink-0 rounded-full bg-gradient-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">×{count}</span>
            ) : rarity === "transcendance" && !locked ? <span aria-hidden className={cn("tcg-universe-emblem grid shrink-0 place-items-center", compact ? "size-4" : "size-7")}><Sparkles className={compact ? "size-2.5" : "size-4"} /></span> : null}
          </div>
          <div className={cn(
            "premium-glass-label absolute inset-x-0 bottom-0",
            rarity === "transcendance" && !locked ? "z-30" : "z-10",
            compact ? "p-1.5 pt-4" : "p-3 pt-6",
          )}>
            <p className={cn(
              "font-bold leading-tight",
              rarity === "transcendance" && !locked
                ? "font-display text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
                : "font-display",
              compact ? "truncate text-[9px]" : "text-xs sm:text-sm",
            )}>
              {locked ? "???" : identity.name}
            </p>
            {!compact && (
              <p className={cn("font-medium", rarity === "transcendance" ? "text-[9px] leading-tight" : "text-[11px]", locked ? "text-muted-foreground" : r.text)}>
                {locked ? card.series ?? "Non obtenue" : identity.title}
              </p>
            )}
            {rarity === "transcendance" && !locked && (
              <p className={cn("tcg-collector-number mt-1.5 text-right font-semibold tabular-nums", compact ? "text-[6px]" : "text-[8px]")}>
                {card.transcendance_series_number ?? (card.id === "al-246" ? "ZEN-001-TR" : `ZEN-${String(card.sort_order + 1).padStart(3, "0")}-TR`)}
              </p>
            )}
          </div>
        </div>
      </div>
      {comparisonForm === "awakened" && transformationKey > 0 && <div key={transformationKey} aria-hidden className="form-energy-transition pointer-events-none absolute inset-0 z-20">
        <div className="premium-form-flash absolute inset-0 rounded-2xl" />
        <div className="premium-form-sweep absolute inset-0 overflow-hidden rounded-2xl" />
        <div className="premium-form-ring absolute" />
      </div>}
      </div>
    </div>
  );
}
