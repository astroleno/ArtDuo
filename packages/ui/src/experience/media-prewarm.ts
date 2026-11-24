export interface ConnectionHint { saveData?: boolean; effectiveType?: string }

interface WarmMedia {
  previewUrl: string;
  backgroundUrl?: string;
  depthMapUrl?: string;
}

/** Essential images are loaded by the view. Speculative work stays behind them. */
export function adjacentWarmUrls(next: WarmMedia | undefined, previous: WarmMedia | undefined, { currentBackground, connection, reducedMotion, mouseMotion }: {
  currentBackground?: string;
  connection?: ConnectionHint;
  reducedMotion: boolean;
  mouseMotion: boolean;
}): string[] {
  if (connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType ?? "")) return [];
  if (connection?.effectiveType === "3g") return next?.previewUrl ? [next.previewUrl] : [];
  const urls = [next?.previewUrl, next?.backgroundUrl, previous?.previewUrl, previous?.backgroundUrl];
  if (!reducedMotion && mouseMotion) urls.push(next?.depthMapUrl, previous?.depthMapUrl);
  return [...new Set(urls.filter((url): url is string => Boolean(url && url !== currentBackground)))];
}

export function createPrewarmQueue<T = void>(load: (url: string) => Promise<T>, concurrency = 2, capacity = 8, dispose?: (resource: T) => void) {
  type Entry = { promise: Promise<boolean>; ready: boolean; resource?: T; waitingSignals?: Set<AbortSignal | undefined> };
  const known = new Map<string, Entry>();
  let retained = new Set<string>();
  const waiting: Array<() => void> = [];
  let active = 0;
  const pump = () => { while (active < concurrency && waiting.length) waiting.shift()!(); };
  const trim = () => {
    for (const [key, cached] of known) {
      if (known.size <= capacity) break;
      if (cached.ready && !retained.has(key)) {
        known.delete(key);
        dispose?.(cached.resource as T);
      }
    }
  };
  return {
    ready: (url: string) => known.get(url)?.ready === true,
    get(url: string): T | undefined {
      const item = known.get(url);
      if (!item?.ready) return;
      known.delete(url); known.set(url, item);
      return item.resource;
    },
    retain(urls: string[]) { retained = new Set(urls); trim(); },
    warm(url: string, signal?: AbortSignal, sourceUrl = url): Promise<boolean> {
      if (!url || signal?.aborted) return Promise.resolve(false);
      const existing = known.get(url);
      if (existing) {
        existing.waitingSignals?.add(signal);
        known.delete(url);
        known.set(url, existing);
        return existing.promise;
      }
      let finish!: (ready: boolean) => void;
      const waitingSignals = new Set([signal]);
      const item: Entry = { promise: new Promise<boolean>(resolve => { finish = resolve; }), ready: false, waitingSignals };
      known.set(url, item);
      waiting.push(() => {
        item.waitingSignals = undefined;
        if ([...waitingSignals].every(request => request?.aborted)) { known.delete(url); finish(false); return; }
        active++;
        void load(sourceUrl).then(resource => { item.resource = resource; item.ready = true; finish(true); }, () => { known.delete(url); finish(false); }).finally(() => {
          active--;
          trim();
          pump();
        });
      });
      pump();
      return item.promise;
    },
  };
}

interface PrewarmedImage { url: string; image: HTMLImageElement }

export const experiencePrewarm = createPrewarmQueue<PrewarmedImage>(async (url) => {
  const response = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(15_000), priority: "low" } as RequestInit);
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("Prewarm image unavailable");
  const blob = await response.blob();
  if (blob.size > 8 * 1024 * 1024) throw new Error("Prewarm image exceeds its memory limit");
  const source = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([image.decode(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Prewarm decode deadline exceeded")), 5_000);
    })]);
    if (!image.naturalWidth) throw new Error("Prewarm image is empty");
    return { url: source, image };
  } catch (error) { URL.revokeObjectURL(source); image.removeAttribute("src"); throw error; }
  finally { clearTimeout(timer); }
}, 2, 12, resource => { resource.image.removeAttribute("src"); URL.revokeObjectURL(resource.url); });

export function experienceImageSource(url: string): string { return experiencePrewarm.get(url)?.url ?? url; }
