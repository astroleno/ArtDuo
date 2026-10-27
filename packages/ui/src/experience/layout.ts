import type { BackgroundSceneRecord, NormalizedPoint, NormalizedRect, NormalizedZone } from "@artduo/contracts";

export interface RoomLayoutInput {
  viewport: { width: number; height: number };
  sceneSize: { width: number; height: number };
  mountZone?: NormalizedZone;
  artworkAspectRatio: number;
  /** Combined mat and border on each edge, outside the artwork image. */
  frameInset?: number;
  navigationHeight?: number;
  plaqueHeight?: number;
  /** Fixed rendered label; hover and focus never change its typography. */
  plaqueSize?: RoomPlaqueSize;
  safeArea?: { top?: number; right?: number; bottom?: number; left?: number };
}

/** All returned bounds are viewport CSS pixels, not normalized scene coordinates. */
export interface RoomRect { x: number; y: number; width: number; height: number }
export interface RoomPlaqueSize { width: number; height: number }

export interface RoomLayout {
  frame: RoomRect;
  frameInset: number;
  plaque: RoomRect;
  plaquePlacement: "right" | "left" | "below";
  compactPlaqueWidth: number;
  mount: RoomRect;
  mobilePlaque: boolean;
  staticFallback: boolean;
}

function pointInside(point: NormalizedPoint, polygon: NormalizedPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function polygonInteriorRect(points: NormalizedPoint[]): NormalizedRect | undefined {
  if (points.length < 3) return undefined;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  let center: NormalizedPoint | undefined;
  let bestDistance = -1;
  for (let y = minY; y <= maxY; y += 1 / 48) {
    for (let x = minX; x <= maxX; x += 1 / 48) {
      const candidate = { x, y };
      if (!pointInside(candidate, points)) continue;
      const distance = Math.min(x - minX, maxX - x, y - minY, maxY - y);
      if (distance > bestDistance) {
        center = candidate;
        bestDistance = distance;
      }
    }
  }
  if (!center) return undefined;
  const base = { x: center.x - (maxX - minX) / 2, y: center.y - (maxY - minY) / 2, width: maxX - minX, height: maxY - minY };
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i += 1) {
    const scale = (low + high) / 2;
    const rect = { x: center.x + (base.x - center.x) * scale, y: center.y + (base.y - center.y) * scale, width: base.width * scale, height: base.height * scale };
    const corners = [
      { x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y },
      { x: rect.x, y: rect.y + rect.height }, { x: rect.x + rect.width, y: rect.y + rect.height },
    ];
    if (corners.every((point) => pointInside(point, points))) low = scale;
    else high = scale;
  }
  return low > 0.05 ? {
    x: center.x + (base.x - center.x) * low,
    y: center.y + (base.y - center.y) * low,
    width: base.width * low,
    height: base.height * low,
  } : undefined;
}

function validNormalizedRect(rect: NormalizedRect | undefined): rect is NormalizedRect {
  return Boolean(rect && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0
    && rect.x + rect.width <= 1 && rect.y + rect.height <= 1);
}

export function sceneMountZone(scene: BackgroundSceneRecord | null): NormalizedZone | undefined {
  return scene?.stage_profile.primary_mount_zone;
}

