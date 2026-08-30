export type DeviceOrientationAccess = "granted" | "denied" | "unsupported";

export interface DeviceParallaxTracker {
  baselineBeta?: number;
  baselineGamma?: number;
  x: number;
  y: number;
}

export interface DeviceParallaxVector {
  calibrated: boolean;
  x: number;
  y: number;
}

type PermissionAwareDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const DEAD_ZONE_DEGREES = 1.8;
const MAX_TILT_DEGREES = 8;
const FILTER_WEIGHT = 0.14;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeTilt(delta: number): number {
  const magnitude = Math.abs(delta);
  if (magnitude <= DEAD_ZONE_DEGREES) {
    return 0;
  }

  const normalized = (magnitude - DEAD_ZONE_DEGREES) / (MAX_TILT_DEGREES - DEAD_ZONE_DEGREES);
  return Math.sign(delta) * clamp(normalized, 0, 1);
}

export function createDeviceParallaxTracker(): DeviceParallaxTracker {
  return { x: 0, y: 0 };
}

export function updateDeviceParallax(
  tracker: DeviceParallaxTracker,
  reading: { beta: number; gamma: number },
): DeviceParallaxVector {
  if (tracker.baselineBeta === undefined || tracker.baselineGamma === undefined) {
    tracker.baselineBeta = reading.beta;
    tracker.baselineGamma = reading.gamma;
    tracker.x = 0;
    tracker.y = 0;
    return { calibrated: true, x: 0, y: 0 };
  }

  const targetX = normalizeTilt(reading.gamma - tracker.baselineGamma);
  const targetY = normalizeTilt(reading.beta - tracker.baselineBeta);
  tracker.x += (targetX - tracker.x) * FILTER_WEIGHT;
  tracker.y += (targetY - tracker.y) * FILTER_WEIGHT;

  return {
    calibrated: true,
    x: tracker.x,
    y: tracker.y,
  };
}

export async function requestDeviceOrientationAccess(): Promise<DeviceOrientationAccess> {
  if (typeof window === "undefined" || typeof window.DeviceOrientationEvent === "undefined") {
    return "unsupported";
  }

  const orientationEvent = window.DeviceOrientationEvent as PermissionAwareDeviceOrientationEvent;
  if (typeof orientationEvent.requestPermission !== "function") {
    return "granted";
  }

  try {
    return await orientationEvent.requestPermission() === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}
