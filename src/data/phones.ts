/**
 * Every iPhone is described by the same set of "slots" — body, camera module,
 * three lens slots, flash, sensor, logo, buttons on the back; screen, notch /
 * Dynamic Island, home button, earpiece on the front. The morphing pair
 * interpolates every numeric/color property between consecutive specs, so a
 * lens that "appears" in a later model grows out of the main lens, the camera
 * module stretches into the iPhone 17 plateau, the notch detaches from the
 * screen edge and floats off as the island, the home button dissolves in
 * 2017 — all driven by scroll.
 *
 * Geometry is in canvas px at 4.2 px/mm of real hardware, relative to the
 * body's top-left corner (or as a fraction of body/screen size where marked
 * `F`). The catalogue applies source-linked body and display measurements
 * from the manufacturer reference files. These base drawings supply the
 * artwork: corner radii, optical details and exact bezel widths are photo
 * estimates, not manufacturer CAD measurements.
 */

export const CANVAS = { w: 900, h: 780, cy: 390 };
export const FRONT_CX = 220; // front-view phone center
export const BACK_CX = 680; // back-view phone center

export interface LensSlot {
  x: number; // center x, relative to body left
  y: number; // center y, relative to body top
  r: number;
  o: number; // opacity
}

export interface DisplayRectangle {
  w: number; // full active rectangle in model pixels, before corner/camera cutouts
  h: number;
  r: number; // corner radius remains a photographic approximation
}

export interface PhoneSpec {
  id: string;
  name: string;
  year: number;
  tagline: string;
  delta: string; // the design shift to watch during the morph into this model
  specline: string;
  accent: string; // era accent (hex, used for static UI bits)
  accentSoft: string; // rgba, used for the animated backdrop glow + screen tint
  brand?: "apple" | "samsung";
  finish?: string;
  material?: string;
  display?: string;
  thickness?: number; // millimeters
  source?: string;
  availability?: string;
  fold?: {
    axis: "book" | "flip";
    openWidth: number;
    openHeight: number;
    closedWidth?: number;
    closedHeight?: number;
    closedThickness?: number; // millimeters, glass-to-glass, excluding camera bump
    innerScreen?: DisplayRectangle;
    coverScreen?: DisplayRectangle;
  };
  sensorShape?: "optical" | "flat" | "fingerprint";
  sideKeys?: { side: number; yF: number; h: number; o: number }[];
  extraLens?: LensSlot;
  body: { w: number; h: number; r: number; color: string; curve: number }; // curve 0..1 = how barrel-curved the back is (3GS plastic ≈ 1, flat glass slab ≈ 0.1)
  band: { w: number; color: string }; // steel/titanium rim stroke (0 = none)
  bottomStrip: { hFrac: number; color: string; o: number }; // iPhone 1 plastic / iPhone 5 glass
  topStrip: { hFrac: number; color: string; o: number }; // iPhone 5 glass
  antenna: { o: number; color: string }; // iPhone 6 / 7 Plus lines
  module: { x: number; y: number; w: number; h: number; r: number; color: string; o: number };
  lenses: [LensSlot, LensSlot, LensSlot]; // main, second, third
  flash: LensSlot;
  sensor: LensSlot; // LiDAR-ish dot on the Pros
  logo: { yFrac: number; scale: number; color: string };
  wordmark: { o: number; color: string };
  buttons: { color: string };
  power: { x: number; y: number; w: number; h: number }; // relative to body top-left
  mute: { h: number }; // ring/silent switch; shrinks into the Action button in 2023
  camCtl: { yF: number; h: number; o: number }; // Camera Control (2024+), right edge
  front: {
    face: string; // front glass color
    frame: { color: string; w: number }; // full rim stroke in model pixels; WebGL insets the glass by half per side
    screen: { wF: number; yF: number; hF: number; r: number };
    notch: { wF: number; h: number; r: number; y: number; o: number; xF?: number }; // wF of screen width; xF offset from center; y = gap below screen top
    home: { r: number; o: number; squareO: number }; // 10.9 mm on every real model → r 23; squareO = printed app-icon square (2007–2012)
    ear: { w: number; o: number }; // earpiece slit, centered in the top bezel
    fcam: { xF: number; yF?: number; o: number }; // yF measured from body top; defaults to earpiece row
  };
}