export function calculateRoomLayout(input: RoomLayoutInput): RoomLayout {
  const { viewport, sceneSize } = input;
  const safe = input.safeArea ?? {};
  const safeLeft = Math.max(0, safe.left ?? 0);
  const safeTop = Math.max(0, safe.top ?? 0) + (input.navigationHeight ?? 72);
  const safeRight = Math.max(0, safe.right ?? 0);
  const safeBottom = Math.max(0, safe.bottom ?? 0) + 24;
  const safeWidth = Math.max(1, viewport.width - safeLeft - safeRight);
  const safeHeight = Math.max(1, viewport.height - safeTop - safeBottom);
  const preferBelow = viewport.width < 768 && viewport.height >= viewport.width;
  const scale = Math.max(viewport.width / Math.max(sceneSize.width, 1), viewport.height / Math.max(sceneSize.height, 1));
  const offsetX = (viewport.width - sceneSize.width * scale) / 2;
  const offsetY = (viewport.height - sceneSize.height * scale) / 2;
  const zone = input.mountZone;
  let projected: RoomRect | undefined;
  if (zone?.shape === "rect" && validNormalizedRect(zone.rect)) {
    projected = {
      x: offsetX + zone.rect.x * sceneSize.width * scale,
      y: offsetY + zone.rect.y * sceneSize.height * scale,
      width: zone.rect.width * sceneSize.width * scale,
      height: zone.rect.height * sceneSize.height * scale,
    };
  } else if (zone?.shape === "polygon" && zone.points?.every((point) =>
    Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)) {
    const inside = polygonInteriorRect(zone.points);
    if (inside) projected = {
      x: offsetX + inside.x * sceneSize.width * scale,
      y: offsetY + inside.y * sceneSize.height * scale,
      width: inside.width * sceneSize.width * scale,
      height: inside.height * sceneSize.height * scale,
    };
  }
  const x1 = Math.max(safeLeft, projected?.x ?? safeLeft);
  const y1 = Math.max(safeTop, projected?.y ?? safeTop);
  const x2 = Math.min(viewport.width - safeRight, (projected?.x ?? safeLeft + safeWidth) + (projected?.width ?? safeWidth));
  const y2 = Math.min(viewport.height - safeBottom, (projected?.y ?? safeTop + safeHeight) + (projected?.height ?? safeHeight));
  const candidate = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  const contentBottom = Math.max(safeTop + 1, viewport.height - Math.max(0, safe.bottom ?? 0) - 88);
  const contentHeight = Math.max(1, contentBottom - safeTop);
  const plaqueWidth = Math.max(1, Math.min(input.plaqueSize?.width ?? 188, safeWidth - 40));
  let plaqueHeight = Math.max(1, Math.min(input.plaqueSize?.height ?? input.plaqueHeight ?? 76, contentHeight));
  let staticFallback = !projected || !Object.values(candidate).every(Number.isFinite) || candidate.width < 96 || candidate.height < 96;
  let mount = staticFallback ? { x: safeLeft, y: safeTop, width: safeWidth, height: safeHeight } : candidate;
  const aspect = Number.isFinite(input.artworkAspectRatio) && input.artworkAspectRatio > 0 ? input.artworkAspectRatio : 1.2;
  const fitFrame = (areaHeight: number, below: boolean) => {
    const maxWidth = Math.max(1, Math.min(mount.width * .9, safeWidth * (below ? .92 : .72)));
    const maxHeight = Math.max(1, Math.min(Math.max(1, areaHeight) * .9, viewport.height * .62));
    const inset = Math.max(0, Math.min(input.frameInset ?? 0, (Math.min(maxWidth, maxHeight) - 1) / 2));
    const imageWidth = Math.min(maxWidth - inset * 2, (maxHeight - inset * 2) * aspect);
    const width = imageWidth + inset * 2;
    const height = imageWidth / aspect + inset * 2;
    return { frame: { x: mount.x + (mount.width - width) / 2, y: mount.y + (below ? 0 : Math.max(0, (areaHeight - height) / 2)), width, height }, inset };
  };
  const result = (frame: RoomRect, frameInset: number, plaque: RoomRect, plaquePlacement: RoomLayout["plaquePlacement"]): RoomLayout => ({
    frame, frameInset, plaque, plaquePlacement, mount, mobilePlaque: plaquePlacement === "below", staticFallback,
    compactPlaqueWidth: Math.min(plaque.width, Math.max(100, Math.min(124, frame.width * .26))),
  });
  const labelLeft = safeLeft + 20;
  const labelRight = viewport.width - safeRight - 20;
  if (!preferBelow && mount.y < contentBottom) {
    const { frame, inset } = fitFrame(Math.min(mount.y + mount.height, contentBottom) - mount.y, false);
    const y = Math.max(safeTop, Math.min(contentBottom - plaqueHeight, frame.y + frame.height - plaqueHeight));
    const rightX = frame.x + frame.width + 20;
    const leftX = frame.x - 20 - plaqueWidth;
    if (rightX + plaqueWidth <= labelRight) return result(frame, inset, { x: rightX, y, width: plaqueWidth, height: plaqueHeight }, "right");
    if (leftX >= labelLeft) return result(frame, inset, { x: leftX, y, width: plaqueWidth, height: plaqueHeight }, "left");
    // A small shift within the same wall keeps landscape phones from becoming a
    // tiny image above a tall label. Never shift the work outside its mount.
    const rightShift = rightX + plaqueWidth - labelRight;
    if (frame.x - rightShift >= mount.x) {
      return result({ ...frame, x: frame.x - rightShift }, inset, { x: labelRight - plaqueWidth, y, width: plaqueWidth, height: plaqueHeight }, "right");
    }
    const leftShift = labelLeft - leftX;
    if (frame.x + frame.width + leftShift <= mount.x + mount.width) {
      return result({ ...frame, x: frame.x + leftShift }, inset, { x: labelLeft, y, width: plaqueWidth, height: plaqueHeight }, "left");
    }
  }
  const minimumFrameHeight = Math.min(96, contentHeight * .35);
  let areaHeight = Math.min(mount.y + mount.height, contentBottom - plaqueHeight - 12) - mount.y;
  if (areaHeight < minimumFrameHeight) {
    staticFallback = true;
    mount = { x: safeLeft, y: safeTop, width: safeWidth, height: contentHeight };
    plaqueHeight = Math.min(plaqueHeight, Math.max(1, contentHeight - minimumFrameHeight - 12));
    areaHeight = Math.max(1, contentHeight - plaqueHeight - 12);
  }
  const { frame, inset } = fitFrame(areaHeight, true);
  const plaque = {
    x: Math.max(labelLeft, Math.min(labelRight - plaqueWidth, frame.x + frame.width - plaqueWidth)),
    y: frame.y + frame.height + 12, width: plaqueWidth, height: plaqueHeight,
  };
  return result(frame, inset, plaque, "below");
}
