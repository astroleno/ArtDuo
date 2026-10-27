function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const closingPunctuation = new Set(Array.from("，。、；：！？）》】〕〉」』”’…,.!?;:)]}"));
  const openingPunctuation = new Set(Array.from("（《【〔〈「『“‘([{"));
  let line = "";
  for (const character of Array.from(text)) {
    if (line && ctx.measureText(`${line}${character}`).width > maxWidth) {
      const previous = Array.from(line);
      let carry = "";
      // Keep a Chinese closing mark with the preceding character, and an
      // opening mark with the following one, without overflowing the card.
      if (previous.length > 1 && (closingPunctuation.has(character) || openingPunctuation.has(previous.at(-1)!))) {
        carry = previous.pop()!;
        while (previous.length > 1 && closingPunctuation.has(Array.from(carry)[0]!)) carry = previous.pop()! + carry;
      }
      lines.push(previous.join(""));
      line = carry + character;
    } else line += character;
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (typeof location !== "undefined" && new URL(url, location.href).origin !== location.origin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("分享图片载入失败"));
    image.src = url;
  });
}

export interface ShareCardOptions {
  imageUrl: string; artworkTitle: string; artistLine: string; sourceLabel: string; closingLine: string;
  handwritingLayer?: import("@artduo/contracts").HandwritingLayer;
  provenance?: { exhibitionId: string; artworkId: string; releaseVersion: string };
}

export async function createShareCard(options: ShareCardOptions): Promise<Blob> {
  await document.fonts?.ready;
  const image = await loadImage(options.imageUrl);
  const handwriting = options.handwritingLayer ? await loadImage(options.handwritingLayer.url) : undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建分享画布");
  const width = canvas.width;
  const fonts = {
    title: '500 34px "Noto Serif SC", "Songti SC", serif',
    artist: '400 22px "IBM Plex Mono", monospace',
    source: '400 17px "IBM Plex Mono", monospace',
    closing: '400 29px "Noto Serif SC", "Songti SC", serif',
  };
  const measure = (text: string, font: string, maxWidth = width - 176) => {
    context.font = font;
    return wrapText(context, text, maxWidth);
  };
  const titleLines = measure(options.artworkTitle, fonts.title);
  const artistLines = measure(options.artistLine, fonts.artist);
  const sourceLines = measure(options.sourceLabel, fonts.source);
  const closingLines = measure(options.closingLine, fonts.closing);
  const titleBottom = 856 + titleLines.length * 48;
  const sourceTop = titleBottom + 4 + artistLines.length * 32;
  const closingTop = Math.max(1010, sourceTop + sourceLines.length * 25 + 42);
  // Height follows the actual narrative and credits; a long closing never crosses the footer.
  const writingHeight = handwriting ? handwriting.naturalHeight * (width - 176) / handwriting.naturalWidth : closingLines.length * 46;
  canvas.height = Math.ceil(Math.max(1240, closingTop + writingHeight + 150));
  if (canvas.height > 16000 || canvas.width * canvas.height > 20_000_000) throw new Error("寄语卡过长，请调整段落或缩短文字。");
  const height = canvas.height;
  context.fillStyle = "#100f0d";
  context.fillRect(0, 0, width, height);

  const imageBox = { x: 88, y: 92, width: width - 176, height: 690 };
  const scale = Math.min(imageBox.width / image.naturalWidth, imageBox.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = imageBox.x + (imageBox.width - drawWidth) / 2;
  const drawY = imageBox.y + (imageBox.height - drawHeight) / 2;
  context.strokeStyle = "rgba(205,177,126,.62)";
  context.lineWidth = 2;
  context.strokeRect(drawX - 12, drawY - 12, drawWidth + 24, drawHeight + 24);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  context.fillStyle = "#efe9df";
  context.font = fonts.title;
  titleLines.forEach((line, index) => context.fillText(line, 88, 856 + index * 48));
  context.fillStyle = "#aaa298";
  context.font = fonts.artist;
  artistLines.forEach((line, index) => context.fillText(line, 88, titleBottom + 4 + index * 32));
  context.fillStyle = "#857a69";
  context.font = fonts.source;
  sourceLines.forEach((line, index) => context.fillText(line, 88, sourceTop + index * 25));
  context.fillStyle = "#ded7cc";
  context.font = fonts.closing;
  if (handwriting) context.drawImage(handwriting, 88, closingTop - 24, width - 176, writingHeight);
  else closingLines.forEach((line, index) => context.fillText(line, 88, closingTop + index * 46));
  context.fillStyle = "#9e927f";
  context.font = '400 18px "IBM Plex Mono", monospace';
  context.fillText("ARTDUO · MOOD GALLERY", 88, height - 58);

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("纪念卡暂时无法导出。")), "image/png"));
  if (!options.handwritingLayer) return blob;
  if (!options.provenance) throw new Error("纪念卡缺少作品关联信息。");
  const { finalizeSharePng } = await import("./finalize-share-png");
  const bytes = finalizeSharePng(new Uint8Array(await blob.arrayBuffer()), options.handwritingLayer.aigc, { ...options.provenance, handwritingSourceIds: options.handwritingLayer.sourceProduceIds });
  return new Blob([new Uint8Array(bytes).buffer], { type: "image/png" });
}

export function downloadShareCard(blob: Blob, filename = `artduo-${new Date().toISOString().slice(0, 10)}.png`): void {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.download = filename; anchor.href = url; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function generateShareCard(options: ShareCardOptions): Promise<void> { downloadShareCard(await createShareCard(options)); }
