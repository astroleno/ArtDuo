export interface SculptureProportions {
  height: number;
  width: number;
  depth: number;
  pedestalHeight: number;
  pedestalWidth: number;
  pedestalDepth: number;
}

/** Phone labels share the bottom navigation row, leaving the full width to the sculpture. */
export function sculptureRoomLayout(width: number, height: number, proportions: SculptureProportions) {
  const mobile = width < 768;
  const totalHeight = proportions.height + proportions.pedestalHeight;
  const turningWidth = Math.max(Math.hypot(proportions.width, proportions.depth), proportions.pedestalWidth, proportions.pedestalDepth);
  const availableWidth = width * (mobile ? .8 : .36);
  const availableHeight = Math.max(100, height - (height < 500 ? 120 : 160));
  const displayHeight = Math.min(height * .67, availableHeight, availableWidth / turningWidth * totalHeight);
  return {
    centerX: width * (mobile ? .5 : .49),
    floorY: height * .85,
    displayHeight,
    displayWidth: displayHeight / totalHeight * turningWidth,
    totalHeight,
  };
}
