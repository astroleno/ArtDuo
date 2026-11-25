const neutral = [222, 214, 201] as const;
const primaryColors: Record<string, readonly [number, number, number]> = {
  white: [241, 238, 226], black: [62, 60, 61], gray: [149, 149, 150], grey: [149, 149, 150],
  red: [179, 87, 79], orange: [197, 126, 78], yellow: [207, 180, 79], gold: [194, 160, 93], ochre: [174, 135, 76],
  green: [109, 150, 111], teal: [93, 145, 143], blue: [91, 135, 176], indigo: [91, 100, 156], purple: [144, 113, 154],
  pink: [185, 128, 148], brown: [151, 115, 85], beige: [197, 176, 143], cream: [232, 219, 188],
};

/** The catalogue's first recognized primary colour, mixed toward the existing neutral frame. */
export function artworkPlaceholderRgb(tags: readonly string[] = []): string | undefined {
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    const name = tag.match(/^(?:(?:pale|deep|dark|light|muted)\s+)?([a-z]+)$/u)?.[1];
    const hex = /^#([a-f0-9]{6})$/u.exec(tag)?.[1];
    const color = hex ? [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
      : name && Object.hasOwn(primaryColors, name) ? primaryColors[name] : undefined;
    if (color) return neutral.map((channel, index) => Math.round(channel * .74 + color[index]! * .26)).join(" ");
  }
  return undefined;
}
