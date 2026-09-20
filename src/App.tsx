import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from "motion/react";
import {
  BRAND_LABELS,
  CATALOGUES,
  SOURCES_VERIFIED,
  type Brand,
  type View,
} from "./data/catalogue";
import { activeIndex, modelProgress } from "./lib/morph";
import type { PhoneSpec } from "./data/phones";

const PhoneScene = lazy(() => import("./components/PhoneScene"));
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.1 12.4c0-2 1.7-3 1.8-3.1-1-1.5-2.5-1.7-3.1-1.7-1.3-.1-2.6.8-3.3.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.2 2.8 2.2 1.1-.1 1.5-.7 2.9-.7s1.8.7 3 .7 2-1.1 2.7-2.1c.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.5-1-2.5-4zm-2.2-6.3c.6-.8 1.1-1.9 1-3.1-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.9-1.3z" />
    </svg>
  );
}
function Arrow({ direction = "right" }: { direction?: "right" | "left" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      style={direction === "left" ? { rotate: "180deg" } : undefined}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function MiniPhone({ phone }: { phone: PhoneSpec }) {
  const isFold = phone.fold?.axis === "book";
  return (
    <svg className="mini-phone" viewBox="0 0 38 48" aria-hidden="true">
      <rect
        x={isFold ? 4 : 10}
        y="3"
        width={isFold ? 30 : 18}
        height="38"
        rx={phone.body.r < 20 ? 2 : 4}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      {isFold ? (
        <path d="M19 4v36" stroke="currentColor" opacity=".5" />
      ) : (
        <path
          d={phone.year < 2017 ? "M12 10h14M12 33h14" : "M17 7h4"}
          stroke="currentColor"
          strokeLinecap="round"
        />
      )}
      {phone.fold?.axis === "flip" ? <path d="M11 22h16" stroke="currentColor" /> : null}
    </svg>
  );
}

export default function App() {
  const [brand, setBrand] = useState<Brand>(() =>
    new URLSearchParams(window.location.search).get("brand") === "samsung" ? "samsung" : "apple",
  );
  const [index, setIndex] = useState(0),
    [view, setView] = useState<View>("pair");
  const [foldStates, setFoldStates] = useState<Record<string, boolean>>({});
  const [rotation, setRotation] = useState(0),
    [playing, setPlaying] = useState(false);
  const [about, setAbout] = useState(false),
    [showModels, setShowModels] = useState(false);
  const reducedMotion = !!useReducedMotion();
  const phones = CATALOGUES[brand],
    phone = phones[Math.min(index, phones.length - 1)];
  const open = foldStates[phone.id] ?? phone.fold?.axis !== "flip";
  const journey = useRef<HTMLElement>(null),
    rail = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    modelsDialog = useRef<HTMLDialogElement>(null);
  const progress = useMotionValue(0),
    smooth = useSpring(progress, { stiffness: 105, damping: 28, mass: 0.36 });
  const animatedProgress = reducedMotion ? progress : smooth;
  useMotionValueEvent(animatedProgress, "change", (value) =>
    setIndex((previous) => {
      const next = activeIndex(value, phones.length);
      return previous === next ? previous : next;
    }),
  );
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    progress.jump(0);
    smooth.jump(0);
    setIndex(0);
    setFoldStates({});
    setPlaying(false);
    const url = new URL(window.location.href);
    if (brand === "samsung") url.searchParams.set("brand", brand);
    else url.searchParams.delete("brand");
    history.replaceState(null, "", url);
  }, [brand, progress, smooth]);
  useEffect(() => {
    let viewportHeight = window.innerHeight;
    const update = () => {
      if (!journey.current) return;
      const distance = journey.current.offsetHeight - window.innerHeight;
      // Keep the same chapter when the browser changes size or orientation.
      if (viewportHeight !== window.innerHeight) {
        viewportHeight = window.innerHeight;
        window.scrollTo({ top: progress.get() * distance, behavior: "instant" });
        return;
      }
      progress.set(Math.max(0, Math.min(1, window.scrollY / Math.max(1, distance))));
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [phones.length, progress]);
  const navigate = useCallback(
    (target: number, instant = false) => {
      setPlaying(false);
      if (!journey.current) return;
      const i = Math.max(0, Math.min(phones.length - 1, target));
      const distance = journey.current.offsetHeight - window.innerHeight;
      window.scrollTo({
        top: modelProgress(i, phones.length) * distance,
        behavior: reducedMotion || instant ? "instant" : "smooth",
      });
    },
    [phones.length, reducedMotion],
  );
  useEffect(() => {
    const selected = rail.current?.querySelector<HTMLElement>(`[data-index="${index}"]`),
      container = rail.current;
    if (selected && container)
      container.scrollTo({
        left:
          selected.offsetLeft -
          container.offsetLeft -
          container.clientWidth / 2 +
          selected.clientWidth / 2,
        behavior: reducedMotion ? "instant" : "smooth",
      });
  }, [index, reducedMotion]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        about ||
        showModels ||
        /INPUT|SELECT|TEXTAREA/.test((event.target as HTMLElement).tagName)
      )
        return;
      if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        navigate(
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? phones.length - 1
              : index + (event.key === "ArrowRight" ? 1 : -1),
        );
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [index, phones.length, navigate, about, showModels]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - previous, 60);
      previous = now;
      const distance = (journey.current?.offsetHeight ?? 0) - window.innerHeight;
      const next = window.scrollY + (dt * distance) / (phones.length * 3800);
      window.scrollTo({ top: next, behavior: "instant" });
      if (next >= distance) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const stop = () => setPlaying(false);
    frame = requestAnimationFrame(tick);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    };
  }, [playing, phones.length]);
  useEffect(() => {
    if (about) dialog.current?.showModal();
    else dialog.current?.close();
  }, [about]);
  useEffect(() => {
    if (showModels) modelsDialog.current?.showModal();
    else modelsDialog.current?.close();
  }, [showModels]);

  return (
    <>
      <a className="skip-link" href="#model-controls">
        Skip to model controls
      </a>
      <div
        className="ambient-light"
        style={{ "--accent": phone.accentSoft } as React.CSSProperties}
        aria-hidden="true"
      />
      <header className="site-header">
        <button
          className="brand"
          onClick={() => navigate(0)}
          aria-label="Shape — back to the beginning"
        >
          Shape.
        </button>
        <div className="brand-toggle" role="group" aria-label="Phone brand">
          <button aria-pressed={brand === "apple"} onClick={() => setBrand("apple")}>
            <AppleMark />
            Apple
          </button>
          <button aria-pressed={brand === "samsung"} onClick={() => setBrand("samsung")}>
            <span className="galaxy-symbol" aria-hidden="true">
              ✦
            </span>
            Samsung
          </button>
        </div>
        <button
          className="models-button"
          onClick={() => {
            setPlaying(false);
            setShowModels(true);
          }}
        >
          All models <span>＋</span>
        </button>
      </header>
      <main ref={journey} className="journey" style={{ height: `${phones.length * 105}svh` }}>
        <div className="stage">
          <section className="model-heading" aria-live="polite" aria-atomic="true">
            <motion.div
              key={phone.id}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.18 }}
            >
              <h1>{phone.name}</h1>
              <p>
                {phone.year}
                <span>·</span>
                {phone.finish}
              </p>
              {phone.availability ? <small>Available October 23</small> : null}
            </motion.div>
          </section>
          <section className="product-stage" aria-label="Interactive phone gallery">
            <Suspense
              fallback={
                <div className="scene-loader">
                  <span />
                  Preparing the archive…
                </div>
              }
            >
              <PhoneScene
                phones={phones}
                phone={phone}
                progress={animatedProgress}
                view={view}
                open={open}
                foldStates={foldStates}
                rotation={rotation}
                reducedMotion={reducedMotion}
              />
            </Suspense>
            <div className="viewer-controls" id="model-controls">
              <div className="view-switch" role="group" aria-label="Device view">
                {(
                  [
                    ["pair", "Both sides"],
                    ["front", "Front"],
                    ["back", "Back"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={view === value}
                    onClick={() => {
                      setView(value);
                      setRotation(0);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="rotate-button"
                aria-label="Rotate phones by 90 degrees"
                title="Rotate 90°"
                onClick={() => setRotation((n) => n + 1)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                >
                  <path d="M19.5 9A8 8 0 1 0 20 15M20 4v6h-6" />
                </svg>
              </button>
              {phone.fold ? (
                <button
                  className="fold-button"
                  aria-pressed={open}
                  onClick={() => {
                    setFoldStates((states) => ({ ...states, [phone.id]: !open }));
                    if (view === "back") setView("front");
                  }}
                >
                  {open ? "Fold" : "Unfold"}
                  <span aria-hidden="true">{open ? "↤↦" : "↔"}</span>
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </main>
      <footer className="timeline-shell">
        <button
          className="step-button"
          disabled={index === 0}
          onClick={() => navigate(index - 1)}
          aria-label="Previous phone"
        >
          <Arrow direction="left" />
        </button>
        <span className="timeline-year">{phones[0].year}</span>
        <nav aria-label={`${BRAND_LABELS[brand]} timeline`} className="timeline-nav">
          <div className="timeline-track" ref={rail}>
            {phones.map((p, i) => (
              <button
                key={p.id}
                data-index={i}
                className={`timeline-stop ${i === index ? "is-active" : ""}`}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Jump to ${p.name} · ${p.year}`}
                onClick={() => navigate(i)}
                title={`${p.name} · ${p.year}`}
              >
                <span className="stop-marker" />
                <span className="stop-tooltip">{p.name}</span>
              </button>
            ))}
          </div>
        </nav>
        <span className="timeline-year">2026</span>
        <button
          className="step-button"
          disabled={index === phones.length - 1}
          onClick={() => navigate(index + 1)}
          aria-label="Next phone"
        >
          <Arrow />
        </button>
        <button
          className="play-button"
          aria-label={playing ? "Pause journey" : "Play journey"}
          aria-pressed={playing}
          onClick={() => {
            if (index === phones.length - 1 && !playing) navigate(0, true);
            setPlaying(!playing);
          }}
        >
          {playing ? (
            <span className="pause-icon" />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m9 5 11 7-11 7z" />
            </svg>
          )}
        </button>
      </footer>
      <dialog
        className="archive-dialog"
        ref={dialog}
        onCancel={() => setAbout(false)}
        onClose={() => setAbout(false)}
        aria-labelledby="about-title"
      >
        <button
          className="dialog-close"
          aria-label="Close about the archive"
          onClick={() => setAbout(false)}
        >
          ×
        </button>
        <p className="eyebrow">SHAPE · THE PHONE DESIGN ARCHIVE</p>
        <h2 id="about-title">
          Small objects.
          <br />
          Remarkable stories.
        </h2>
        <p>
          An independent, interactive study of the devices that changed how we live. Scroll through
          selected design milestones, switch between Apple and Samsung, or take a closer look at
          either side.
        </p>
        <p>
          Use the timeline or your left and right arrow keys to move between models. Drag a phone to
          rotate it. On folding models, use Fold and Unfold to explore the hinge.
        </p>
        <p className="source-note">
          The 3D models and wallpapers are original, simplified reconstructions. Product names and
          specifications follow manufacturer sources, checked {SOURCES_VERIFIED}. iPhone Duo is
          announced, with availability from October 23, 2026.
        </p>
        <div className="source-links">
          <a href="https://www.apple.com/iphone/" target="_blank" rel="noreferrer">
            Apple lineup ↗
          </a>
          <a href="https://www.apple.com/iphone-duo/specs/" target="_blank" rel="noreferrer">
            iPhone Duo ↗
          </a>
          <a
            href="https://news.samsung.com/global/samsung-galaxy-z-fold8-ultra-fold8-and-flip8foldables-perfected-for-every-way-of-living"
            target="_blank"
            rel="noreferrer"
          >
            Samsung foldables ↗
          </a>
          <a href={phone.source} target="_blank" rel="noreferrer">
            Current model source ↗
          </a>
        </div>
        <p className="source-note">
          Unaffiliated with Apple or Samsung. All product names belong to their respective owners.
        </p>
      </dialog>
      <dialog
        className="archive-dialog models-dialog"
        ref={modelsDialog}
        onCancel={() => setShowModels(false)}
        onClose={() => setShowModels(false)}
        aria-labelledby="models-title"
      >
        <button
          className="dialog-close"
          aria-label="Close all models"
          onClick={() => setShowModels(false)}
        >
          ×
        </button>
        <p className="eyebrow">CHOOSE A CHAPTER</p>
        <h2 id="models-title">The {BRAND_LABELS[brand]} archive.</h2>
        <div className="model-grid">
          {phones.map((p, i) => (
            <button
              key={p.id}
              className={i === index ? "selected" : ""}
              onClick={() => {
                setShowModels(false);
                navigate(i);
              }}
            >
              <MiniPhone phone={p} />
              <span>
                <strong>{p.name}</strong>
                <small>
                  {p.year}
                  {p.fold ? " · Foldable" : ""}
                  {p.availability ? " · Announced" : ""}
                </small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <button
          className="about-link"
          onClick={() => {
            setShowModels(false);
            setAbout(true);
          }}
        >
          About this project ↗
        </button>
      </dialog>
    </>
  );
}
