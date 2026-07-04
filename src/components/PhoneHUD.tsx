import { motion, useTransform, type MotionValue } from "motion/react";
import { PHONES } from "../data/phones";
import { STOPS, expand, oneHot } from "../lib/track";

type MV = MotionValue<number>;

/** Giant ghost year behind the phones, crossfading per era. */
export function YearWatermark({ progress }: { progress: MV }) {
  return (
    <div className="year-watermark" aria-hidden>
      {PHONES.map((p, i) => (
        <GhostYear key={p.id} progress={progress} index={i} year={p.year} />
      ))}
    </div>
  );
}

function GhostYear({ progress, index, year }: { progress: MV; index: number; year: number }) {
  const opacity = useTransform(progress, STOPS, expand(oneHot(index)));
  const y = useTransform(opacity, (v) => (1 - v) * 30);
  return (
    <motion.span className="ghost-year" style={{ opacity, y }}>
      {year}
    </motion.span>
  );
}

/** Model name + tagline + design shift + specline, bottom of the stage. */
export function ModelCaption({ progress }: { progress: MV }) {
  return (
    <div className="model-caption">
      {PHONES.map((p, i) => (
        <CaptionCard key={p.id} progress={progress} index={i} />
      ))}
    </div>
  );
}

function CaptionCard({ progress, index }: { progress: MV; index: number }) {
  const p = PHONES[index];
  const opacity = useTransform(progress, STOPS, expand(oneHot(index)));
  const y = useTransform(opacity, (v) => (1 - v) * 14);
  return (
    <motion.div className="caption-card" style={{ opacity, y }}>
      <span className="caption-year" style={{ color: p.accent }}>
        {p.year} · {String(index + 1).padStart(2, "0")} / {PHONES.length}
      </span>
      <span className="caption-name">{p.name}</span>
      <span className="caption-tagline">{p.tagline}</span>
      <span className="caption-delta" style={{ color: p.accent }}>
        ↳ {p.delta}
      </span>
      <span className="caption-spec">{p.specline}</span>
    </motion.div>
  );
}
