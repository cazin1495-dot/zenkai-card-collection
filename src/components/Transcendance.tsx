import { useEffect, useRef, useState } from "react";
import { SkipForward, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/AnimeCard";
import { playAwakeningAudio } from "@/lib/awakening";
import type { Card } from "@/lib/cards";

/** A local cinema; never changes ownership or rarity. */
export function CardCinema({ card, onDone }: { card: Card; onDone: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [failed, setFailed] = useState(false);
  const finished = useRef(false);
  function finish() { if (finished.current) return; finished.current = true; audio.current?.pause(); onDone(); }
  useEffect(() => {
    const timer = window.setTimeout(finish, 3500);
    const media = audio.current;
    if (media) void playAwakeningAudio(media).catch(() => setFailed(true));
    return () => { window.clearTimeout(timer); media?.pause(); };
  }, []);
  return <div aria-label="Cinématique Transcendance" className="card-cinema relative aspect-[2/3] w-full overflow-hidden rounded-md">
    {card.voiceAudioUrl && <audio ref={audio} src={card.voiceAudioUrl} preload="auto" onEnded={finish} onError={() => setFailed(true)} />}
    <div aria-hidden className="card-cinema-halo absolute inset-0" />
    <div aria-hidden className="card-cinema-band absolute inset-x-0 top-0 h-[13%] bg-letterbox" />
    <div aria-hidden className="card-cinema-band absolute inset-x-0 bottom-0 h-[13%] bg-letterbox" />
    <p className="card-cinema-subtitle absolute inset-x-0 bottom-[17%] px-4 text-center text-xs font-semibold leading-relaxed sm:text-sm">{card.subtitleText}</p>
    {failed && <Button aria-label="Relancer la voix" title="Relancer la voix" size="icon" variant="ghost" className="absolute left-2 top-2" onClick={() => { if (audio.current) void playAwakeningAudio(audio.current).catch(() => setFailed(true)); }}><Play /></Button>}
    <Button variant="ghost" size="sm" onClick={finish} className="absolute bottom-1 right-1 text-[10px] text-foreground/70">Passer <SkipForward className="size-3" /></Button>
  </div>;
}
export function InspectableCard({ card, transcended = false, count, locked = false }: { card: Card; transcended?: boolean; count?: number | undefined; locked?: boolean }) {
  const [cinema, setCinema] = useState(false);
  const [flash, setFlash] = useState(false);
  const ultimate = card.rarity === "transcendance" || transcended;
  function finish() { setCinema(false); setFlash(true); }
  return <div className="relative w-full">
    {cinema ? <CardCinema card={card} onDone={finish} /> : ultimate && !locked ? <Button variant="ghost" aria-label={`Inspecter ${card.name}`} onClick={() => { setFlash(false); setCinema(true); }} className="block h-auto w-full rounded-none p-0 hover:bg-transparent"><AnimeCard card={card} transcended={transcended} count={count} /></Button> : <AnimeCard card={card} transcended={transcended} count={count} locked={locked} />}
    {flash && <div aria-hidden className="card-cinema-flash pointer-events-none absolute inset-0 rounded-md" />}
  </div>;
}
