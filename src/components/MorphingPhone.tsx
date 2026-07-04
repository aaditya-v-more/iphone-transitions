import { useEffect, useRef } from "react";
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";
import {
  BACK_CX,
  CANVAS,
  FRONT_CX,
  PHONES,
  bodyLeftAt,
  bodyTop,
  type PhoneSpec,
} from "../data/phones";
import { STOPS, expand, segEase } from "../lib/track";

type MV = MotionValue<number>;

/* Track factories: one motion value per morphing property, sampled across
   all phones. Hook call order is stable because PHONES is static. */
const useNum = (progress: MV, get: (p: PhoneSpec) => number) =>
  useTransform(progress, STOPS, expand(PHONES.map(get)), { ease: segEase });
const useCol = (progress: MV, get: (p: PhoneSpec) => string) =>
  useTransform(progress, STOPS, expand(PHONES.map(get)));

/* Simple-icons Apple logo (viewBox 0 0 24 24). */
const APPLE_PATH =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";

function Lens({ x, y, r, o }: { x: MV; y: MV; r: MV; o: MV }) {
  const glass = useTransform(r, (v) => v * 0.64);
  const pupil = useTransform(r, (v) => v * 0.3);
  const spec = useTransform(r, (v) => v * 0.13);
  const specOff = useTransform(r, (v) => -v * 0.3);
  return (
    <motion.g style={{ x, y, opacity: o }}>
      <motion.circle style={{ r }} fill="#0e0f13" stroke="rgba(255,255,255,0.14)" strokeWidth={1.5} />
      <motion.circle style={{ r: glass }} fill="url(#lens-glass)" />
      <motion.circle style={{ r: pupil }} fill="#0a1730" />
      <motion.circle style={{ cx: specOff, cy: specOff, r: spec }} fill="rgba(255,255,255,0.45)" />
    </motion.g>
  );
}

/** Keep a clip-path rect in sync with the morphing body (clipPath children
    can't reliably take CSS geometry in all engines). */
function useClipSync(bx: MV, by: MV, bw: MV, bh: MV, br: MV) {
  const clipRef = useRef<SVGRectElement>(null);
  useEffect(() => {
    const sync = () => {
      const el = clipRef.current;
      if (!el) return;
      el.setAttribute("x", String(bx.get()));
      el.setAttribute("y", String(by.get()));
      el.setAttribute("width", String(bw.get()));
      el.setAttribute("height", String(bh.get()));
      el.setAttribute("rx", String(br.get()));
    };
    sync();
    const subs = [bx, by, bw, bh, br].map((mv) => mv.on("change", sync));
    return () => subs.forEach((unsub) => unsub());
  }, [bx, by, bw, bh, br]);
  return clipRef;
}

/** Shared body geometry tracks for one view (front or back). */
function useBody(progress: MV, cx: number) {
  return {
    bw: useNum(progress, (p) => p.body.w),
    bh: useNum(progress, (p) => p.body.h),
    bx: useNum(progress, (p) => bodyLeftAt(p, cx)),
    by: useNum(progress, (p) => bodyTop(p)),
    br: useNum(progress, (p) => p.body.r),
  };
}

/* ------------------------------------------------------------------ */
/* Back view: cameras, logo, wordmark — buttons mirrored (seen from behind,
   volume sits on the right, power on the left).                        */
/* ------------------------------------------------------------------ */

