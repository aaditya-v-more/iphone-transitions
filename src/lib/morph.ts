import type { PhoneSpec } from "../data/phones";

const phase = (start: number, end: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export const defaultFoldOpen = (phone: PhoneSpec) => (phone.fold?.axis === "flip" ? 0 : 1);

/** Rotate around a fixed hinge above the glass so the two screens never intersect. */
export function hingePose(open: number, thickness: number, weight = 1, clearance = 0.08) {
  const angle = (1 - Math.max(0, Math.min(1, open))) * Math.PI;
  const radius = ((thickness + clearance) / 2) * weight;
  return {
    angle,
    shift: radius * Math.sin(angle),
    lift: radius * (1 - Math.cos(angle)),
  };
}

/** Reshape while closed, then reveal the second panel by rotating the hinge. */
export function foldChoreography(
  from: PhoneSpec,
  to: PhoneSpec,
  mix: number,
  fromOpen = defaultFoldOpen(from),
  toOpen = defaultFoldOpen(to),
) {
  if (from.id === to.id || (!from.fold && !to.fold)) return { shapeMix: mix, hingeOpen: fromOpen };

  if (!from.fold && to.fold?.axis === "book")
    return { shapeMix: phase(0, 0.46, mix), hingeOpen: toOpen * phase(0.46, 1, mix) };

  // Overlap the last part of opening with reshaping; the two matching panels
  // retain one image. Reversing the scroll retraces the same path exactly.
  if (from.fold?.axis === "flip" && !to.fold)
    return {
      shapeMix: phase(0.24 * (1 - fromOpen), 1, mix),
      hingeOpen: fromOpen + (1 - fromOpen) * phase(0, 0.52, mix),
    };

  if (!from.fold && to.fold?.axis === "flip")
    return {
      shapeMix: phase(0, 1 - 0.24 * (1 - toOpen), mix),
      hingeOpen: 1 + (toOpen - 1) * phase(0.48, 1, mix),
    };

  if (from.fold && !to.fold) {
    // Exact reverse of slab → book, including a manually held hinge angle.
    return {
      shapeMix: phase(0.54, 1, mix),
      hingeOpen: fromOpen * (1 - phase(0, 0.54, mix)),
    };
  }

  return {
    shapeMix: phase(0.24, 0.64, mix),
    hingeOpen: fromOpen * (1 - phase(0, 0.24, mix)) + toOpen * phase(0.64, 1, mix),
  };
}

export function sampleJourney(progress: number, phones: PhoneSpec[]) {
  const cursor = Math.max(0, Math.min(0.999999, progress)) * phones.length - 0.5;
  const from = Math.max(0, Math.min(phones.length - 1, Math.floor(cursor)));
  const to = Math.max(0, Math.min(phones.length - 1, Math.ceil(cursor)));
  const local = Math.max(0, Math.min(1, (cursor - Math.floor(cursor) - 0.2) / 0.6));
  const mix = local * local * (3 - 2 * local);
  return { from: phones[from], to: phones[to], mix };
}

export function activeIndex(progress: number, count: number) {
  return Math.max(0, Math.min(count - 1, Math.floor(progress * count)));
}

export function modelProgress(index: number, count: number) {
  return (index + 0.5) / count;
}
