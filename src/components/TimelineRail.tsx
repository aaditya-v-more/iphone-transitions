import type { RefObject } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { PHONES } from "../data/phones";
import { STOPS, expand, oneHot, scrollTargetFor } from "../lib/track";

type MV = MotionValue<number>;

export default function TimelineRail({
  progress,
  journeyRef,
}: {
  progress: MV;
  journeyRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <nav className="rail" aria-label="iPhone timeline">
      {PHONES.map((p, i) => (
        <RailDot key={p.id} progress={progress} index={i} journeyRef={journeyRef} />
      ))}
    </nav>
  );
}

function RailDot({
  progress,
  index,
  journeyRef,
}: {
  progress: MV;
  index: number;
  journeyRef: RefObject<HTMLDivElement | null>;
}) {
  const p = PHONES[index];
  const hot = useTransform(progress, STOPS, expand(oneHot(index)));
  const scale = useTransform(hot, [0, 1], [1, 1.9]);
  const glow = useTransform(hot, (v) => `rgba(255,255,255,${0.25 + v * 0.75})`);

  return (
    <button
      className="rail-dot"
      title={`${p.name} · ${p.year}`}
      aria-label={`Jump to ${p.name}`}
      onClick={() => {
        const el = journeyRef.current;
        if (el) window.scrollTo({ top: scrollTargetFor(el, index), behavior: "smooth" });
      }}
    >
      <motion.span className="rail-dot-mark" style={{ scale, backgroundColor: glow }} />
      <motion.span className="rail-dot-year" style={{ opacity: useTransform(hot, [0, 1], [0, 1]) }}>
        {p.year}
      </motion.span>
    </button>
  );
}