function BackView({ progress }: { progress: MV }) {
  const cx = BACK_CX;
  const { bw, bh, bx, by, br } = useBody(progress, cx);
  const bodyFill = useCol(progress, (p) => p.body.color);
  const bandColor = useCol(progress, (p) => p.band.color);
  const bandW = useNum(progress, (p) => p.band.w);
  const clipRef = useClipSync(bx, by, bw, bh, br);

  /* Strips (iPhone 1 plastic bottom, iPhone 5 glass top/bottom) */
  const botStripH = useNum(progress, (p) => p.body.h * p.bottomStrip.hFrac);
  const botStripY = useNum(progress, (p) => bodyTop(p) + p.body.h * (1 - p.bottomStrip.hFrac));
  const botStripO = useNum(progress, (p) => p.bottomStrip.o);
  const botStripC = useCol(progress, (p) => p.bottomStrip.color);
  const topStripH = useNum(progress, (p) => p.body.h * p.topStrip.hFrac);
  const topStripO = useNum(progress, (p) => p.topStrip.o);
  const topStripC = useCol(progress, (p) => p.topStrip.color);

  /* Antenna lines (iPhone 6 / 7 Plus) */
  const antO = useNum(progress, (p) => p.antenna.o);
  const antC = useCol(progress, (p) => p.antenna.color);
  const antY1 = useNum(progress, (p) => bodyTop(p) + p.body.h * 0.085);
  const antY2 = useNum(progress, (p) => bodyTop(p) + p.body.h * 0.915);

  /* Camera module / plateau */
  const mx = useNum(progress, (p) => bodyLeftAt(p, cx) + p.module.x);
  const my = useNum(progress, (p) => bodyTop(p) + p.module.y);
  const mw = useNum(progress, (p) => p.module.w);
  const mh = useNum(progress, (p) => p.module.h);
  const mr = useNum(progress, (p) => p.module.r);
  const mo = useNum(progress, (p) => p.module.o);
  const mc = useCol(progress, (p) => p.module.color);

  /* Lens slots */
  const lens = (i: 0 | 1 | 2) => ({
    x: useNum(progress, (p) => bodyLeftAt(p, cx) + p.lenses[i].x),
    y: useNum(progress, (p) => bodyTop(p) + p.lenses[i].y),
    r: useNum(progress, (p) => p.lenses[i].r),
    o: useNum(progress, (p) => p.lenses[i].o),
  });
  const l0 = lens(0);
  const l1 = lens(1);
  const l2 = lens(2);

  const flX = useNum(progress, (p) => bodyLeftAt(p, cx) + p.flash.x);
  const flY = useNum(progress, (p) => bodyTop(p) + p.flash.y);
  const flR = useNum(progress, (p) => p.flash.r);
  const flO = useNum(progress, (p) => p.flash.o);

  const snX = useNum(progress, (p) => bodyLeftAt(p, cx) + p.sensor.x);
  const snY = useNum(progress, (p) => bodyTop(p) + p.sensor.y);
  const snR = useNum(progress, (p) => p.sensor.r);
  const snO = useNum(progress, (p) => p.sensor.o);

  /* Apple logo + wordmark */
  const logoY = useNum(progress, (p) => bodyTop(p) + p.body.h * p.logo.yFrac);
  const logoS = useNum(progress, (p) => p.logo.scale);
  const logoC = useCol(progress, (p) => p.logo.color);
  const wordO = useNum(progress, (p) => p.wordmark.o);
  const wordC = useCol(progress, (p) => p.wordmark.color);
  const wordY = useNum(progress, (p) => bodyTop(p) + p.body.h * 0.86);

  /* Buttons, mirrored across the body's center line */
  const btnC = useCol(progress, (p) => p.buttons.color);
  const pwX = useNum(progress, (p) => bodyLeftAt(p, cx) + (p.body.w - p.power.x - p.power.w));
  const pwY = useNum(progress, (p) => bodyTop(p) + p.power.y);
  const pwW = useNum(progress, (p) => p.power.w);
  const pwH = useNum(progress, (p) => p.power.h);
  const volX = useNum(progress, (p) => bodyLeftAt(p, cx) + p.body.w);
  const muteY = useNum(progress, (p) => bodyTop(p) + p.body.h * 0.155);
  const vol1Y = useNum(progress, (p) => bodyTop(p) + p.body.h * 0.225);
  const vol2Y = useNum(progress, (p) => bodyTop(p) + p.body.h * 0.315);
  const ccX = useNum(progress, (p) => bodyLeftAt(p, cx) - 7);
  const ccY = useNum(progress, (p) => bodyTop(p) + p.body.h * p.camCtl.yF);
  const ccH = useNum(progress, (p) => p.camCtl.h);
  const ccO = useNum(progress, (p) => p.camCtl.o);

  return (
    <g>
      {/* Buttons sit under the body and poke out past its edges */}
      <motion.rect style={{ x: pwX, y: pwY, width: pwW, height: pwH, fill: btnC }} rx={3.5} />
      <motion.rect style={{ x: volX, y: muteY, fill: btnC }} width={7} height={26} rx={3.5} />
      <motion.rect style={{ x: volX, y: vol1Y, fill: btnC }} width={7} height={46} rx={3.5} />
      <motion.rect style={{ x: volX, y: vol2Y, fill: btnC }} width={7} height={46} rx={3.5} />
      <motion.rect style={{ x: ccX, y: ccY, height: ccH, fill: btnC, opacity: ccO }} width={7} rx={3.5} />

      {/* Body */}
      <motion.rect
        style={{ x: bx, y: by, width: bw, height: bh, rx: br, fill: bodyFill }}
        filter="url(#soft-shadow)"
      />

      {/* Era-specific surface details, clipped to the body */}
      <g clipPath="url(#body-clip-back)">
        <motion.rect style={{ x: bx, y: by, width: bw, height: topStripH, fill: topStripC, opacity: topStripO }} />
        <motion.rect style={{ x: bx, y: botStripY, width: bw, height: botStripH, fill: botStripC, opacity: botStripO }} />
        <motion.rect style={{ x: bx, y: antY1, width: bw, fill: antC, opacity: antO }} height={3} />
        <motion.rect style={{ x: bx, y: antY2, width: bw, fill: antC, opacity: antO }} height={3} />
        <motion.rect style={{ x: bx, y: by, width: bw, height: bh, rx: br }} fill="url(#sheen)" />
      </g>
      <clipPath id="body-clip-back">
        <rect ref={clipRef} />
      </clipPath>

      {/* Steel / titanium band */}
      <motion.rect
        style={{ x: bx, y: by, width: bw, height: bh, rx: br, stroke: bandColor, strokeWidth: bandW }}
        fill="none"
      />

      {/* Camera module / plateau */}
      <motion.rect
        style={{ x: mx, y: my, width: mw, height: mh, rx: mr, fill: mc, opacity: mo }}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={1.5}
      />

      {/* Lenses, flash, sensor */}
      <Lens {...l0} />
      <Lens {...l1} />
      <Lens {...l2} />
      <motion.g style={{ x: flX, y: flY, opacity: flO }}>
        <motion.circle style={{ r: flR }} fill="url(#flash-grad)" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      </motion.g>
      <motion.g style={{ x: snX, y: snY, opacity: snO }}>
        <motion.circle style={{ r: snR }} fill="#101318" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      </motion.g>

      {/* Apple logo (inner offset centers the 24×24 path on its origin) */}
      <motion.g style={{ x: cx, y: logoY, scale: logoS }}>
        <g transform="translate(-12, -12.6)">
          <motion.path d={APPLE_PATH} style={{ fill: logoC }} />
        </g>
      </motion.g>

      {/* "iPhone" wordmark (retired in 2019) */}
      <motion.text
        className="phone-wordmark"
        style={{ x: cx, y: wordY, opacity: wordO, fill: wordC }}
        textAnchor="middle"
      >
        iPhone
      </motion.text>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Front view: bezels shrink, earpiece + home button dissolve, the notch
   grows out of the top edge and later detaches into the Dynamic Island. */
/* ------------------------------------------------------------------ */

function FrontView({ progress }: { progress: MV }) {
  const cx = FRONT_CX;
  const { bw, bh, bx, by, br } = useBody(progress, cx);
  const faceC = useCol(progress, (p) => p.front.face);
  const frameC = useCol(progress, (p) => p.front.frame.color);
  const frameW = useNum(progress, (p) => p.front.frame.w);

  /* Screen */
  const screenW = (p: PhoneSpec) => p.front.screen.wF * p.body.w;
  const sx = useNum(progress, (p) => cx - screenW(p) / 2);
  const sy = useNum(progress, (p) => bodyTop(p) + p.front.screen.yF * p.body.h);
  const sw = useNum(progress, (p) => screenW(p));
  const sh = useNum(progress, (p) => p.front.screen.hF * p.body.h);
  const sr = useNum(progress, (p) => p.front.screen.r);
  const tint = useCol(progress, (p) => p.accentSoft);

  /* Notch → Dynamic Island. Attached notches (y < 0) bleed above the screen
     into the black bezel; visH is the part visible on the screen itself. */
  const notchW = (p: PhoneSpec) => p.front.notch.wF * screenW(p);
  const visH = (p: PhoneSpec) => p.front.notch.h + Math.min(p.front.notch.y, 0);
  const visTop = (p: PhoneSpec) =>
    bodyTop(p) + p.front.screen.yF * p.body.h + Math.max(p.front.notch.y, 0);
  const nx = useNum(progress, (p) => cx - notchW(p) / 2);
  const ny = useNum(progress, (p) => bodyTop(p) + p.front.screen.yF * p.body.h + p.front.notch.y);
  const nw = useNum(progress, (p) => notchW(p));
  const nh = useNum(progress, (p) => p.front.notch.h);
  const nr = useNum(progress, (p) => p.front.notch.r);
  const no = useNum(progress, (p) => p.front.notch.o);
  const dotX = useNum(progress, (p) => cx + notchW(p) / 2 - visH(p) / 2 - 4);
  const dotY = useNum(progress, (p) => visTop(p) + visH(p) / 2);
  const dotR = useNum(progress, (p) => visH(p) * 0.17);

  /* Earpiece + selfie camera (pre-2017, above the screen) */
  const earY = useNum(progress, (p) => bodyTop(p) + (p.front.screen.yF * p.body.h) / 2 - 3.5);
  const earX = useNum(progress, (p) => cx - p.front.ear.w / 2);
  const earW = useNum(progress, (p) => p.front.ear.w);
  const earO = useNum(progress, (p) => p.front.ear.o);
  const fcX = useNum(progress, (p) => bodyLeftAt(p, cx) + p.front.fcam.xF * p.body.w);
  const fcY = useNum(progress, (p) => bodyTop(p) + (p.front.screen.yF * p.body.h) / 2);
  const fcO = useNum(progress, (p) => p.front.fcam.o);

  /* Home button (with the printed app-icon square of the early years) */
  const homeCy = useNum(
    progress,
    (p) => bodyTop(p) + (p.front.screen.yF + p.front.screen.hF + 1) * p.body.h * 0.5,
  );
  const homeR = useNum(progress, (p) => p.front.home.r);
  const homeO = useNum(progress, (p) => p.front.home.o);
  const sqS = useNum(progress, (p) => p.front.home.r * 1.1);
  const sqX = useNum(progress, (p) => cx - (p.front.home.r * 1.1) / 2);
  const sqY = useNum(
    progress,
    (p) =>
      bodyTop(p) +
      (p.front.screen.yF + p.front.screen.hF + 1) * p.body.h * 0.5 -
      (p.front.home.r * 1.1) / 2,
  );
  const sqO = useNum(progress, (p) => p.front.home.squareO);

  /* Buttons: front arrangement — volume left, power right / top-right */
  const btnC = useCol(progress, (p) => p.buttons.color);
  const pwX = useNum(progress, (p) => bodyLeftAt(p, cx) + p.power.x);
  const pwY = useNum(progress, (p) => bodyTop(p) + p.power.y);
  const pwW = useNum(progress, (p) => p.power.w);
  const pwH = useNum(progress, (p) => p.power.h);
  const volX = useNum(progress, (p) => bodyLeftAt(p, cx) - 7);
  const muteY = useNum(progress, (p) => bodyTop(p) + p.body.h * 0.155);
  const vol1Y = useNum(progress, (p) => bodyTop(p) + p.body.h * 0.225);
  const vol2Y = useNum(progress, (p) => bodyTop(p) + p.body.h * 0.315);
  const ccX = useNum(progress, (p) => bodyLeftAt(p, cx) + p.body.w);
  const ccY = useNum(progress, (p) => bodyTop(p) + p.body.h * p.camCtl.yF);
  const ccH = useNum(progress, (p) => p.camCtl.h);
  const ccO = useNum(progress, (p) => p.camCtl.o);

  return (
    <g>
      {/* Buttons */}
      <motion.rect style={{ x: pwX, y: pwY, width: pwW, height: pwH, fill: btnC }} rx={3.5} />
      <motion.rect style={{ x: volX, y: muteY, fill: btnC }} width={7} height={26} rx={3.5} />
      <motion.rect style={{ x: volX, y: vol1Y, fill: btnC }} width={7} height={46} rx={3.5} />
      <motion.rect style={{ x: volX, y: vol2Y, fill: btnC }} width={7} height={46} rx={3.5} />
      <motion.rect style={{ x: ccX, y: ccY, height: ccH, fill: btnC, opacity: ccO }} width={7} rx={3.5} />

      {/* Face + rim */}
      <motion.rect
        style={{ x: bx, y: by, width: bw, height: bh, rx: br, fill: faceC }}
        filter="url(#soft-shadow)"
      />
      <motion.rect
        style={{ x: bx, y: by, width: bw, height: bh, rx: br, stroke: frameC, strokeWidth: frameW }}
        fill="none"
      />

      {/* Screen: dark glass + era tint + diagonal sheen */}
      <motion.rect style={{ x: sx, y: sy, width: sw, height: sh, rx: sr }} fill="url(#screen-glass)" />
      <motion.rect style={{ x: sx, y: sy, width: sw, height: sh, rx: sr, fill: tint }} opacity={0.55} />
      <motion.rect style={{ x: sx, y: sy, width: sw, height: sh, rx: sr }} fill="url(#screen-sheen)" />

      {/* Notch / Dynamic Island (+ its camera dot) */}
      <motion.g style={{ opacity: no }}>
        <motion.rect style={{ x: nx, y: ny, width: nw, height: nh, rx: nr }} fill="#050608" />
        <motion.circle style={{ cx: dotX, cy: dotY, r: dotR }} fill="#131722" />
      </motion.g>

      {/* Earpiece + selfie camera */}
      <motion.rect
        style={{ x: earX, y: earY, width: earW, opacity: earO }}
        height={7}
        rx={3.5}
        fill="#08090b"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={1}
      />
      <motion.circle
        style={{ cx: fcX, cy: fcY, opacity: fcO }}
        r={4.5}
        fill="#10131a"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={1}
      />

      {/* Home button */}
      <motion.circle
        style={{ cy: homeCy, r: homeR, opacity: homeO }}
        cx={cx}
        fill="rgba(255,255,255,0.05)"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={2}
      />
      <motion.rect
        style={{ x: sqX, y: sqY, width: sqS, height: sqS, opacity: sqO }}
        rx={6}
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth={2}
      />
    </g>
  );
}

/* ------------------------------------------------------------------ */

export default function MorphingPhone({ progress }: { progress: MV }) {
  const reduceMotion = useReducedMotion();

  /* Whole-pair body language: tilt with scroll velocity, gentle float. */
  const velocity = useVelocity(progress);
  const tilt = useSpring(useTransform(velocity, [-0.25, 0.25], [2.2, -2.2]), {
    stiffness: 120,
    damping: 18,
  });

  return (
    <motion.div
      className="phone-wrap"
      style={{ rotate: reduceMotion ? 0 : tilt }}
      animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg
        className="phone-svg"
        viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`}
        role="img"
        aria-label="Front and back of an iPhone evolving across generations as you scroll"
      >
        <defs>
          <radialGradient id="lens-glass" cx="0.38" cy="0.36" r="0.75">
            <stop offset="0%" stopColor="#46587a" />
            <stop offset="55%" stopColor="#1b2740" />
            <stop offset="100%" stopColor="#0b1120" />
          </radialGradient>
          <radialGradient id="flash-grad" cx="0.4" cy="0.4" r="0.8">
            <stop offset="0%" stopColor="#fff3cf" />
            <stop offset="70%" stopColor="#e5b95d" />
            <stop offset="100%" stopColor="#b98a35" />
          </radialGradient>
          <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="34%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="screen-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#171a21" />
            <stop offset="50%" stopColor="#0d0f14" />
            <stop offset="100%" stopColor="#0a0c10" />
          </linearGradient>
          <linearGradient id="screen-sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.11)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="65%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id="soft-shadow" x="-40%" y="-25%" width="180%" height="160%">
            <feDropShadow dx="0" dy="26" stdDeviation="28" floodColor="#000000" floodOpacity="0.55" />
          </filter>
        </defs>

        <FrontView progress={progress} />
        <BackView progress={progress} />

        <text className="side-label" x={FRONT_CX} y={CANVAS.h - 8} textAnchor="middle">
          Front
        </text>
        <text className="side-label" x={BACK_CX} y={CANVAS.h - 8} textAnchor="middle">
          Back
        </text>
      </svg>
    </motion.div>
  );
}
