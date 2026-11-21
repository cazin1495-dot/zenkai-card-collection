import { useState } from "react";
import { PACK_ARTWORK } from "@/lib/cards";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function BoosterArtwork({ src, alt, className }: Props) {
  const [useFallback, setUseFallback] = useState(false);
  const imageSrc = useFallback || !src ? PACK_ARTWORK : src;

  return (
    <img
      src={imageSrc}
      alt={alt}
      draggable={false}
      onError={() => {
        if (imageSrc !== PACK_ARTWORK) setUseFallback(true);
      }}
      className={className}
    />
  );
}
