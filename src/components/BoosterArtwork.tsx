import { useState } from "react";
import { PACK_ARTWORK } from "@/lib/cards";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function BoosterArtwork({ src, alt, className }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = failedSrc === src || !src ? PACK_ARTWORK : src;

  return (
    <img
      src={imageSrc}
      alt={alt}
      draggable={false}
      onError={() => {
        if (imageSrc !== PACK_ARTWORK) setFailedSrc(src);
      }}
      className={className}
    />
  );
}
