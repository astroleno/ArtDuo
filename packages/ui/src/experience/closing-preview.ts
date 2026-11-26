const STORAGE_KEY = "artduo.closing-preview.v1";
const MAX_DATA_LENGTH = 300_000;

export interface ClosingPreview {
  exhibitionId: string;
  artworkId: string;
  previewUrl: string;
  data: string;
}

export function captureClosingPreview(image: HTMLImageElement): string | undefined {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return undefined;
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.82, .68, .52]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.startsWith("data:image/jpeg;base64,") && data.length <= MAX_DATA_LENGTH) return data;
    }
  } catch { /* Unreadable preview pixels cannot be used for a lookback. */ }
}

export function saveClosingPreview(preview: ClosingPreview | undefined) {
  try {
    if (preview) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preview));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* The current visit still has the decoded pixels in memory. */ }
}

export async function readClosingPreview(exhibitionId: string): Promise<ClosingPreview | undefined> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > MAX_DATA_LENGTH + 4000) return;
    const preview = JSON.parse(raw) as ClosingPreview;
    if (preview.exhibitionId !== exhibitionId || typeof preview.artworkId !== "string" || typeof preview.previewUrl !== "string"
      || typeof preview.data !== "string" || preview.data.length > MAX_DATA_LENGTH
      || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/u.test(preview.data)) return;
    const image = new Image();
    image.src = preview.data;
    await image.decode();
    if (image.naturalWidth > 0) return preview;
  } catch { /* A stale or invalid tab preview never falls back to the network. */ }
}
