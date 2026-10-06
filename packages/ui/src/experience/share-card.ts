function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const character of Array.from(text)) {
    if (line && ctx.measureText(`${line}${character}`).width > maxWidth) {
      lines.push(line);
      line = character;
    } else line += character;
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("分享图片载入失败"));
    image.src = url;
  });
}

export async function generateShareCard(options: { imageUrl: string; artworkTitle: string; artistLine: string; sourceLabel: string; closingLine: string }): Promise<void> {
  await document.fonts?.ready;
  const image = await loadImage(options.imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建分享画布");
  const width = canvas.width;
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
  context.font = '500 34px "Noto Serif SC", "Songti SC", serif';
  const titleLines = wrapText(context, options.artworkTitle, width - 176);
  titleLines.forEach((line, index) => context.fillText(line, 88, 856 + index * 48));
  const titleBottom = 856 + titleLines.length * 48;
  context.fillStyle = "#aaa298";
  context.font = '400 22px "IBM Plex Mono", monospace';
  const artistLines = wrapText(context, options.artistLine, width - 176);
  artistLines.forEach((line, index) => context.fillText(line, 88, titleBottom + 4 + index * 32));
  const sourceTop = titleBottom + 4 + artistLines.length * 32;
  context.fillStyle = "#857a69";
  context.font = '400 17px "IBM Plex Mono", monospace';
  const sourceLines = wrapText(context, options.sourceLabel, width - 176);
  sourceLines.forEach((line, index) => context.fillText(line, 88, sourceTop + index * 25));
  context.fillStyle = "#ded7cc";
  context.font = '400 29px "Noto Serif SC", "Songti SC", serif';
  const closingLines = wrapText(context, options.closingLine, width - 176);
  const closingTop = Math.max(1068, sourceTop + sourceLines.length * 25 + 35);
  closingLines.forEach((line, index) => context.fillText(line, 88, closingTop + index * 46));
  context.fillStyle = "#9e927f";
  context.font = '400 18px "IBM Plex Mono", monospace';
  context.fillText("ARTDUO · MOOD GALLERY", 88, 1262);

  const anchor = document.createElement("a");
  anchor.download = `artduo-${new Date().toISOString().slice(0, 10)}.png`;
  anchor.href = canvas.toDataURL("image/png");
  anchor.click();
}
