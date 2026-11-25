const primaryColors: Record<string, readonly [number, number, number]> = {
  white: [241, 238, 226], black: [62, 60, 61], gray: [149, 149, 150], grey: [149, 149, 150],
  red: [179, 87, 79], orange: [197, 126, 78], yellow: [207, 180, 79], gold: [194, 160, 93], ochre: [174, 135, 76],
  green: [109, 150, 111], teal: [93, 145, 143], blue: [91, 135, 176], indigo: [91, 100, 156], purple: [144, 113, 154],
  pink: [185, 128, 148], brown: [151, 115, 85], beige: [197, 176, 143], cream: [232, 219, 188],
};

function firstHue(tags: readonly string[]) {
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    const name = tag.match(/^(?:(?:pale|deep|dark|light|muted)\s+)?([a-z]+)$/u)?.[1];
    const hex = /^#([a-f0-9]{6})$/u.exec(tag)?.[1];
    const color = hex ? [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
      : name && Object.hasOwn(primaryColors, name) ? primaryColors[name] : undefined;
    if (color) return color;
  }
  return undefined;
}

/** Measured lightness sets the aperture's luminance. Tags supply only a muted hue. */
export function artworkPlaceholderRgb(tags: readonly string[] = [], appearance?: { meanLightness: number; chroma: number }): string | undefined {
  if (!appearance || ![appearance.meanLightness, appearance.chroma].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) return undefined;
  const luminance = 255 * (.06 + .88 * appearance.meanLightness);
  const hue = firstHue(tags);
  if (!hue) return Array(3).fill(Math.round(luminance)).join(" ");
  const hueLuminance = .2126 * hue[0]! + .7152 * hue[1]! + .0722 * hue[2]!;
  const saturation = Math.min(.30, appearance.chroma * .82);
  return hue.map(channel => Math.round(Math.max(0, Math.min(255, luminance + (channel - hueLuminance) * saturation)))).join(" ");
}
