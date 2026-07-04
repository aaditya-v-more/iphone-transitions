import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import MorphingPhone from "./components/MorphingPhone";
import { YearWatermark, ModelCaption } from "./components/PhoneHUD";
import TimelineRail from "./components/TimelineRail";
import Backdrop from "./components/Backdrop";
import Overture from "./components/Overture";
import { N_PHONES } from "./data/phones";

export default function App() {
  const journeyRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: journeyRef,
    offset: ["start start", "end end"],
  });
  /* A light spring gives the morph physical inertia instead of raw 1:1 scroll. */
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });

  /* The pair drifts up and settles as the overture lifts. */
  const introY = useTransform(progress, [0, 1 / N_PHONES], [30, 0]);
  const introScale = useTransform(progress, [0, 1 / N_PHONES], [0.94, 1]);

  return (
    <>
      <Backdrop progress={progress} />

      <header className="site-header">
        <span className="brand">The Shape of the iPhone</span>
        <span className="header-range">{N_PHONES} generations · 2007 → 2025</span>
      </header>

      <main
        className="journey"
        ref={journeyRef}
        style={{ height: `calc(${N_PHONES} * var(--seg))` }}
      >
        <div className="stage">
          <YearWatermark progress={progress} />
          <motion.div className="pair" style={{ y: introY, scale: introScale }}>
            <MorphingPhone progress={progress} />
          </motion.div>
          <ModelCaption progress={progress} />
        </div>
      </main>

      <TimelineRail progress={progress} journeyRef={journeyRef} />
      <Overture progress={progress} />

      <footer className="colophon">Hand-drawn in SVG · morphs driven by scroll · React + Motion</footer>
    </>
  );
}
