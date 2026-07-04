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
 * Geometry is in canvas px, relative to the body's top-left corner (or as a
 * fraction of body width/height where marked `F`). Real device dimensions
 * (mm) are scaled by ~4.2 to canvas units.
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

export interface PhoneSpec {
  id: string;
  name: string;
  year: number;
  tagline: string;
  delta: string; // the design shift to watch during the morph into this model
  specline: string;
  accent: string; // era accent (hex, used for static UI bits)
  accentSoft: string; // rgba, used for the animated backdrop glow + screen tint
  body: { w: number; h: number; r: number; color: string };
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
  camCtl: { yF: number; h: number; o: number }; // Camera Control (2024+), right edge
  front: {
    face: string; // front glass color
    frame: { color: string; w: number }; // bezel/rim stroke around the face
    screen: { wF: number; yF: number; hF: number; r: number };
    notch: { wF: number; h: number; r: number; y: number; o: number }; // wF of screen width; y = gap below screen top (0 = attached notch, >0 = floating island)
    home: { r: number; o: number; squareO: number }; // squareO = printed app-icon square (2007–2012)
    ear: { w: number; o: number }; // earpiece slit, centered in the top bezel
    fcam: { xF: number; o: number }; // selfie camera dot (arrives 2010)
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
const EAR_OFF = { w: 30, o: 0 };
const FCAM_OFF = { xF: 0.38, o: 0 };
const HOME_OFF = { r: 12, o: 0, squareO: 0 };
const CAMCTL_OFF = { yF: 0.64, h: 44, o: 0 };
const CAMCTL_ON = { yF: 0.64, h: 44, o: 1 };

/* ------------------------------------------------------------------ */

const l1_2007 = { x: 36, y: 36, r: 12 };
const l1_3gs = { x: 36, y: 36, r: 11 };
const l1_4 = { x: 34, y: 32, r: 13 };
const l1_5 = { x: 32, y: 34, r: 13 };
const l1_6 = { x: 36, y: 38, r: 14 };

export const PHONES: PhoneSpec[] = [
  {
    id: "iphone",
    name: "iPhone",
    year: 2007,
    tagline: "It all started here.",
    delta: "One aluminum slab. One camera. One button.",
    specline: "3.5″ · 2 MP · OS X",
    accent: "#9aa3ad",
    accentSoft: "rgba(154, 163, 173, 0.16)",
    body: { w: 256, h: 483, r: 42, color: "#c2c6cb" },
    band: { w: 0, color: "#c2c6cb" },
    bottomStrip: { hFrac: 0.27, color: "#17181b", o: 1 },
    topStrip: { hFrac: 0.16, color: "#c2c6cb", o: 0 },
    antenna: { o: 0, color: "#c2c6cb" },
    module: { x: 12, y: 12, w: 66, h: 66, r: 33, color: "#c2c6cb", o: 0 },
    lenses: [{ ...l1_2007, o: 1 }, hiddenAt(l1_2007), hiddenAt(l1_2007)],
    flash: hiddenAt({ x: 36, y: 36, r: 8 }),
    sensor: hiddenAt({ x: 36, y: 36, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.1, color: "#7d8289" },
    wordmark: { o: 1, color: "#6f747c" },
    buttons: { color: "#969ba2" },
    power: { x: 256 - 82, y: -7, w: 48, h: 7 },
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0f1013",
      frame: { color: "#c9ccd1", w: 9 },
      screen: { wF: 0.78, yF: 0.19, hF: 0.585, r: 4 },
      notch: NOTCH_OFF,
      home: { r: 26, o: 1, squareO: 1 },
      ear: { w: 38, o: 1 },
      fcam: FCAM_OFF,
    },
  },
  {
    id: "iphone-3gs",
    name: "iPhone 3GS",
    year: 2009,
    tagline: "Twice as fast, in glossy plastic.",
    delta: "The aluminum melts into curved black plastic.",
    specline: "3.5″ · 3 MP · Video",
    accent: "#79828f",
    accentSoft: "rgba(121, 130, 143, 0.16)",
    body: { w: 261, h: 485, r: 46, color: "#1f2126" },
    band: { w: 0, color: "#1f2126" },
    bottomStrip: { hFrac: 0.27, color: "#1f2126", o: 0 },
    topStrip: { hFrac: 0.16, color: "#1f2126", o: 0 },
    antenna: { o: 0, color: "#1f2126" },
    module: { x: 12, y: 12, w: 66, h: 66, r: 33, color: "#1f2126", o: 0 },
    lenses: [{ ...l1_3gs, o: 1 }, hiddenAt(l1_3gs), hiddenAt(l1_3gs)],
    flash: hiddenAt({ x: 36, y: 36, r: 8 }),
    sensor: hiddenAt({ x: 36, y: 36, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.1, color: "#c9cdd3" },
    wordmark: { o: 1, color: "#b7bcc4" },
    buttons: { color: "#33363c" },
    power: { x: 261 - 82, y: -7, w: 48, h: 7 },
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0d0e10",
      frame: { color: "#c3c8cf", w: 7 },
      screen: { wF: 0.78, yF: 0.185, hF: 0.6, r: 4 },
      notch: NOTCH_OFF,
      home: { r: 26, o: 1, squareO: 1 },
      ear: { w: 38, o: 1 },
      fcam: FCAM_OFF,
    },
  },
  {
    id: "iphone-4",
    name: "iPhone 4",
    year: 2010,
    tagline: "Glass, steel, and the Retina display.",
    delta: "Flat glass, a steel band — a flash slides out beside the lens.",
    specline: "Retina · 5 MP · FaceTime",
    accent: "#aeb6c2",
    accentSoft: "rgba(174, 182, 194, 0.15)",
    body: { w: 246, h: 484, r: 24, color: "#121317" },
    band: { w: 7, color: "#8d939c" },
    bottomStrip: { hFrac: 0.27, color: "#121317", o: 0 },
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
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0b0c0f",
      frame: { color: "#8d939c", w: 7 },
      screen: { wF: 0.775, yF: 0.185, hF: 0.6, r: 4 },
      notch: NOTCH_OFF,
      home: { r: 25, o: 1, squareO: 1 },
      ear: { w: 36, o: 1 },
      fcam: { xF: 0.35, o: 1 },
    },
  },
  {
    id: "iphone-5",
    name: "iPhone 5",
    year: 2012,
    tagline: "Taller, thinner, aluminum.",
    delta: "The body stretches; glass windows split the back.",
    specline: "4″ · A6 · Lightning",
    accent: "#8b93a1",
    accentSoft: "rgba(139, 147, 161, 0.15)",
    body: { w: 246, h: 520, r: 26, color: "#3f434b" },
    band: { w: 0, color: "#3f434b" },
    bottomStrip: { hFrac: 0.155, color: "#282b31", o: 1 },
    topStrip: { hFrac: 0.155, color: "#282b31", o: 1 },
    antenna: { o: 0, color: "#3f434b" },
    module: { x: 10, y: 12, w: 70, h: 46, r: 23, color: "#3f434b", o: 0 },
    lenses: [{ ...l1_5, o: 1 }, hiddenAt(l1_5), hiddenAt(l1_5)],
    flash: { x: 64, y: 34, r: 6, o: 1 },
    sensor: hiddenAt({ x: 64, y: 34, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.1, color: "#b4bac2" },
    wordmark: { o: 1, color: "#a4aab3" },
    buttons: { color: "#54585f" },
    power: { x: 246 - 78, y: -7, w: 44, h: 7 },
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0b0c0e",
      frame: { color: "#4a4e56", w: 5 },
      screen: { wF: 0.82, yF: 0.145, hF: 0.7, r: 4 },
      notch: NOTCH_OFF,
      home: { r: 25, o: 1, squareO: 1 },
      ear: { w: 36, o: 1 },
      fcam: { xF: 0.35, o: 1 },
    },
  },
  {
    id: "iphone-6",
    name: "iPhone 6",
    year: 2014,
    tagline: "Bigger than bigger.",
    delta: "Corners soften; antenna lines streak the aluminum.",
    specline: "4.7″ · A8 · Apple Pay",
    accent: "#8e9098",
    accentSoft: "rgba(142, 144, 152, 0.15)",
    body: { w: 281, h: 580, r: 38, color: "#54575e" },
    band: { w: 0, color: "#54575e" },
    bottomStrip: { hFrac: 0.155, color: "#54575e", o: 0 },
    topStrip: { hFrac: 0.155, color: "#54575e", o: 0 },
    antenna: { o: 1, color: "#c7cad0" },
    module: { x: 14, y: 14, w: 72, h: 48, r: 24, color: "#54575e", o: 0 },
    lenses: [{ ...l1_6, o: 1 }, hiddenAt(l1_6), hiddenAt(l1_6)],
    flash: { x: 72, y: 38, r: 8, o: 1 },
    sensor: hiddenAt({ x: 72, y: 38, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.15, color: "#c3c6cc" },
    wordmark: { o: 1, color: "#b3b7be" },
    buttons: { color: "#6a6d74" },
    power: { x: 281 + 1, y: 0.24 * 580, w: 7, h: 62 },
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0d0e11",
      frame: { color: "#5b5e65", w: 5 },
      screen: { wF: 0.81, yF: 0.125, hF: 0.75, r: 5 },
      notch: NOTCH_OFF,
      home: { r: 27, o: 1, squareO: 0 },
      ear: { w: 36, o: 1 },
      fcam: { xF: 0.36, o: 1 },
    },
  },
  {
    id: "iphone-7-plus",
    name: "iPhone 7 Plus",
    year: 2016,
    tagline: "Two cameras. Portraits happen.",
    delta: "The lens splits in two.",
    specline: "5.5″ · Dual camera · Portrait",
    accent: "#5c6572",
    accentSoft: "rgba(92, 101, 114, 0.18)",
    body: { w: 327, h: 664, r: 42, color: "#232529" },
    band: { w: 0, color: "#232529" },
    bottomStrip: { hFrac: 0.155, color: "#232529", o: 0 },
    topStrip: { hFrac: 0.155, color: "#232529", o: 0 },
    antenna: { o: 1, color: "#3a3d43" },
    module: { x: 24, y: 26, w: 118, h: 48, r: 24, color: "#1a1c20", o: 1 },
    lenses: [
      { x: 48, y: 50, r: 16, o: 1 },
      { x: 94, y: 50, r: 16, o: 1 },
      hiddenAt({ x: 94, y: 50, r: 16 }),
    ],
    flash: { x: 158, y: 50, r: 9, o: 1 },
    sensor: hiddenAt({ x: 158, y: 50, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.2, color: "#babec5" },
    wordmark: { o: 1, color: "#a9adb5" },
    buttons: { color: "#393c42" },
    power: { x: 327 + 1, y: 0.24 * 664, w: 7, h: 66 },
    camCtl: CAMCTL_OFF,
    front: {
      face: "#0b0c0e",
      frame: { color: "#2c2e33", w: 5 },
      screen: { wF: 0.8, yF: 0.115, hF: 0.765, r: 5 },
      notch: NOTCH_OFF,
      home: { r: 29, o: 1, squareO: 0 },
      ear: { w: 40, o: 1 },
      fcam: { xF: 0.37, o: 1 },
    },
  },
  {
    id: "iphone-x",
    name: "iPhone X",
    year: 2017,
    tagline: "The future turns vertical.",
    delta: "The screen swallows the face; the home button dissolves.",
    specline: "5.8″ OLED · Face ID · No home button",
    accent: "#c0c6d1",
    accentSoft: "rgba(192, 198, 209, 0.14)",
    body: { w: 298, h: 603, r: 44, color: "#45484f" },
    band: { w: 7, color: "#b6bbc3" },
    bottomStrip: { hFrac: 0.155, color: "#45484f", o: 0 },
    topStrip: { hFrac: 0.155, color: "#45484f", o: 0 },
    antenna: { o: 0, color: "#45484f" },
    module: { x: 28, y: 28, w: 52, h: 124, r: 26, color: "#33363c", o: 1 },
    lenses: [
      { x: 54, y: 56, r: 17, o: 1 },
      { x: 54, y: 124, r: 17, o: 1 },
      hiddenAt({ x: 54, y: 124, r: 17 }),
    ],
    flash: { x: 54, y: 90, r: 6, o: 1 },
    sensor: hiddenAt({ x: 54, y: 90, r: 6 }),
    logo: { yFrac: 0.3, scale: 2.2, color: "#d3d6db" },
    wordmark: { o: 1, color: "#c0c4cb" },
    buttons: { color: "#5c6067" },
    power: { x: 298 + 1, y: 0.22 * 603, w: 7, h: 78 },
    camCtl: CAMCTL_OFF,
    front: {
      face: "#07080b",
      frame: { color: "#b6bbc3", w: 6 },
      screen: { wF: 0.905, yF: 0.036, hF: 0.928, r: 38 },
      notch: { wF: 0.47, h: 40, r: 13, y: -13, o: 1 },
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    id: "iphone-11-pro",
    name: "iPhone 11 Pro",
    year: 2019,
    tagline: "Three lenses, midnight green.",
    delta: "A third lens; the module becomes a square.",
    specline: "Triple camera · Night mode",
    accent: "#5d7a6b",
    accentSoft: "rgba(93, 122, 107, 0.18)",
    body: { w: 300, h: 605, r: 44, color: "#46534a" },
    band: { w: 0, color: "#46534a" },
    bottomStrip: { hFrac: 0.155, color: "#46534a", o: 0 },
    topStrip: { hFrac: 0.155, color: "#46534a", o: 0 },
    antenna: { o: 0, color: "#46534a" },
    module: { x: 22, y: 22, w: 126, h: 126, r: 36, color: "#4e5c52", o: 1 },
    lenses: [
      { x: 58, y: 58, r: 19, o: 1 },
      { x: 58, y: 114, r: 19, o: 1 },
      { x: 110, y: 86, r: 19, o: 1 },
    ],
    flash: { x: 112, y: 44, r: 7, o: 1 },
    sensor: hiddenAt({ x: 112, y: 44, r: 6 }),
    logo: { yFrac: 0.5, scale: 2.3, color: "#ced3cf" },
    wordmark: { o: 0, color: "#ced3cf" },
    buttons: { color: "#5c6a60" },
    power: { x: 300 + 1, y: 0.22 * 605, w: 7, h: 78 },
    camCtl: CAMCTL_OFF,
    front: {
      face: "#07080b",
      frame: { color: "#5f6d63", w: 6 },
      screen: { wF: 0.905, yF: 0.036, hF: 0.928, r: 38 },
      notch: { wF: 0.45, h: 40, r: 13, y: -13, o: 1 },
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    id: "iphone-12",
    name: "iPhone 12",
    year: 2020,
    tagline: "Flat edges are back. In Pacific Blue.",
    delta: "Edges snap flat again.",
    specline: "5G · MagSafe · Ceramic Shield",
    accent: "#4479ad",
    accentSoft: "rgba(68, 121, 173, 0.18)",
    body: { w: 300, h: 616, r: 36, color: "#31567c" },
    band: { w: 5, color: "#456d94" },
    bottomStrip: { hFrac: 0.155, color: "#31567c", o: 0 },
    topStrip: { hFrac: 0.155, color: "#31567c", o: 0 },
    antenna: { o: 0, color: "#31567c" },
    module: { x: 20, y: 20, w: 110, h: 110, r: 32, color: "#2a4b6d", o: 1 },
    lenses: [
      { x: 52, y: 50, r: 17, o: 1 },
      { x: 52, y: 94, r: 17, o: 1 },
      hiddenAt({ x: 52, y: 94, r: 17 }),
    ],
    flash: { x: 96, y: 46, r: 7, o: 1 },
    sensor: hiddenAt({ x: 96, y: 46, r: 6 }),
    logo: { yFrac: 0.5, scale: 2.3, color: "#c8d4e0" },
    wordmark: { o: 0, color: "#c8d4e0" },
    buttons: { color: "#3f6488" },
    power: { x: 300 + 1, y: 0.22 * 616, w: 7, h: 78 },
    camCtl: CAMCTL_OFF,
    front: {
      face: "#07080b",
      frame: { color: "#456d94", w: 5 },
      screen: { wF: 0.91, yF: 0.033, hF: 0.934, r: 34 },
      notch: { wF: 0.43, h: 39, r: 13, y: -13, o: 1 },
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    id: "iphone-14-pro",
    name: "iPhone 14 Pro",
    year: 2022,
    tagline: "48 megapixels, deep purple.",
    delta: "The notch breaks free — a floating island.",
    specline: "Dynamic Island · 48 MP · Always-On",
    accent: "#8a7ba8",
    accentSoft: "rgba(138, 123, 168, 0.18)",
    body: { w: 300, h: 620, r: 40, color: "#4d4660" },
    band: { w: 6, color: "#6b6383" },
    bottomStrip: { hFrac: 0.155, color: "#4d4660", o: 0 },
    topStrip: { hFrac: 0.155, color: "#4d4660", o: 0 },
    antenna: { o: 0, color: "#4d4660" },
    module: { x: 20, y: 20, w: 140, h: 144, r: 42, color: "#423c53", o: 1 },
    lenses: [
      { x: 60, y: 62, r: 20, o: 1 },
      { x: 60, y: 122, r: 20, o: 1 },
      { x: 116, y: 92, r: 20, o: 1 },
    ],
    flash: { x: 118, y: 48, r: 8, o: 1 },
    sensor: { x: 122, y: 136, r: 6, o: 1 },
    logo: { yFrac: 0.5, scale: 2.3, color: "#cfc9dd" },
    wordmark: { o: 0, color: "#cfc9dd" },
    buttons: { color: "#5e5674" },
    power: { x: 300 + 1, y: 0.22 * 620, w: 7, h: 78 },
    camCtl: CAMCTL_OFF,
    front: {
      face: "#07080b",
      frame: { color: "#6b6383", w: 5 },
      screen: { wF: 0.92, yF: 0.028, hF: 0.944, r: 40 },
      notch: { wF: 0.3, h: 25, r: 12.5, y: 13, o: 1 },
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    year: 2023,
    tagline: "Titanium. So light, so strong.",
    delta: "Titanium, and lighter on its feet.",
    specline: "Titanium · USB-C · Action button",
    accent: "#a49c8d",
    accentSoft: "rgba(164, 156, 141, 0.16)",
    body: { w: 297, h: 616, r: 44, color: "#99938a" },
    band: { w: 6, color: "#b3ada2" },
    bottomStrip: { hFrac: 0.155, color: "#99938a", o: 0 },
    topStrip: { hFrac: 0.155, color: "#99938a", o: 0 },
    antenna: { o: 0, color: "#99938a" },
    module: { x: 20, y: 20, w: 142, h: 146, r: 42, color: "#8a8478", o: 1 },
    lenses: [
      { x: 60, y: 62, r: 20, o: 1 },
      { x: 60, y: 124, r: 20, o: 1 },
      { x: 118, y: 93, r: 20, o: 1 },
    ],
    flash: { x: 120, y: 48, r: 8, o: 1 },
    sensor: { x: 124, y: 138, r: 6, o: 1 },
    logo: { yFrac: 0.5, scale: 2.3, color: "#4e4a43" },
    wordmark: { o: 0, color: "#4e4a43" },
    buttons: { color: "#aaa398" },
    power: { x: 297 + 1, y: 0.22 * 616, w: 7, h: 78 },
    camCtl: CAMCTL_OFF,
    front: {
      face: "#07080b",
      frame: { color: "#b3ada2", w: 5 },
      screen: { wF: 0.925, yF: 0.026, hF: 0.948, r: 42 },
      notch: { wF: 0.3, h: 25, r: 12.5, y: 13, o: 1 },
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    id: "iphone-16-pro",
    name: "iPhone 16 Pro",
    year: 2024,
    tagline: "Hello, Camera Control.",
    delta: "A new button clicks into the right edge.",
    specline: "A18 Pro · 4K 120 fps · Camera Control",
    accent: "#b9906b",
    accentSoft: "rgba(185, 144, 107, 0.17)",
    body: { w: 300, h: 624, r: 44, color: "#b6a189" },
    band: { w: 6, color: "#cbb69c" },
    bottomStrip: { hFrac: 0.155, color: "#b6a189", o: 0 },
    topStrip: { hFrac: 0.155, color: "#b6a189", o: 0 },
    antenna: { o: 0, color: "#b6a189" },
    module: { x: 20, y: 20, w: 144, h: 148, r: 42, color: "#a79178", o: 1 },
    lenses: [
      { x: 60, y: 62, r: 20, o: 1 },
      { x: 60, y: 124, r: 20, o: 1 },
      { x: 118, y: 93, r: 20, o: 1 },
    ],
    flash: { x: 120, y: 48, r: 8, o: 1 },
    sensor: { x: 124, y: 138, r: 6, o: 1 },
    logo: { yFrac: 0.5, scale: 2.3, color: "#514738" },
    wordmark: { o: 0, color: "#514738" },
    buttons: { color: "#c4ae93" },
    power: { x: 300 + 1, y: 0.22 * 624, w: 7, h: 78 },
    camCtl: CAMCTL_ON,
    front: {
      face: "#07080b",
      frame: { color: "#cbb69c", w: 5 },
      screen: { wF: 0.925, yF: 0.026, hF: 0.948, r: 42 },
      notch: { wF: 0.29, h: 25, r: 12.5, y: 13, o: 1 },
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
  {
    id: "iphone-17-pro",
    name: "iPhone 17 Pro",
    year: 2025,
    tagline: "The camera plateau. Cosmic orange.",
    delta: "The module stretches into a full-width plateau.",
    specline: "Camera plateau · A19 Pro · Vapor chamber",
    accent: "#ff7a2f",
    accentSoft: "rgba(255, 122, 47, 0.17)",
    body: { w: 302, h: 630, r: 46, color: "#e97a35" },
    band: { w: 6, color: "#f29457" },
    bottomStrip: { hFrac: 0.155, color: "#e97a35", o: 0 },
    topStrip: { hFrac: 0.155, color: "#e97a35", o: 0 },
    antenna: { o: 0, color: "#e97a35" },
    module: { x: 14, y: 16, w: 274, h: 152, r: 44, color: "#d5691f", o: 1 },
    lenses: [
      { x: 56, y: 60, r: 22, o: 1 },
      { x: 56, y: 126, r: 22, o: 1 },
      { x: 114, y: 93, r: 22, o: 1 },
    ],
    flash: { x: 234, y: 56, r: 9, o: 1 },
    sensor: { x: 234, y: 112, r: 7, o: 1 },
    logo: { yFrac: 0.56, scale: 2.3, color: "#fbe3d2" },
    wordmark: { o: 0, color: "#fbe3d2" },
    buttons: { color: "#c96222" },
    power: { x: 302 + 1, y: 0.22 * 630, w: 7, h: 78 },
    camCtl: CAMCTL_ON,
    front: {
      face: "#07080b",
      frame: { color: "#f29457", w: 5 },
      screen: { wF: 0.927, yF: 0.025, hF: 0.95, r: 44 },
      notch: { wF: 0.29, h: 25, r: 12.5, y: 13, o: 1 },
      home: HOME_OFF,
      ear: EAR_OFF,
      fcam: FCAM_OFF,
    },
  },
];

export const N_PHONES = PHONES.length;

export const bodyTop = (p: PhoneSpec) => CANVAS.cy - p.body.h / 2;
export const bodyLeftAt = (p: PhoneSpec, cx: number) => cx - p.body.w / 2;
