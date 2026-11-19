import { useEffect, useRef, useState } from "react";
import { AnimeCard } from "./AnimeCard";
import type { Card } from "@/lib/cards";

type Form = "base" | "awakened";

/** Decoded permanent faces switch on the edge during a full 3D turn. */
export function FormFlipCard({ card, form, onBusyChange }: { card: Card; form: Form; onBusyChange: (busy: boolean) => void }) {
  const previous = useRef(form);
  const [direction, setDirection] = useState<"forward" | "reverse" | null>(null);
  const [ready, setReady] = useState(false);
  const stack = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const images = Array.from(stack.current?.querySelectorAll("img") ?? []);
    Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => {
      if (!cancelled) setReady(images.every((image) => image.complete && image.naturalWidth > 0));
    });
    return () => { cancelled = true; };
  }, [card]);

  useEffect(() => {
    if (previous.current === form) return;
    if (!ready) return;
    previous.current = form;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setDirection(form === "awakened" ? "forward" : "reverse");
    onBusyChange(true);
  }, [form, ready, onBusyChange]);

  function finish() {
    setDirection(null);
    onBusyChange(false);
  }

  return <div ref={stack} className="form-morph-scene relative aspect-[2/3] w-full" data-form={form} data-ready={ready} data-direction={direction ?? "idle"}>
    <div className="form-morph-body relative size-full" onAnimationEnd={(event) => { if (event.target === event.currentTarget) finish(); }}>
      <div className="form-morph-base absolute inset-0" aria-hidden={form !== "base"}>
        <AnimeCard card={card} preload />
      </div>
      <div className="form-morph-awakened absolute inset-0" aria-hidden={form !== "awakened"}>
        <AnimeCard card={card} transcended preload />
      </div>
      <div aria-hidden className="form-turn-back card-back absolute inset-0 grid place-items-center rounded-2xl border border-border"><span className="font-display text-xl font-bold tracking-widest text-foreground/70">ZENKAI</span></div>
    </div>
    <div aria-hidden className="form-morph-ki pointer-events-none absolute inset-0 rounded-2xl" />
    <div aria-hidden className="form-turn-impact pointer-events-none absolute inset-0 rounded-2xl" />
    <div aria-hidden className="form-turn-ring pointer-events-none absolute" />
  </div>;
}