import { useEffect, useRef, useState } from "react";
import { AnimeCard } from "./AnimeCard";
import type { Card } from "@/lib/cards";

type Form = "base" | "awakened";

/** Two preloaded, backface-hidden faces switch visibility geometrically at 90°. */
export function FormFlipCard({ card, form, onBusyChange }: { card: Card; form: Form; onBusyChange: (busy: boolean) => void }) {
  const previous = useRef(form);
  const [direction, setDirection] = useState<"forward" | "reverse" | null>(null);
  const [sequence, setSequence] = useState(0);

  useEffect(() => {
    if (previous.current === form) return;
    previous.current = form;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setDirection(form === "awakened" ? "forward" : "reverse");
    setSequence((n) => n + 1);
    onBusyChange(true);
  }, [form, onBusyChange]);

  function finish() {
    setDirection(null);
    onBusyChange(false);
  }

  return <div className="form-flip-scene relative aspect-[2/3] w-full" data-form={form} data-direction={direction ?? "idle"}>
    <div key={sequence} className="form-flip-rotor relative size-full" onAnimationEnd={(event) => { if (event.target === event.currentTarget) finish(); }}>
      <div className="form-flip-face form-flip-base absolute inset-0" aria-hidden={form !== "base"}>
        <AnimeCard card={card} />
      </div>
      <div className="form-flip-face form-flip-awakened absolute inset-0" aria-hidden={form !== "awakened"}>
        <AnimeCard card={card} transcended />
      </div>
    </div>
    {direction && <div key={`energy-${sequence}`} aria-hidden className="form-flip-energy pointer-events-none absolute inset-0">
      <div className="form-flip-charge absolute inset-0 rounded-2xl" />
      {direction === "forward" && <>
        <div className="form-flip-impact absolute inset-0 rounded-2xl" />
        <div className="form-flip-impact-ring absolute" />
      </>}
    </div>}
  </div>;
}