/** Convenience: a slot hidden inside another slot (so it morphs out of it). */
const hiddenAt = (s: { x: number; y: number; r: number }): LensSlot => ({
  x: s.x,
  y: s.y,
  r: s.r * 0.7,
  o: 0,
});

/* Attached notches use y < 0: the rect extends up into the black bezel so its
   visible top edge is flush with the screen. Islands float with y > 0. */
const NOTCH_OFF = { wF: 0.4, h: 30, r: 12, y: -13, o: 0 };
const NOTCH_X = { wF: 0.555, h: 35, r: 11, y: -13, o: 1 }; // 34.8 mm wide, 5.3 mm deep
const ISLAND = { wF: 0.31, h: 25, r: 12.5, y: 10, o: 1 };
const EAR_OFF = { w: 30, o: 0 };
const FCAM_OFF = { xF: 0.38, o: 0 };
const HOME_OFF = { r: 12, o: 0, squareO: 0 };
const MUTE_SWITCH = { h: 26 };
const ACTION_BTN = { h: 18 };
const CAMCTL_OFF = { yF: 0.64, h: 44, o: 0 };
const CAMCTL_ON = { yF: 0.64, h: 44, o: 1 };

/* ------------------------------------------------------------------ */

const l1_2007 = { x: 40, y: 40, r: 13 };
const l1_3gs = { x: 38, y: 38, r: 11 };
const l1_4 = { x: 34, y: 32, r: 13 };
const l1_5 = { x: 32, y: 34, r: 13 };
const l1_6 = { x: 38, y: 40, r: 14 };

