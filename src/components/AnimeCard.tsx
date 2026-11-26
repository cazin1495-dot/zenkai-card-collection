import { CUSTOM_TRANSCENDANCE_CARDS } from "@/lib/transcendance-cards";
import { useRef, useState, type PointerEvent } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardArt, cardIdentity, CARD_BACK_BY_PACK, isTranscendanceCatalogCard, RARITY, type Card, type Rarity } from "@/lib/cards";

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
  staticEffects?: boolean | undefined;
  comparisonForm?: "base" | "awakened" | undefined;
  transformationKey?: number | undefined;
};

export type CardBackTheme = { image: string };

export function displayRarity(card: Card, transcended?: boolean, customTranscendance?: boolean): Rarity {
  return transcended || customTranscendance || isTranscendanceCatalogCard(card) ? "transcendance" : card.rarity;
}

function CardIllustration({
  src,
  alt,
  className,
  fallbackClassName,
  imagePosition,
  imageScale,
  loading = "lazy",
  ariaHidden = false,
}: {
  src: string;
  alt: string;
  className: string;
  fallbackClassName?: string | undefined;
  imagePosition?: string | undefined;
  imageScale?: number | undefined;
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
      
      <img
        src={src}
        alt={alt}
        aria-hidden={ariaHidden}
        loading={loading}
        decoding={loading === "lazy" ? "async" : undefined}
        onLoad={() => setLoadedSource(src)}
        onError={() => setFailedSource(src)}
        className={cn(className, "object-cover")}
        style={{ objectPosition: imagePosition ?? "center top", transform: imageScale ? `scale(${imageScale})` : undefined }}
      />
    </>
  );
}

const TRANSCENDANCE_SPARKLES = [
  [9, 8, 16], [25, 12, 5], [42, 7, 10], [60, 13, 6], [76, 8, 14], [92, 12, 8],
  [15, 23, 5], [30, 26, 12], [48, 21, 4], [65, 27, 18], [81, 23, 6], [94, 29, 10],
  [8, 39, 10], [24, 35, 6], [40, 43, 14], [57, 36, 5], [73, 42, 8], [90, 37, 20],
  [13, 54, 6], [28, 59, 16], [45, 54, 5], [62, 61, 10], [78, 56, 4], [94, 63, 12],
  [8, 72, 14], [23, 77, 5], [39, 71, 8], [55, 79, 6], [71, 73, 18], [89, 78, 4],
  [15, 91, 6], [31, 86, 10], [47, 94, 16], [63, 88, 5], [80, 93, 12], [94, 88, 6],
] as const;
const SPARKLE_COLORS = ["#fde047", "#ff4ecd", "#00f5d4", "#c084fc", "#4ade80", "#ffffff"];

export function TranscendanceSparklesOverlay() {
  return (
    <div
      aria-hidden
      className="transcendance-sparkles-overlay"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 22,
        pointerEvents: "none",
        overflow: "hidden",
        borderRadius: "inherit",
      }}
    >
      <style>{`
        @keyframes transcendance-sparkles-twinkle {
          0%, 100% { opacity: 0.6; transform: scale(0.6); }
          50% { opacity: 1; transform: scale(1.35); }
        }
        @media (prefers-reduced-motion: reduce) {
          .transcendance-sparkle-light { animation: none !important; }
        }
      `}</style>
      {TRANSCENDANCE_SPARKLES.map(([x, y, size], i) => (
        <span key={`${x}-${y}`} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}>
          <svg
            className="transcendance-sparkle-light"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{
              display: "block",
              width: size,
              height: size,
              color: SPARKLE_COLORS[(i * 5 + Math.floor(i / 6)) % SPARKLE_COLORS.length],
              opacity: 1,
              filter: "drop-shadow(0 0 6px currentColor)",
              transformBox: "fill-box",
              transformOrigin: "center",
              animationName: "transcendance-sparkles-twinkle",
              animationDuration: `${2.8 + (i % 4) * 0.4}s`,
              animationTimingFunction: "ease-in-out",
              animationDelay: `${(i % 11) * 0.25}s`,
              animationIterationCount: "infinite",
            }}
          >
            {size <= 6 ? <circle cx="12" cy="12" r="7" /> : <path d="M12 0 Q14 10 24 12 Q14 14 12 24 Q10 14 0 12 Q10 10 12 0 Z" />}
          </svg>
        </span>
      ))}
    </div>
  );
}

/** Rainbow frame shared by all Transcendance cards. */
export function TranscendFrame() {
  return <>
    <div aria-hidden className="premium-energy-frame pointer-events-none absolute inset-0 z-30" />
    <div aria-hidden className="tcg-inner-frame pointer-events-none absolute z-30" />
  </>;
}

