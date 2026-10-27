/** The rounded lens and inward bevel follow LuBirth's LiquidGlassRenderer. */
export function glassDisplacementMap(width: number, height: number, radius: number) {
  const rasterWidth = Math.max(1, Math.min(512, Math.ceil(width)));
  const rasterHeight = Math.max(1, Math.min(128, Math.ceil(height)));
  const data = new Uint8ClampedArray(rasterWidth * rasterHeight * 4);
  const halfX = Math.max(width, 1) / 2;
  const halfY = Math.max(height, 1) / 2;
  const r = Math.max(0, Math.min(radius, halfX, halfY));
  const bevel = Math.min(9, halfX * .72, halfY * .72);
  const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
  for (let y = 0; y < rasterHeight; y++) {
    for (let x = 0; x < rasterWidth; x++) {
      const px = (x + .5) / rasterWidth * width - halfX;
      const py = (y + .5) / rasterHeight * height - halfY;
      const qx = Math.abs(px) - halfX + r;
      const qy = Math.abs(py) - halfY + r;
      const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      const nx = px - clamp(px, -halfX + r, halfX - r);
      const ny = py - clamp(py, -halfY + r, halfY - r);
      const length = Math.hypot(nx, ny);
      const t = clamp(-distance / Math.max(bevel, .001), 0, 1);
      const lens = distance <= 0 ? Math.sin(t * Math.PI) * (1 - t * .28) : 0;
      const i = (y * rasterWidth + x) * 4;
      data[i] = 128 - (length ? nx / length : 0) * lens * 100;
      data[i + 1] = 128 - (length ? ny / length : 0) * lens * 100;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return { width: rasterWidth, height: rasterHeight, data };
}