export const PHONES: PhoneSpec[] = [
  {
    /* 115 × 61 mm · 3.5″ 3:2 · lower cap proportion matched to Apple's identification photo */
    id: "iphone",
    name: "iPhone",
    year: 2007,
    tagline: "It all started here.",
    delta: "Rounded aluminum. One camera. One Home button.",
    specline: "3.5″ · 2 MP · OS X",
    accent: "#9aa3ad",
    accentSoft: "rgba(154, 163, 173, 0.16)",
    body: { w: 256, h: 483, r: 42, color: "#b9bec4", curve: 0.55 },
    band: { w: 0, color: "#b9bec4" },
    bottomStrip: { hFrac: 0.20, color: "#17181b", o: 1 },
    topStrip: { hFrac: 0.16, color: "#b9bec4", o: 0 },
    antenna: { o: 0, color: "#b9bec4" },
    module: { x: 12, y: 12, w: 66, h: 66, r: 33, color: "#b9bec4", o: 0 },
    lenses: [{ ...l1_2007, o: 1 }, hiddenAt(l1_2007), hiddenAt(l1_2007)],
    flash: hiddenAt({ x: 40, y: 40, r: 8 }),
    sensor: hiddenAt({ x: 40, y: 40, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.1, color: "#7d8289" },
    wordmark: { o: 1, color: "#6f747c" },
    buttons: { color: "#969ba2" },
    power: { x: 256 - 82, y: -7, w: 48, h: 7 },
    mute: MUTE_SWITCH,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0f1013",
      frame: { color: "#c9ccd1", w: 9 },
      screen: { wF: 0.808, yF: 0.168, hF: 0.643, r: 3 },
      notch: NOTCH_OFF,
      home: { r: 23, o: 1, squareO: 1 },
      ear: { w: 40, o: 1 },
      fcam: FCAM_OFF,
    },
  },
  {
    /* 115.5 × 62.1 mm · same 3.5″ panel · deeply curved acrylic back */
    id: "iphone-3gs",
    name: "iPhone 3GS",
    year: 2009,
    tagline: "Twice as fast, in glossy plastic.",
    delta: "The aluminum melts into curved black plastic.",
    specline: "3.5″ · 3 MP · Video",
    accent: "#79828f",
    accentSoft: "rgba(121, 130, 143, 0.16)",
    body: { w: 261, h: 485, r: 50, color: "#1f2126", curve: 1 },
    band: { w: 0, color: "#1f2126" },
    bottomStrip: { hFrac: 0.235, color: "#1f2126", o: 0 },
    topStrip: { hFrac: 0.16, color: "#1f2126", o: 0 },
    antenna: { o: 0, color: "#1f2126" },
    module: { x: 12, y: 12, w: 66, h: 66, r: 33, color: "#1f2126", o: 0 },
    lenses: [{ ...l1_3gs, o: 1 }, hiddenAt(l1_3gs), hiddenAt(l1_3gs)],
    flash: hiddenAt({ x: 38, y: 38, r: 8 }),
    sensor: hiddenAt({ x: 38, y: 38, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.1, color: "#c9cdd3" },
    wordmark: { o: 1, color: "#b7bcc4" },
    buttons: { color: "#33363c" },
    power: { x: 261 - 82, y: -7, w: 48, h: 7 },
    mute: MUTE_SWITCH,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0d0e10",
      frame: { color: "#c3c8cf", w: 7 },
      screen: { wF: 0.794, yF: 0.168, hF: 0.641, r: 3 },
      notch: NOTCH_OFF,
      home: { r: 23, o: 1, squareO: 1 },
      ear: { w: 40, o: 1 },
      fcam: FCAM_OFF,
    },
  },
  {
    /* 115.2 × 58.6 mm · 3.5″ Retina, symmetric 20.6 mm bezels · steel band */
    id: "iphone-4",
    name: "iPhone 4",
    year: 2010,
    tagline: "Glass, steel, and the Retina display.",
    delta: "Flat glass, a steel band — a flash slides out beside the lens.",
    specline: "Retina · 5 MP · FaceTime",
    accent: "#aeb6c2",
    accentSoft: "rgba(174, 182, 194, 0.15)",
    body: { w: 246, h: 484, r: 34, color: "#121317", curve: 0.1 },
    band: { w: 7, color: "#8d939c" },
    bottomStrip: { hFrac: 0.235, color: "#121317", o: 0 },
    topStrip: { hFrac: 0.16, color: "#121317", o: 0 },
    antenna: { o: 0, color: "#121317" },
    module: { x: 12, y: 10, w: 70, h: 46, r: 23, color: "#121317", o: 0 },
    lenses: [{ ...l1_4, o: 1 }, hiddenAt(l1_4), hiddenAt(l1_4)],
    flash: { x: 68, y: 32, r: 6, o: 1 },
    sensor: hiddenAt({ x: 68, y: 32, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.1, color: "#a6acb5" },
    wordmark: { o: 1, color: "#989fa9" },
    buttons: { color: "#84898f" },
    power: { x: 246 - 78, y: -7, w: 44, h: 7 },
    mute: MUTE_SWITCH,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0b0c0f",
      frame: { color: "#8d939c", w: 7 },
      screen: { wF: 0.841, yF: 0.179, hF: 0.642, r: 3 },
      notch: NOTCH_OFF,
      home: { r: 23, o: 1, squareO: 1 },
      ear: { w: 38, o: 1 },
      fcam: { xF: 0.4, o: 1 },
    },
  },
  {
    /* 123.8 × 58.6 mm · 4″ 16:9 (88.6 × 49.8 mm) · two-tone anodized back */
    id: "iphone-5",
    name: "iPhone 5",
    year: 2012,
    tagline: "Taller, thinner, aluminum.",
    delta: "The body stretches; glass windows split the back.",
    specline: "4″ · A6 · Lightning",
    accent: "#8b93a1",
    accentSoft: "rgba(139, 147, 161, 0.15)",
    body: { w: 246, h: 520, r: 34, color: "#3f434b", curve: 0.15 },
    band: { w: 0, color: "#3f434b" },
    bottomStrip: { hFrac: 0.16, color: "#282b31", o: 1 },
    topStrip: { hFrac: 0.16, color: "#282b31", o: 1 },
    antenna: { o: 0, color: "#3f434b" },
    module: { x: 10, y: 12, w: 70, h: 46, r: 23, color: "#3f434b", o: 0 },
    lenses: [{ ...l1_5, o: 1 }, hiddenAt(l1_5), hiddenAt(l1_5)],
    flash: { x: 64, y: 34, r: 6, o: 1 },
    sensor: hiddenAt({ x: 64, y: 34, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.2, color: "#b4bac2" },
    wordmark: { o: 1, color: "#a4aab3" },
    buttons: { color: "#54585f" },
    power: { x: 246 - 78, y: -7, w: 44, h: 7 },
    mute: MUTE_SWITCH,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0b0c0e",
      frame: { color: "#4a4e56", w: 5 },
      screen: { wF: 0.85, yF: 0.142, hF: 0.716, r: 3 },
      notch: NOTCH_OFF,
      home: { r: 23, o: 1, squareO: 1 },
      ear: { w: 38, o: 1 },
      fcam: { xF: 0.5, yF: 0.039, o: 1 },
    },
  },
  {
    /* 138.1 × 67 mm · 4.7″ 16:9 (104.1 × 58.6 mm) · Touch ID ring, no square */
    id: "iphone-6",
    name: "iPhone 6",
    year: 2014,
    tagline: "Bigger than bigger.",
    delta: "Corners soften; antenna lines streak the aluminum.",
    specline: "4.7″ · A8 · Apple Pay",
    accent: "#8e9098",
    accentSoft: "rgba(142, 144, 152, 0.15)",
    body: { w: 281, h: 580, r: 42, color: "#54575e", curve: 0.55 },
    band: { w: 0, color: "#54575e" },
    bottomStrip: { hFrac: 0.16, color: "#54575e", o: 0 },
    topStrip: { hFrac: 0.16, color: "#54575e", o: 0 },
    antenna: { o: 1, color: "#c7cad0" },
    module: { x: 14, y: 14, w: 72, h: 48, r: 24, color: "#54575e", o: 0 },
    lenses: [{ ...l1_6, o: 1 }, hiddenAt(l1_6), hiddenAt(l1_6)],
    flash: { x: 74, y: 40, r: 8, o: 1 },
    sensor: hiddenAt({ x: 74, y: 40, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.4, color: "#c3c6cc" },
    wordmark: { o: 1, color: "#b3b7be" },
    buttons: { color: "#6a6d74" },
    power: { x: 281 + 1, y: 0.24 * 580, w: 7, h: 62 },
    mute: MUTE_SWITCH,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0d0e11",
      frame: { color: "#5b5e65", w: 5 },
      screen: { wF: 0.874, yF: 0.123, hF: 0.754, r: 4 },
      notch: NOTCH_OFF,
      home: { r: 23, o: 1, squareO: 0 },
      ear: { w: 38, o: 1 },
      fcam: { xF: 0.4, o: 1 },
    },
  },
  {
    /* 158.2 × 77.9 mm · 5.5″ 16:9 (121.5 × 68.4 mm) · matte black, hidden antenna */
    id: "iphone-7-plus",
    name: "iPhone 7 Plus",
    year: 2016,
    tagline: "Two cameras. Portraits happen.",
    delta: "The lens splits in two.",
    specline: "5.5″ · Dual camera · Portrait",
    accent: "#5c6572",
    accentSoft: "rgba(92, 101, 114, 0.18)",
    body: { w: 327, h: 664, r: 46, color: "#232529", curve: 0.55 },
    band: { w: 0, color: "#232529" },
    bottomStrip: { hFrac: 0.16, color: "#232529", o: 0 },
    topStrip: { hFrac: 0.16, color: "#232529", o: 0 },
    antenna: { o: 1, color: "#3a3d43" },
    module: { x: 20, y: 24, w: 118, h: 48, r: 24, color: "#1a1c20", o: 1 },
    lenses: [
      { x: 44, y: 48, r: 16, o: 1 },
      { x: 90, y: 48, r: 16, o: 1 },
      hiddenAt({ x: 90, y: 48, r: 16 }),
    ],
    flash: { x: 154, y: 48, r: 9, o: 1 },
    sensor: hiddenAt({ x: 154, y: 48, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.7, color: "#babec5" },
    wordmark: { o: 1, color: "#a9adb5" },
    buttons: { color: "#393c42" },
    power: { x: 327 + 1, y: 0.24 * 664, w: 7, h: 66 },
    mute: MUTE_SWITCH,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0b0c0e",
      frame: { color: "#2c2e33", w: 5 },
      screen: { wF: 0.878, yF: 0.116, hF: 0.768, r: 4 },
      notch: NOTCH_OFF,
      home: { r: 23, o: 1, squareO: 0 },
      ear: { w: 42, o: 1 },
      fcam: { xF: 0.4, o: 1 },
    },
  },
  {
    /* 143.6 × 70.9 mm · 5.8″ OLED, 3.9 mm bezels · dark polished-steel band */
    id: "iphone-x",
    name: "iPhone X",
    year: 2017,
    tagline: "The future turns vertical.",
    delta: "The screen swallows the face; the home button dissolves.",
    specline: "5.8″ OLED · Face ID · No home button",
    accent: "#c0c6d1",
    accentSoft: "rgba(192, 198, 209, 0.14)",
    body: { w: 298, h: 603, r: 44, color: "#3b3e44", curve: 0.3 },
    band: { w: 7, color: "#7a8089" },
    bottomStrip: { hFrac: 0.16, color: "#3b3e44", o: 0 },
    topStrip: { hFrac: 0.16, color: "#3b3e44", o: 0 },
    antenna: { o: 0, color: "#3b3e44" },
    module: { x: 25, y: 25, w: 52, h: 124, r: 26, color: "#2e3136", o: 1 },
    lenses: [
      { x: 51, y: 53, r: 17, o: 1 },
      { x: 51, y: 121, r: 17, o: 1 },
      hiddenAt({ x: 51, y: 121, r: 17 }),
    ],
    flash: { x: 51, y: 87, r: 6, o: 1 },
    sensor: hiddenAt({ x: 51, y: 87, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.55, color: "#d3d6db" },
    wordmark: { o: 1, color: "#c0c4cb" },
    buttons: { color: "#5c6067" },
    power: { x: 298 + 1, y: 0.22 * 603, w: 7, h: 78 },
    mute: MUTE_SWITCH,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#07080b",
      frame: { color: "#7a8089", w: 6 },
      screen: { wF: 0.884, yF: 0.027, hF: 0.946, r: 30 },
      notch: NOTCH_X,
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    /* 144 × 71.4 mm · same 5.8″ panel · matte glass, steel band, corner module */
    id: "iphone-11-pro",
    name: "iPhone 11 Pro",
    year: 2019,
    tagline: "Three lenses, midnight green.",
    delta: "A third lens; the module becomes a square.",
    specline: "Triple camera · Night mode",
    accent: "#5d7a6b",
    accentSoft: "rgba(93, 122, 107, 0.18)",
    body: { w: 300, h: 605, r: 44, color: "#4e5851", curve: 0.3 },
    band: { w: 6, color: "#6d7a6a" },
    bottomStrip: { hFrac: 0.16, color: "#4e5851", o: 0 },
    topStrip: { hFrac: 0.16, color: "#4e5851", o: 0 },
    antenna: { o: 0, color: "#4e5851" },
    module: { x: 14, y: 14, w: 124, h: 124, r: 36, color: "#57635a", o: 1 },
    lenses: [
      { x: 52, y: 52, r: 20, o: 1 },
      { x: 52, y: 100, r: 20, o: 1 },
      { x: 100, y: 76, r: 20, o: 1 },
    ],
    flash: { x: 100, y: 38, r: 7, o: 1 },
    sensor: hiddenAt({ x: 100, y: 38, r: 6 }),
    logo: { yFrac: 0.5, scale: 2.6, color: "#ced3cf" },
    wordmark: { o: 0, color: "#ced3cf" },
    buttons: { color: "#5c6a60" },
    power: { x: 300 + 1, y: 0.22 * 605, w: 7, h: 78 },
    mute: MUTE_SWITCH,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#07080b",
      frame: { color: "#6d7a6a", w: 6 },
      screen: { wF: 0.878, yF: 0.028, hF: 0.943, r: 30 },
      notch: NOTCH_X,
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    /* 146.7 × 71.5 mm · 6.1″ OLED, 3.5 mm bezels · flat aluminum sides, navy Blue */
    id: "iphone-12",
    name: "iPhone 12",
    year: 2020,
    tagline: "Flat edges are back. In blue.",
    delta: "Edges snap flat again.",
    specline: "5G · MagSafe · Ceramic Shield",
    accent: "#4479ad",
    accentSoft: "rgba(68, 121, 173, 0.18)",
    body: { w: 300, h: 616, r: 38, color: "#2d5580", curve: 0.1 },
    band: { w: 5, color: "#45719c" },
    bottomStrip: { hFrac: 0.16, color: "#2d5580", o: 0 },
    topStrip: { hFrac: 0.16, color: "#2d5580", o: 0 },
    antenna: { o: 0, color: "#2d5580" },
    module: { x: 14, y: 14, w: 110, h: 110, r: 32, color: "#26496e", o: 1 },
    lenses: [
      { x: 50, y: 50, r: 18, o: 1 },
      { x: 50, y: 96, r: 18, o: 1 },
      hiddenAt({ x: 50, y: 96, r: 18 }),
    ],
    flash: { x: 94, y: 44, r: 7, o: 1 },
    sensor: hiddenAt({ x: 94, y: 44, r: 6 }),
    logo: { yFrac: 0.5, scale: 2.65, color: "#cfdae6" },
    wordmark: { o: 0, color: "#cfdae6" },
    buttons: { color: "#3a638c" },
    power: { x: 300 + 1, y: 0.22 * 616, w: 7, h: 78 },
    mute: MUTE_SWITCH,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#07080b",
      frame: { color: "#45719c", w: 5 },
      screen: { wF: 0.902, yF: 0.024, hF: 0.952, r: 33 },
      notch: { wF: 0.54, h: 35, r: 11, y: -13, o: 1 },
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    /* 147.5 × 71.5 mm · 6.12″, 2.2 mm bezels · the notch becomes the island */
    id: "iphone-14-pro",
    name: "iPhone 14 Pro",
    year: 2022,
    tagline: "48 megapixels, deep purple.",
    delta: "The notch breaks free — a floating island.",
    specline: "Dynamic Island · 48 MP · Always-On",
    accent: "#8a7ba8",
    accentSoft: "rgba(138, 123, 168, 0.18)",
    body: { w: 300, h: 620, r: 46, color: "#4d4660", curve: 0.12 },
    band: { w: 6, color: "#6b6383" },
    bottomStrip: { hFrac: 0.16, color: "#4d4660", o: 0 },
    topStrip: { hFrac: 0.16, color: "#4d4660", o: 0 },
    antenna: { o: 0, color: "#4d4660" },
    module: { x: 14, y: 14, w: 146, h: 152, r: 42, color: "#423c53", o: 1 },
    lenses: [
      { x: 58, y: 62, r: 21, o: 1 },
      { x: 58, y: 128, r: 21, o: 1 },
      { x: 120, y: 95, r: 21, o: 1 },
    ],
    flash: { x: 122, y: 48, r: 8, o: 1 },
    sensor: { x: 126, y: 142, r: 6, o: 1 },
    logo: { yFrac: 0.5, scale: 2.7, color: "#cfc9dd" },
    wordmark: { o: 0, color: "#cfc9dd" },
    buttons: { color: "#5e5674" },
    power: { x: 300 + 1, y: 0.22 * 620, w: 7, h: 78 },
    mute: MUTE_SWITCH,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#07080b",
      frame: { color: "#6b6383", w: 5 },
      screen: { wF: 0.91, yF: 0.022, hF: 0.957, r: 38 },
      notch: ISLAND,
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    /* 146.6 × 70.6 mm · 6.12″, 1.9 mm bezels · brushed titanium, Action button */
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    year: 2023,
    tagline: "Titanium. So light, so strong.",
    delta: "Titanium — and the mute switch becomes a button.",
    specline: "Titanium · USB-C · Action button",
    accent: "#a49c8d",
    accentSoft: "rgba(164, 156, 141, 0.16)",
    body: { w: 297, h: 616, r: 47, color: "#99938a", curve: 0.22 },
    band: { w: 6, color: "#b3ada2" },
    bottomStrip: { hFrac: 0.16, color: "#99938a", o: 0 },
    topStrip: { hFrac: 0.16, color: "#99938a", o: 0 },
    antenna: { o: 0, color: "#99938a" },
    module: { x: 14, y: 14, w: 148, h: 154, r: 42, color: "#8a8478", o: 1 },
    lenses: [
      { x: 58, y: 62, r: 21, o: 1 },
      { x: 58, y: 130, r: 21, o: 1 },
      { x: 122, y: 96, r: 21, o: 1 },
    ],
    flash: { x: 124, y: 48, r: 8, o: 1 },
    sensor: { x: 128, y: 144, r: 6, o: 1 },
    logo: { yFrac: 0.5, scale: 2.7, color: "#4e4a43" },
    wordmark: { o: 0, color: "#4e4a43" },
    buttons: { color: "#aaa398" },
    power: { x: 297 + 1, y: 0.22 * 616, w: 7, h: 78 },
    mute: ACTION_BTN,
    camCtl: CAMCTL_OFF,
    front: {
      face: "#07080b",
      frame: { color: "#b3ada2", w: 5 },
      screen: { wF: 0.922, yF: 0.019, hF: 0.9625, r: 40 },
      notch: ISLAND,
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    /* 149.6 × 71.5 mm · 6.27″, 1.2 mm bezels · desert titanium, Camera Control */
    id: "iphone-16-pro",
    name: "iPhone 16 Pro",
    year: 2024,
    tagline: "Hello, Camera Control.",
    delta: "A new button clicks into the right edge.",
    specline: "A18 Pro · 4K 120 fps · Camera Control",
    accent: "#b9906b",
    accentSoft: "rgba(185, 144, 107, 0.17)",
    body: { w: 300, h: 628, r: 50, color: "#b6a189", curve: 0.22 },
    band: { w: 6, color: "#cbb69c" },
    bottomStrip: { hFrac: 0.16, color: "#b6a189", o: 0 },
    topStrip: { hFrac: 0.16, color: "#b6a189", o: 0 },
    antenna: { o: 0, color: "#b6a189" },
    module: { x: 14, y: 14, w: 150, h: 156, r: 42, color: "#a79178", o: 1 },
    lenses: [
      { x: 60, y: 64, r: 21, o: 1 },
      { x: 60, y: 132, r: 21, o: 1 },
      { x: 124, y: 98, r: 21, o: 1 },
    ],
    flash: { x: 126, y: 50, r: 8, o: 1 },
    sensor: { x: 130, y: 146, r: 6, o: 1 },
    logo: { yFrac: 0.5, scale: 2.75, color: "#514738" },
    wordmark: { o: 0, color: "#514738" },
    buttons: { color: "#c4ae93" },
    power: { x: 300 + 1, y: 0.22 * 628, w: 7, h: 78 },
    mute: ACTION_BTN,
    camCtl: CAMCTL_ON,
    front: {
      face: "#07080b",
      frame: { color: "#cbb69c", w: 5 },
      screen: { wF: 0.9315, yF: 0.016, hF: 0.968, r: 43 },
      notch: { wF: 0.3, h: 25, r: 12.5, y: 10, o: 1 },
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    /* 150 × 71.9 mm · 6.27″ · aluminum unibody, full-width camera plateau */
    id: "iphone-17-pro",
    name: "iPhone 17 Pro",
    year: 2025,
    tagline: "The camera plateau. Cosmic orange.",
    delta: "The module stretches into a full-width plateau.",
    specline: "Camera plateau · A19 Pro · Vapor chamber",
    accent: "#ff7a2f",
    accentSoft: "rgba(255, 122, 47, 0.17)",
    body: { w: 302, h: 630, r: 50, color: "#e97a35", curve: 0.28 },
    band: { w: 6, color: "#f29457" },
    bottomStrip: { hFrac: 0.16, color: "#e97a35", o: 0 },
    topStrip: { hFrac: 0.16, color: "#e97a35", o: 0 },
    antenna: { o: 0, color: "#e97a35" },
    module: { x: 14, y: 16, w: 274, h: 158, r: 46, color: "#d5691f", o: 1 },
    lenses: [
      { x: 58, y: 64, r: 22, o: 1 },
      { x: 58, y: 132, r: 22, o: 1 },
      { x: 118, y: 98, r: 22, o: 1 },
    ],
    flash: { x: 238, y: 58, r: 9, o: 1 },
    sensor: { x: 238, y: 116, r: 7, o: 1 },
    logo: { yFrac: 0.56, scale: 2.8, color: "#fbe3d2" },
    wordmark: { o: 0, color: "#fbe3d2" },
    buttons: { color: "#c96222" },
    power: { x: 302 + 1, y: 0.22 * 630, w: 7, h: 78 },
    mute: ACTION_BTN,
    camCtl: CAMCTL_ON,
    front: {
      face: "#07080b",
      frame: { color: "#f29457", w: 5 },
      screen: { wF: 0.926, yF: 0.0173, hF: 0.965, r: 43 },
      notch: { wF: 0.3, h: 25, r: 12.5, y: 10, o: 1 },
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
];

export const N_PHONES = PHONES.length;

export const bodyTop = (p: PhoneSpec) => CANVAS.cy - p.body.h / 2;
export const bodyLeftAt = (p: PhoneSpec, cx: number) => cx - p.body.w / 2;