/** Trading card with a flip animation and a rarity-coloured frame. */
export function AnimeCard({ card, backTheme, flipped = true, className, count, locked, transcended, customTranscendance, compact, staticEffects, comparisonForm, transformationKey = 0 }: Props) {
  const rarity = displayRarity(card, transcended, customTranscendance);
  const r = RARITY[rarity];
  const rawArt = cardArt(card, transcended); const cid = card.id.replace(/^custom-/, ""); const cname = (card.name || "").trim().toLowerCase(); const fbTr = !rawArt && rarity === "transcendance" ? CUSTOM_TRANSCENDANCE_CARDS.find((d) => d.id === cid || d.name.trim().toLowerCase() === cname || (cname.length >= 4 && d.name.trim().toLowerCase().includes(cname.split(" ")[0]))) : undefined; const art = cname.includes("black") && rarity === "transcendance" ? "/blackj%20goku%20rose.jpg" : (rawArt || fbTr?.image_url || "");
  const identity = cardIdentity(card, transcended);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const interactive = rarity === "transcendance" && flipped && !locked && !staticEffects;
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
      {!staticEffects && !locked && flipped && rarity === "mythique" && <div aria-hidden className="flame-aura" />}
      {!staticEffects && !locked && flipped && rarity === "transcendance" && <div aria-hidden className="premium-awakened-aura pointer-events-none absolute inset-0 z-0 rounded-2xl" />}
      <div className={cn("flip-inner size-full bg-transparent", flipped && "flipped")}>
        <div
          className={cn(
            "flip-face grid place-items-center overflow-hidden rounded-xl bg-transparent",
            !backTheme && "card-back border border-border",
          )}
        >
          {backTheme ? (
            <div className="absolute inset-0 size-full overflow-hidden rounded-xl bg-transparent">
              <img
                src={backTheme.image}
                alt=""
                aria-hidden
                loading="eager"
                className={cn(
                  "h-full w-full object-cover object-center",
                  backTheme.image === CARD_BACK_BY_PACK.protagoniste
                    ? "rounded-[inherit]"
                    : backTheme.image === CARD_BACK_BY_PACK.shojo || backTheme.image === CARD_BACK_BY_PACK.antagoniste
                    ? "scale-[1.22] rounded-[inherit]"
                    : cn("scale-[1.12]", backTheme.image === CARD_BACK_BY_PACK.sport ? "rounded-[inherit]" : "rounded-xl"),
                )}
              />
            </div>
          ) : (
            <span className={cn("font-display font-bold tracking-[0.3em] text-foreground/70", compact ? "text-[10px]" : "text-xl")}>ZENKAI</span>
          )}
        </div>

        <div
          data-compact={compact ? "true" : "false"}
          data-transcendence-id={rarity === "transcendance" ? card.id : undefined}
          className={cn("flip-face flip-front overflow-hidden rounded-2xl bg-transparent", locked ? "border border-border" : rarity === "transcendance" ? "reverse-card zenkai-transcendance-card" : r.glow)}
          style={{ backgroundColor: card.image_scale ? "#0a0a0a" : undefined }}
        >
          {comparisonForm ? (
            <div className={cn("form-portrait-stack absolute inset-0 overflow-hidden", rarity === "transcendance" && !locked && "z-20")} data-form={comparisonForm}>
              <CardIllustration
                src={cardArt(card, false)}
                imagePosition={card.image_position}
                imageScale={card.image_scale}
                alt={comparisonForm === "base" ? cardIdentity(card, false).name : ""}
                ariaHidden={comparisonForm !== "base"}
                loading="eager"
                className="form-portrait form-portrait-base absolute inset-0 size-full"
              />
              <CardIllustration
                src={cardArt(card, true)}
                imagePosition={card.image_position}
                imageScale={card.image_scale}
                alt={comparisonForm === "awakened" ? cardIdentity(card, true).name : ""}
                ariaHidden={comparisonForm !== "awakened"}
                loading="eager"
                className="form-portrait form-portrait-awakened absolute inset-0 size-full"
              />
            </div>
          ) : art ? (
            <CardIllustration
              src={art}
              imagePosition={card.image_position}
              imageScale={card.image_scale}
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
          {!staticEffects && rarity === "transcendance" && !locked && <TranscendanceSparklesOverlay />}
          {!staticEffects && (rarity === "legendaire" || rarity === "mythique") && !locked && (
            <div className="holo-sheen pointer-events-none absolute inset-0 animate-sheen" />
          )}
          {rarity === "transcendance" && !locked && <TranscendFrame />}
          <div className={cn(
            "absolute inset-x-0 top-0 flex items-start justify-between gap-1",
            rarity === "transcendance" && !locked ? "z-30" : "z-10",
            compact ? rarity === "transcendance" && !locked ? "p-[7px]" : "p-1" : "p-2.5",
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
            ) : null}
          </div>
          <div className={cn(
            "premium-glass-label absolute inset-x-0 bottom-0",
            rarity === "transcendance" && !locked ? "z-30" : "z-10",
            rarity === "transcendance" && !locked
              ? compact ? "p-1" : "px-2 py-1.5"
              : compact ? "p-1.5 pt-4" : "p-3 pt-6",
          )}>
            <p className={cn(
              "font-bold leading-tight",
              rarity === "transcendance" && !locked
                ? "tcg-nameplate font-display"
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
              <div className="relic-signature mt-1 flex items-center justify-between gap-1">
                <span className={cn("relic-seal", compact ? "text-[5px]" : "text-[7px]")}>✦ TRANSCENDANCE ✦</span>
                <span className={cn("tcg-collector-number font-semibold tabular-nums", compact ? "text-[6px]" : "text-[8px]")}>
                  {card.transcendance_series_number ?? (card.id === "al-246" ? "ZEN-001-TR" : `ZEN-${String(card.sort_order + 1).padStart(3, "0")}-TR`)}
                </span>
              </div>
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
