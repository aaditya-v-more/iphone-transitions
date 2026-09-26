import { useEffect, useRef, useState } from "react";
import type { MotionValue } from "motion/react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  PhoneModel,
  bindEnvironment,
  coverWallpaper,
  disposeScene,
  wallpaper,
} from "../lib/phone3d";
import { defaultFoldOpen, foldChoreography, sampleJourney } from "../lib/morph";
import { PhoneLayout } from "../lib/phone-layout";
import { bindPhoneDrag } from "../lib/phone-drag";
import type { PhoneSpec } from "../data/phones";
import type { View } from "../data/catalogue";

interface Props {
  phones: PhoneSpec[];
  phone: PhoneSpec;
  progress: MotionValue<number>;
  view: View;
  open: boolean;
  foldStates: Readonly<Record<string, boolean>>;
  reducedMotion: boolean;
  rotation: number;
}

export default function PhoneScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false),
    [fallback, setFallback] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.05, 16);
    const environment = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(environment, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.65;
    environment.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xe8efff, 0x323038, 0.65));
    const key = new THREE.DirectionalLight(0xfff0df, 1.8);
    key.position.set(-4, 7, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8e4ff, 1.3);
    fill.position.set(5, 2, -5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.75);
    rim.position.set(1, -4, 4);
    scene.add(rim);
    const front = new PhoneModel(),
      back = new PhoneModel();
    scene.add(front.root, back.root);
    const layout = new PhoneLayout(front.root, back.root);
    bindEnvironment(scene, envTarget.texture);
    const textures = new Map<string, THREE.Texture>();
    const getTexture = (p: PhoneSpec) => {
      if (!textures.has(p.id)) {
        const cover = wallpaper(p);
        textures.set(p.id, cover);
        if (p.fold?.axis === "book") {
          const inner = wallpaper(p, true);
          textures.set(p.id + ":inner", inner);
          cover.userData.inner = inner;
        }
        if (p.fold?.axis === "flip") {
          const outer = coverWallpaper(p);
          textures.set(p.id + ":cover", outer);
          cover.userData.cover = outer;
        }
      }
      return textures.get(p.id)!;
    };
    let aspect = 1,
      alive = true,
      visible = !document.hidden,
      raf = 0;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      aspect = width / height;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let pointerX = 0,
      pointerY = 0,
      dragAngle = 0,
      angle = 0;
    let focusFront = 1,
      focusBack = 1,
      previous = performance.now(),
      lastProgress = -1;
    let lastView: View = "pair",
      lastCatalogue = latest.current.phones,
      switchTime = 1;
    let switchFrom: PhoneSpec | null = null,
      previousSpec = latest.current.phones[0],
      lastRotation = 0;
    let previousHinge = defaultFoldOpen(previousSpec),
      switchFromOpen = previousHinge;
    const hingeValues = new Map<string, number>();
    const unbindDrag = bindPhoneDrag(element,
      (pixels) => { dragAngle += pixels * 0.008; },
      (x, y) => { pointerX = x; pointerY = y; });
    const contextLost = (event: Event) => {
      event.preventDefault();
      setFallback(true);
      alive = false;
      cancelAnimationFrame(raf);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    const frame = (time: number) => {
      if (!alive || !visible) return;
      const dt = Math.min((time - previous) / 1000, 0.05);
      previous = time;
      const current = latest.current,
        damp = current.reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
      if (current.phones !== lastCatalogue) {
        switchFrom = previousSpec;
        switchFromOpen = previousHinge;
        switchTime = 0;
        lastCatalogue = current.phones;
        dragAngle = 0;
      }
      const sample = sampleJourney(current.progress.get(), current.phones);
      let a = sample.from,
        b = sample.to,
        mix = sample.mix;
      if (switchFrom && switchTime < 1) {
        switchTime = Math.min(1, switchTime + dt / 0.65);
        a = switchFrom;
        b = sample.mix < 0.5 ? sample.from : sample.to;
        mix = current.reducedMotion ? 1 : switchTime * switchTime * (3 - 2 * switchTime);
      }
      if (current.view !== lastView || Math.abs(current.progress.get() - lastProgress) > 0.007)
        dragAngle = 0;
      if (current.rotation !== lastRotation) {
        dragAngle =
          current.rotation === 0
            ? 0
            : dragAngle + ((current.rotation - lastRotation) * Math.PI) / 2;
        lastRotation = current.rotation;
      }
      lastView = current.view;
      lastProgress = current.progress.get();
      angle += (dragAngle - angle) * damp;
      const openFor = (spec: PhoneSpec) => {
        const target = Number(current.foldStates[spec.id] ?? defaultFoldOpen(spec));
        const previousOpen = hingeValues.get(spec.id) ?? target;
        const value = previousOpen + (target - previousOpen) * damp;
        hingeValues.set(spec.id, value);
        return value;
      };
      focusFront += ((current.view === "back" ? 0 : 1) - focusFront) * damp;
      focusBack += ((current.view === "front" ? 0 : 1) - focusBack) * damp;
      const textureA = getTexture(a),
        textureB = getTexture(b);
      const fromOpen = switchFrom && switchTime < 1 ? switchFromOpen : openFor(a);
      const toOpen = a.id === b.id ? fromOpen : openFor(b);
      const { shapeMix, hingeOpen } = foldChoreography(a, b, mix, fromOpen, toOpen);
      previousSpec = shapeMix < 0.5 ? a : b;
      previousHinge = hingeOpen;
      front.update(a, b, shapeMix, textureA, textureB, hingeOpen, true);
      back.update(a, b, shapeMix, textureA, textureB, hingeOpen, true);
      const float = current.reducedMotion ? 0 : Math.sin(time / 2600) * 0.026;
      const hoverX = current.reducedMotion ? 0 : pointerX * 0.12,
        hoverY = current.reducedMotion ? 0 : pointerY * 0.08;
      layout.update(angle, hoverX, hoverY, focusFront, focusBack, float);
      layout.fitCamera(camera, damp);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    const visibility = () => {
      visible = !document.hidden;
      cancelAnimationFrame(raf);
      if (visible && alive) {
        previous = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    raf = requestAnimationFrame(frame);
    setReady(true);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      unbindDrag();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      disposeScene(scene);
      textures.forEach((texture) => texture.dispose());
      envTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="device-viewer" data-renderer={fallback ? "svg" : ready ? "webgl" : "loading"}>
      <div
        ref={host}
        className={`scene-canvas ${fallback ? "scene-hidden" : ""}`}
        role="img"
        aria-label={`${props.phone.name}, ${props.view === "pair" ? "front and back" : props.view} view${props.phone.fold ? (props.open ? ", unfolded" : ", folded") : ""}`}
      />
      {!ready && !fallback ? (
        <div className="scene-loader">
          <span />
          Setting the light…
        </div>
      ) : null}
      {fallback ? <DeviceFallback phone={props.phone} view={props.view} open={props.open} /> : null}
      <span className="viewer-help">
        {fallback
          ? "Device illustration · 3D unavailable on this browser"
          : "Swipe or drag sideways to rotate"}
      </span>
    </div>
  );
}

function DeviceFallback({ phone: p, view, open }: { phone: PhoneSpec; view: View; open: boolean }) {
  const w = p.fold?.axis === "book" && open ? p.fold.openWidth : p.body.w;
  const h = p.fold?.axis === "flip" && !open ? p.body.h / 2 : p.body.h;
  const screenWidth = p.fold ? w - 20 : w * p.front.screen.wF;
  const screenHeight = p.fold ? h - 24 : h * p.front.screen.hF;
  const screenX = (w - screenWidth) / 2;
  const screenY = p.fold ? 12 : h * p.front.screen.yF;
  const homeY = screenY + screenHeight + (h - screenY - screenHeight) / 2;
  return (
    <svg
      className="device-fallback"
      viewBox="0 0 1000 780"
      role="img"
      aria-label={`${p.name} device illustration`}
    >
      <defs>
        <linearGradient id="fallback-screen" x2="1" y2="1">
          <stop stopColor="#101726" />
          <stop offset=".55" stopColor={p.accent} />
          <stop offset="1" stopColor="#142332" />
        </linearGradient>
        <clipPath id="fallback-body">
          <rect width={w} height={h} rx={p.body.r} />
        </clipPath>
      </defs>
      {(view === "pair" ? ["front", "back"] : [view]).map((side, i) => {
        const width = w,
          scale = Math.min(1, 420 / width);
        return (
          <g
            key={side}
            transform={`translate(${view === "pair" ? 255 + i * 490 : 500} 390) scale(${scale}) translate(${-width / 2} ${-h / 2})`}
          >
            <rect
              width={width}
              height={h}
              rx={p.body.r}
              fill={side === "front" ? "#090b10" : p.body.color}
              stroke={p.band.color}
              strokeWidth={p.front.frame.w}
            />
            {side === "front" ? (
              <>
                <rect
                  x={screenX}
                  y={screenY}
                  width={screenWidth}
                  height={screenHeight}
                  rx={p.fold ? Math.max(10, p.body.r - 10) : p.front.screen.r}
                  fill="url(#fallback-screen)"
                />
                <text x={width / 2} y={screenY + screenHeight * 0.2} textAnchor="middle" fill="white" fontSize={Math.min(50, screenWidth * 0.18)}>
                  9:41
                </text>
                {!p.fold && p.front.home.o > 0 && (
                  <g opacity={p.front.home.o}>
                    {p.brand === "samsung" ? (
                      <rect x={width / 2 - p.front.home.r * 1.35} y={homeY - p.front.home.r * 0.55}
                        width={p.front.home.r * 2.7} height={p.front.home.r * 1.1} rx="7"
                        fill="#16181b" stroke="#474b50" strokeWidth="1.5" />
                    ) : (
                      <circle cx={width / 2} cy={homeY} r={p.front.home.r} fill="#16181b" stroke="#474b50" strokeWidth="1.5" />
                    )}
                    {p.front.home.squareO > 0 && (
                      <rect x={width / 2 - p.front.home.r * 0.36} y={homeY - p.front.home.r * 0.36}
                        width={p.front.home.r * 0.72} height={p.front.home.r * 0.72} rx="3"
                        fill="none" stroke="#b9bec4" strokeWidth="1.5" opacity={p.front.home.squareO} />
                    )}
                  </g>
                )}
                {!p.fold && p.front.ear.o > 0 && (
                  <rect x={(width - p.front.ear.w) / 2} y={screenY / 2 - 3}
                    width={p.front.ear.w} height="6" rx="3" fill="#44474c" opacity={p.front.ear.o} />
                )}
                {!p.fold && p.front.notch.o > 0 && (
                  <rect x={width / 2 + screenWidth * (p.front.notch.xF ?? 0) - screenWidth * p.front.notch.wF / 2}
                    y={screenY + p.front.notch.y} width={screenWidth * p.front.notch.wF}
                    height={p.front.notch.h} rx={p.front.notch.r} fill="#030405" opacity={p.front.notch.o} />
                )}
                {!p.fold && p.front.fcam.o > 0 && (
                  <circle cx={width * p.front.fcam.xF} cy={p.front.fcam.yF === undefined ? screenY / 2 : h * p.front.fcam.yF}
                    r="4" fill="#172a43" opacity={p.front.fcam.o} />
                )}
                {p.fold && open ? (
                  <path
                    d={
                      p.fold.axis === "book"
                        ? `M${width / 2} 10V${h - 10}`
                        : `M10 ${h / 2}H${width - 10}`
                    }
                    stroke="#333"
                    opacity=".5"
                  />
                ) : null}
              </>
            ) : (
              <>
                {!p.fold && (
                  <g clipPath="url(#fallback-body)">
                    <rect width={width} height={h * p.topStrip.hFrac} fill={p.topStrip.color} opacity={p.topStrip.o} />
                    <rect y={h * (1 - p.bottomStrip.hFrac)} width={width} height={h * p.bottomStrip.hFrac}
                      fill={p.bottomStrip.color} opacity={p.bottomStrip.o} />
                  </g>
                )}
                <rect
                  x={p.module.x}
                  y={p.module.y}
                  width={p.module.w}
                  height={p.module.h}
                  rx={p.module.r}
                  fill={p.module.color}
                  opacity={p.module.o}
                />
                {[...p.lenses, p.extraLens].filter(Boolean).map(
                  (l, n) =>
                    l && (
                      <g key={n} opacity={l.o}>
                        <circle
                          cx={l.x}
                          cy={l.y}
                          r={l.r}
                          fill="#111620"
                          stroke="#9aa0ab"
                          strokeWidth="3"
                        />
                        <circle cx={l.x} cy={l.y} r={l.r * 0.55} fill="#172a43" />
                        <circle
                          cx={l.x - l.r * 0.2}
                          cy={l.y - l.r * 0.2}
                          r={l.r * 0.15}
                          fill="#72829f"
                        />
                      </g>
                    ),
                )}
                <text
                  x={width / 2}
                  y={h * 0.6}
                  textAnchor="middle"
                  fill={p.logo.color}
                  fontSize="20"
                >
                  {p.brand === "samsung" ? "SAMSUNG" : "iPhone"}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
