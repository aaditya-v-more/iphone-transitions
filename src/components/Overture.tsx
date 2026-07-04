import { motion, useTransform, type MotionValue } from "motion/react";
import { N_PHONES } from "../data/phones";

/** Opening title card: a dark veil over the stage that lifts as you scroll. */
export default function Overture({ progress }: { progress: MotionValue<number> }) {
  const fade = [0, 0.45 / N_PHONES];
  const opacity = useTransform(progress, fade, [1, 0]);
  const y = useTransform(progress, fade, [0, -46]);
  return (
    <motion.div className="overture" style={{ opacity }} aria-hidden>
      <div className="overture-veil" />
      <motion.div className="overture-copy" style={{ y }}>
        <p className="overture-kicker">2007 — 2025</p>
        <h1 className="overture-title">The Shape of the iPhone</h1>
        <p className="overture-sub">
          Thirteen generations drawn as one continuous object. Scroll, and watch
          every lens, notch and button migrate to its next home.
        </p>
        <div className="scroll-hint">
          <span className="scroll-hint-arrow">↓</span> scroll
        </div>
      </motion.div>
    </motion.div>
  );
}
