import type { PhoneSpec } from "../data/phones";

/** Photo-derived enclosure profiles, not manufacturer CAD radii.
 * Values are scene units; published maximum dimensions remain unchanged.
 * Flat families deliberately do not inherit the old generic body.curve value.
 */
export interface BodyProfile {
  weight: number;
  roll: number;
  rise: number;
  frontRoll: number;
  frontDrop: number;
}

const profiles: Record<string, [number, number, number?, number?]> = {
  iphone: [0.52, 0.64],
  "iphone-3gs": [0.91, 0.73],
  "iphone-6": [0.48, 0.46],
  "iphone-7-plus": [0.46, 0.45],
  "iphone-x": [0.42, 0.44],
  "iphone-11-pro": [0.40, 0.42],
  "galaxy-s": [0.45, 0.43],
  "galaxy-s3": [0.75, 0.58],
  // Include the active display in the bend, not only the surrounding mask.
  "galaxy-s6-edge": [0.18, 0.2, 0.80, 0.25],
  "galaxy-s8": [0.46, 0.42, 0.50, 0.24],
  "galaxy-s10": [0.42, 0.40, 0.40, 0.19],
  "galaxy-s20-ultra": [0.30, 0.30, 0.25, 0.10],
  "galaxy-s22-ultra": [0.36, 0.36, 0.30, 0.16],
};

export function bodyProfile(phone: PhoneSpec): BodyProfile {
  const entry = phone.fold ? undefined : profiles[phone.id];
  const depth = (phone.thickness ?? 8) * 0.042;
  return {
    weight: entry ? 1 : 0,
    roll: (entry?.[0] ?? 0) * depth,
    rise: (entry?.[1] ?? 0) * depth,
    frontRoll: (entry?.[2] ?? 0) * depth,
    frontDrop: (entry?.[3] ?? 0) * depth,
  };
}

export function mixBodyProfile(a: PhoneSpec, b: PhoneSpec, t: number): BodyProfile {
  const first = bodyProfile(a), last = bodyProfile(b);
  const mix = (key: keyof BodyProfile) => first[key] + (last[key] - first[key]) * t;
  return { weight: mix("weight"), roll: mix("roll"), rise: mix("rise"),
    frontRoll: mix("frontRoll"), frontDrop: mix("frontDrop") };
}

/** Inward distance from the rounded-rectangle perimeter, including its corners. */
export function perimeterInset(x: number, y: number, w: number, h: number, r: number) {
  const qx = Math.abs(x) - (w / 2 - r), qy = Math.abs(y) - (h / 2 - r);
  return Math.max(0, r - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0));
}

/** Amount by which the rounded back retreats toward the flat front. */
export function rearSurfaceDrop(x: number, y: number, w: number, h: number, r: number,
  roll: number, rise: number) {
  if (roll <= 0 || rise <= 0) return 0;
  const u = Math.min(1, perimeterInset(x, y, w, h, r) / roll);
  return rise * (1 - Math.sqrt(Math.max(0, 1 - (1 - u) ** 2)));
}

/** Dual-edge glass bends only near the two long edges, not across the center. */
export function frontSurfaceDrop(x: number, w: number, roll: number, drop: number) {
  if (roll <= 0 || drop <= 0) return 0;
  const u = Math.max(0, Math.min(1, (Math.abs(x) - (w / 2 - roll)) / roll));
  return drop * u * u;
}
