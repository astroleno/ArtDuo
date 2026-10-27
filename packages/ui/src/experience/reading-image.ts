type ReadingImage = Pick<HTMLImageElement, "decode" | "naturalWidth">;

/** Keep the gallery visible while decoding, but never block text indefinitely. */
export function prepareReadingImage(image: ReadingImage, signal: AbortSignal, timeoutMs = 5000): Promise<"ready" | "failed" | undefined> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(undefined); return; }
    let settled = false;
    const finish = (state: "ready" | "failed" | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      resolve(state);
    };
    const cancel = () => finish(undefined);
    const timer = setTimeout(() => finish("failed"), timeoutMs);
    signal.addEventListener("abort", cancel, { once: true });
    void Promise.resolve().then(() => signal.aborted ? undefined : image.decode())
      .then(() => finish(image.naturalWidth > 0 ? "ready" : "failed"), () => finish("failed"));
  });
}
