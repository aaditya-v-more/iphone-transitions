import { N_PHONES } from "../data/phones";

/**
 * The scroll journey is divided into N_PHONES equal segments (one per resume
 * section). Each phone "holds" its shape through the middle of its segment
 * and morphs into the next across the segment boundary.
 *
 * STOPS holds 2 progress values per phone (hold start, hold end); a property
 * track duplicates each phone's value for those two stops, producing
 * hold → transition → hold ramps for free via useTransform.
 */

const TRANS = 0.55; // fraction of a segment spent transitioning (split across the boundary)
const HALF = TRANS / (2 * N_PHONES);

export const STOPS: number[] = [];
for (let i = 0; i < N_PHONES; i++) {
  STOPS.push(i === 0 ? 0 : i / N_PHONES + HALF);
  STOPS.push(i === N_PHONES - 1 ? 1 : (i + 1) / N_PHONES - HALF);
}

/** Duplicate each per-phone value to match STOPS. */
export const expand = <T,>(values: T[]): T[] => values.flatMap((v) => [v, v]);

/** Cubic ease-in-out applied to every transition segment. */
export const segEase = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** 1 while phone i holds, ramping to 0 during transitions — for crossfades. */
export const oneHot = (i: number): number[] =>
  Array.from({ length: N_PHONES }, (_, j) => (j === i ? 1 : 0));

/** Scroll offset (px) that centers the viewport on phone i's hold zone. */
export function scrollTargetFor(el: HTMLElement, i: number): number {
  const rect = el.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const scrollable = el.offsetHeight - window.innerHeight;
  return top + ((i + 0.5) / N_PHONES) * scrollable;
}
