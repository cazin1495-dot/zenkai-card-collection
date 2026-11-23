import { useState } from "react";
import { PACK_ARTWORK, PACK_ARTWORK_BY_PACK } from "@/lib/cards";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function BoosterArtwork({ src, alt, className }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isProtagoniste = src === PACK_ARTWORK_BY_PACK.protagoniste;
  const imageSrc = !isProtagoniste && (failedSrc === src || !src) ? PACK_ARTWORK : src;

  return (
    <img loading="lazy" decoding="async"
      src={imageSrc}
      alt={alt}
      draggable={false}
      onError={() => {
        if (isProtagoniste) {
          console.error("Impossible de charger la pochette Protagoniste :", src);
          return;
        }
        if (imageSrc !== PACK_ARTWORK) setFailedSrc(src);
      }}
      className={cn("h-full w-full object-cover object-center", className)}
    />
  );
}
