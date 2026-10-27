import type { SculptureRoomScene } from "./sculpture-types";

export type LinearRgb = [number, number, number];
export interface PhotoPixels { width: number; height: number; data: ArrayLike<number> }
export interface SculpturePhotoLighting {
  left: LinearRgb;
  right: LinearRgb;
  ceiling: LinearRgb;
  floor: LinearRgb;
  wall: LinearRgb;
  key: LinearRgb;
  keyIntensity: number;
  environmentIntensity: number;
  shadowOpacity: number;
  imageAspect: number;
  sourceUv: [number, number];
  sourceConfidence: number;
  keyDirection: [number, number, number];
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const linear = (value: number) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
export const photoLuminance = (rgb: LinearRgb) => rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;

/** Low-frequency lighting estimate from an ordinary photograph, not HDR recovery. */
export function analyzeSculpturePhoto(pixels: PhotoPixels, room: Pick<SculptureRoomScene, "id" | "light">): SculpturePhotoLighting {
  const { width, height, data } = pixels;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) throw new Error("Invalid room photograph pixels");
  const region = (x: number, y: number, w: number, h: number, highlights = false): LinearRgb => {
    const sum: LinearRgb = [0, 0, 0]; let weight = 0;
    for (let row = Math.floor(y * height); row < Math.min(height, Math.ceil((y + h) * height)); row++) {
      for (let column = Math.floor(x * width); column < Math.min(width, Math.ceil((x + w) * width)); column++) {
        const index = (row * width + column) * 4;
        const rgb = [0, 1, 2].map(channel => linear(clamp(Number(data[index + channel]) || 0, 0, 255) / 255)) as LinearRgb;
        const alpha = clamp(Number(data[index + 3]) || 0, 0, 255) / 255;
        const sampleWeight = alpha * (highlights ? (.1 + photoLuminance(rgb)) ** 2 : 1);
        for (let channel = 0; channel < 3; channel++) sum[channel] += rgb[channel] * sampleWeight;
        weight += sampleWeight;
      }
    }
    return weight > 0 ? sum.map(value => value / weight) as LinearRgb : [.35, .35, .35];
  };
  const left = region(0, .12, .18, .62);
  const right = region(.82, .12, .18, .62);
  const ceiling = region(.18, .01, .64, .12, true);
  const floor = region(.12, .87, .76, .12);
  const wall = region(.22, .2, .56, .48);
  // A source prior distinguishes an emitting window / ceiling from a pale wall.
  // Brightness alone cannot distinguish white paint from illumination.
  const bounds = room.light === "right" ? [.84, .08, .16, .64] : room.light === "left" ? [0, .08, .16, .64] : [.12, .015, .76, .18];
  const [rx, ry, rw, rh] = bounds;
  const source = region(rx, ry, rw, rh, true);
  let sourceX = 0, sourceY = 0, sourceWeight = 0, minimum = 1, maximumLuma = 0;
  for (let y = Math.floor(ry * height); y < Math.min(height, Math.ceil((ry + rh) * height)); y++) {
    for (let x = Math.floor(rx * width); x < Math.min(width, Math.ceil((rx + rw) * width)); x++) {
      const index = (y * width + x) * 4;
      const rgb = [0, 1, 2].map(channel => linear(clamp(Number(data[index + channel]) || 0, 0, 255) / 255)) as LinearRgb;
      const luma = photoLuminance(rgb), alpha = clamp(Number(data[index + 3]) || 0, 0, 255) / 255;
      if (!alpha) continue;
      minimum = Math.min(minimum, luma); maximumLuma = Math.max(maximumLuma, luma);
      const weight = alpha * Math.max(0, luma - photoLuminance(wall) * .65) ** 3;
      sourceX += (x + .5) / width * weight; sourceY += (y + .5) / height * weight; sourceWeight += weight;
    }
  }
  const sourceUv: [number, number] = sourceWeight > 1e-6 ? [sourceX / sourceWeight, sourceY / sourceWeight] : [rx + rw / 2, ry + rh / 2];
  const sourceConfidence = clamp((maximumLuma - minimum) * 2, 0, 1);
  const direction: [number, number, number] = [
    (sourceUv[0] - .5) * width / height * 2,
    room.light === "top" ? 1.5 : clamp((.64 - sourceUv[1]) * 2, .15, 1.2),
    room.light === "top" ? .18 : .35,
  ];
  const length = Math.hypot(...direction);
  const maximum = Math.max(...source, .03);
  const contrast = clamp(photoLuminance(source) / Math.max(.08, photoLuminance(wall)), .5, 2.2);
  return {
    left, right, ceiling, floor, wall,
    key: source.map(value => clamp(value / maximum, .45, 1)) as LinearRgb,
    keyIntensity: clamp(1.8 + contrast * .55, 2, 2.7),
    environmentIntensity: clamp(.32 + photoLuminance(wall) * .18, .32, .5),
    shadowOpacity: clamp(.2 + (contrast - 1) * .08, .16, .3),
    imageAspect: width / height, sourceUv, sourceConfidence,
    keyDirection: direction.map(value => value / length) as [number, number, number],
  };
}

async function sampleImage(imageUrl: string, signal: AbortSignal, maximumWidth?: number): Promise<PhotoPixels> {
  const image = new Image();
  image.crossOrigin = "anonymous"; image.referrerPolicy = "no-referrer"; image.decoding = "async";
  const abort = () => { image.src = ""; };
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  signal.addEventListener("abort", abort, { once: true });
  try {
    image.src = imageUrl;
    await image.decode();
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const canvas = document.createElement("canvas");
    canvas.width = maximumWidth ?? image.naturalWidth;
    canvas.height = Math.max(1, Math.round(canvas.width * image.naturalHeight / image.naturalWidth));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Room photograph sampling unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally { signal.removeEventListener("abort", abort); }
}

export async function loadSculpturePhotoLighting(imageUrl: string, room: SculptureRoomScene, signal: AbortSignal): Promise<SculpturePhotoLighting> {
  const pixels = await sampleImage(imageUrl, signal, 160);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  return analyzeSculpturePhoto(pixels, room);
}
