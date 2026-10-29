type ImagePort = Pick<HTMLImageElement, "complete" | "naturalWidth" | "naturalHeight" | "addEventListener" | "removeEventListener">;
export type ClosingImageState = { state: "ready"; ratio: number } | { state: "failed" };

/** A cached image may finish before hydration attaches its load listener. */
export function observeClosingImage(image: ImagePort, onChange: (value: ClosingImageState) => void): () => void {
  const failed = () => onChange({ state: "failed" });
  const loaded = () => {
    if (image.naturalWidth > 0 && image.naturalHeight > 0) onChange({ state: "ready", ratio: image.naturalWidth / image.naturalHeight });
    else failed();
  };
  image.addEventListener("load", loaded);
  image.addEventListener("error", failed);
  if (image.complete) loaded();
  return () => {
    image.removeEventListener("load", loaded);
    image.removeEventListener("error", failed);
  };
}
