"use client";

import { useEffect, useRef, useState } from "react";
import { ROOM_IMAGE_SIZES, roomImageSrcSet } from "./room-assets";
import { experienceImageSource } from "./media-prewarm";

/** Keep the previous wall visible until its replacement has decoded. */
export function RoomBackdrop({ url, smallUrl, onReady, onError, reducedMotion, referrerPolicy }: { url: string; smallUrl?: string; onReady: (size: { width: number; height: number; currentSrc: string }) => void; onError: () => void; reducedMotion: boolean; referrerPolicy?: React.HTMLAttributeReferrerPolicy }) {
  const [loaded, setLoaded] = useState<string>();
  const [previous, setPrevious] = useState<string>();
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const loadedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    if (referrerPolicy) image.referrerPolicy = referrerPolicy;
    image.decoding = "async";
    image.fetchPriority = "high";
    const source = experienceImageSource(url);
    if (source === url) {
      image.sizes = ROOM_IMAGE_SIZES;
      image.srcset = roomImageSrcSet(url, smallUrl) ?? "";
    }
    image.src = source;
    void image.decode().then(() => {
      if (cancelled) return;
      const currentSrc = image.currentSrc || url;
      callbacks.current.onReady({ width: image.naturalWidth, height: image.naturalHeight, currentSrc });
      setPrevious(loadedRef.current);
      loadedRef.current = currentSrc;
      setLoaded(currentSrc);
    }).catch(() => { if (!cancelled) callbacks.current.onError(); });
    return () => { cancelled = true; };
  }, [url, smallUrl, referrerPolicy]);
  return <>
    {previous && !reducedMotion ? <img alt="" crossOrigin="anonymous" referrerPolicy={referrerPolicy} className="experience-room-backdrop" src={previous} /> : null}
    {loaded ? <img key={loaded} alt="" crossOrigin="anonymous" referrerPolicy={referrerPolicy} className={`experience-room-backdrop ${reducedMotion ? "" : "is-revealed-wall"}`} src={loaded} onAnimationEnd={() => setPrevious(undefined)} /> : null}
  </>;
}
