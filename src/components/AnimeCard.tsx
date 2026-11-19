import { useRef, type PointerEvent } from "react";
import { Sparkles, Star } from "lucide-react";
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
  comparisonForm?: "base" | "awakened" | undefined;
  transformationKey?: number | undefined;
  preload?: boolean;
};

export function displayRarity(card: Card, transcended?: boolean): Rarity {
  return transcended ? "transcendance" : card.rarity;
}

/** Metallic frame and low-opacity pointer-reactive varnish. */
export function TranscendFrame() {
  return <>
    <div aria-hidden className="premium-energy-frame pointer-events-none absolute inset-0" />
    <div aria-hidden className="tcg-inner-frame pointer-events-none absolute" />
    <div aria-hidden className="tcg-corners pointer-events-none absolute inset-0">
      {[0, 1, 2, 3].map((corner) => <span key={corner} className="tcg-corner" data-corner={corner} />)}
    </div>
    <div aria-hidden className="reverse-foil pointer-events-none absolute inset-0" />
    <div aria-hidden className="tcg-engraving pointer-events-none absolute inset-0" />
    <div aria-hidden className="tcg-light-sweep pointer-events-none absolute inset-0" />
    <div aria-hidden className="premium-energy-particles pointer-events-none absolute inset-0">
      {Array.from({ length: 10 }, (_, i) => <span key={i} className="premium-energy-spark absolute" style={{ left: `${8 + (i * 29 % 85)}%`, top: `${35 + (i * 17 % 60)}%`, animationDelay: `${-i * 0.41}s` }} />)}
    </div>
  </>;
}

/** Trading card with a flip animation and a rarity-coloured frame. */
export function AnimeCard({ card, flipped = true, className, count, locked, transcended, compact, comparisonForm, transformationKey = 0, preload = false }: Props) {
  const rarity = displayRarity(card, transcended);
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
      className={cn("flip-scene relative aspect-[2/3] w-full", interactive && "holo-interactive", className)}>
      <div ref={tiltRef} className={cn("relative size-full", interactive && "holo-tilt")}>
      {!locked && flipped && rarity === "mythique" && <div aria-hidden className="flame-aura" />}
      {!locked && flipped && rarity === "transcendance" && <div aria-hidden className="premium-awakened-aura pointer-events-none absolute inset-0 rounded-2xl" />}
      <div className={cn("flip-inner size-full", flipped && "flipped")}>
        <div className="flip-face card-back grid place-items-center rounded-2xl border border-border">
          <span className={cn("font-display font-bold tracking-[0.3em] text-foreground/70", compact ? "text-[10px]" : "text-xl")}>ZENKAI</span>
        </div>

        <div data-compact={compact ? "true" : "false"} className={cn("flip-face flip-front overflow-hidden rounded-2xl bg-surface", locked ? "border border-border" : rarity === "transcendance" ? "reverse-card" : r.glow)}>
          {comparisonForm ? (
            <div className="form-portrait-stack absolute inset-0 overflow-hidden" data-form={comparisonForm}>
              <img src={cardArt(card, false)} alt={comparisonForm === "base" ? cardIdentity(card, false).name : ""} aria-hidden={comparisonForm !== "base"} loading="eager" className="form-portrait form-portrait-base absolute inset-0 size-full object-cover" />
              <img src={cardArt(card, true)} alt={comparisonForm === "awakened" ? cardIdentity(card, true).name : ""} aria-hidden={comparisonForm !== "awakened"} loading="eager" className="form-portrait form-portrait-awakened absolute inset-0 size-full object-cover" />
            </div>
          ) : art ? (
            <img src={art} alt={identity.name} loading={preload ? "eager" : "lazy"} className={cn("object-cover", rarity === "transcendance" && !locked ? "reverse-art" : "size-full", locked && "silhouette")} />
          ) : null}
          {(rarity === "legendaire" || rarity === "mythique") && !locked && (
            <div className="holo-sheen pointer-events-none absolute inset-0 animate-sheen" />
          )}
          {rarity === "transcendance" && !locked && <TranscendFrame />}
          <div className={cn("absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-1", compact ? "p-1" : "p-2.5")}>
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
          <div className={cn("premium-glass-label absolute inset-x-0 bottom-0 z-10", compact ? "p-1.5 pt-4" : "p-3 pt-6")}>
            <p className={cn("font-bold leading-tight", rarity === "transcendance" && !locked ? "tcg-nameplate font-display" : "font-display", compact ? "truncate text-[9px]" : "text-xs sm:text-sm")}>
              {locked ? "???" : identity.name}
            </p>
            {!compact && (
              <p className={cn("font-medium", rarity === "transcendance" ? "text-[9px] leading-tight" : "text-[11px]", locked ? "text-muted-foreground" : r.text)}>
                {locked ? card.series ?? "Non obtenue" : identity.title}
              </p>
            )}
            {rarity === "transcendance" && !locked && <p className={cn("tcg-collector-number mt-1.5 text-right font-semibold tabular-nums", compact ? "text-[6px]" : "text-[8px]")}>{card.id === "al-246" ? "ZEN-001" : `ZEN-${String(card.sort_order + 1).padStart(3, "0")}`} • TR</p>}
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
