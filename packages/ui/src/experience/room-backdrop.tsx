"use client";

import { useEffect, useRef, useState } from "react";
import { ROOM_IMAGE_SIZES, roomImageSrcSet } from "./room-assets";
import { experienceImageSource } from "./media-prewarm";

/** Keep the previous wall visible until its replacement has decoded. */
export function RoomBackdrop({ url, smallUrl, onReady, onError, reducedMotion, referrerPolicy }: { url: string; smallUrl?: string; onReady: (size: { width: number; height: number; currentSrc: string }, sourceUrl: string) => void; onError: (sourceUrl: string) => void; reducedMotion: boolean; referrerPolicy?: React.HTMLAttributeReferrerPolicy }) {
  const [loaded, setLoaded] = useState<string>();
  const [previous, setPrevious] = useState<string>();
  const [revealing, setRevealing] = useState(false);
  const motionReduced = useRef(reducedMotion);
  motionReduced.current = reducedMotion;
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const requestedUrl = useRef(url);
  requestedUrl.current = url;
  const loadedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (reducedMotion) {
      setRevealing(false);
      setPrevious(undefined);
    }
  }, [reducedMotion]);
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
      if (cancelled || url !== requestedUrl.current) return;
      const currentSrc = image.currentSrc || url;
      callbacks.current.onReady({ width: image.naturalWidth, height: image.naturalHeight, currentSrc }, url);
      const reveal = !motionReduced.current && loadedRef.current !== currentSrc;
      setPrevious(reveal ? loadedRef.current : undefined);
      setRevealing(reveal);
      loadedRef.current = currentSrc;
      setLoaded(currentSrc);
    }).catch(() => { if (!cancelled && url === requestedUrl.current) callbacks.current.onError(url); });
    return () => { cancelled = true; };
  }, [url, smallUrl, referrerPolicy]);
  return <>
    {previous && !reducedMotion ? <img alt="" crossOrigin="anonymous" referrerPolicy={referrerPolicy} className="experience-room-backdrop" src={previous} /> : null}
    {loaded ? <img key={loaded} alt="" crossOrigin="anonymous" referrerPolicy={referrerPolicy} className={`experience-room-backdrop ${revealing && !reducedMotion ? "is-revealed-wall" : ""}`} src={loaded} onAnimationEnd={() => { setRevealing(false); setPrevious(undefined); }} /> : null}
  </>;
}
