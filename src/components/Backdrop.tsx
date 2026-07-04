import { motion, useMotionTemplate, useTransform, type MotionValue } from "motion/react";
import { PHONES } from "../data/phones";
import { STOPS, expand } from "../lib/track";

/** Fixed full-screen glow that shifts hue with the current era. */
export default function Backdrop({ progress }: { progress: MotionValue<number> }) {
  const glow = useTransform(progress, STOPS, expand(PHONES.map((p) => p.accentSoft)));
  const background = useMotionTemplate`
    radial-gradient(1000px 640px at 28% 34%, ${glow}, transparent 72%),
    radial-gradient(760px 540px at 82% 78%, ${glow}, transparent 72%)
  `;
  return <motion.div className="backdrop" style={{ background }} aria-hidden />;
}
