import type { DisplayRectangle, PhoneSpec } from "./phones";

/** Published dimensions are millimeters. Artwork/corners are photo estimates, not CAD. */
export const MODEL_PX_PER_MM = 4.2;
const newsroom = "https://news.samsung.com/global/";
const z8 = newsroom + "samsung-galaxy-z-fold8-ultra-fold8-and-flip8foldables-perfected-for-every-way-of-living";
const s26 = "https://news.samsung.com/sg/samsung-unveils-galaxy-s26-series-the-most-intuitive-galaxy-ai-phone-yet";

interface Reference {
  body: readonly [width: number, height: number, depth: number];
  // A full-rectangle diagonal and width:height ratio, before cutouts.
  screen: readonly [inches: number, widthRatio: number, heightRatio: number];
  source: string;
  aspectBasis: "published" | "illustrative";
  rearCameras: number;
  open?: readonly [width: number, height: number, depth: number];
  cover?: readonly [inches: number, widthPixels: number, heightPixels: number];
}

// S-series aspect values without an explicit ratio in the cited press table are
// conservative drawing inputs, not claimed manufacturer bezel measurements.
// Keep those provenance distinctions rather than filling missing specs with guesses.
export const SAMSUNG_REFERENCE: Readonly<Record<string, Reference>> = {
  "galaxy-s3": {
    body: [70.6, 136.6, 8.6], screen: [4.8, 720, 1280], rearCameras: 1,
    // The Korean launch announcement preserves the original specification graphic.
    aspectBasis: "published", source: "https://news.samsung.com/kr/%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90-%EA%B0%A4%EB%9F%AD%EC%8B%9Cs%E2%85%A2-%EC%A0%84%EA%B2%A9-%EA%B3%B5%EA%B0%9C",
  },
  "galaxy-s6-edge": {
    body: [70.1, 142.1, 7], screen: [5.1, 1440, 2560], rearCameras: 1,
    aspectBasis: "published", source: newsroom + "beautifully-crafted-from-metal-and-glass-samsung-galaxy-s6-and-galaxy-s6-edge-define-whats-next-in-mobility",
  },
  "galaxy-s8": {
    body: [68.1, 148.9, 8], screen: [5.8, 1440, 2960], rearCameras: 1,
    aspectBasis: "published", source: "https://news.samsung.com/in/smartphones-without-limits-samsung-galaxy-s8-and-galaxy-s8-launched-in-india",
  },
  "galaxy-s10": {
    body: [70.4, 149.9, 7.8], screen: [6.1, 9, 19], rearCameras: 3,
    aspectBasis: "published", source: newsroom + "samsung-raises-the-bar-with-galaxy-s10-more-screen-cameras-and-choices",
  },
  "galaxy-s20-ultra": {
    body: [76, 166.9, 8.8], screen: [6.9, 1440, 3200], rearCameras: 4,
    // Samsung's quad-camera count includes the DepthVision camera.
    aspectBasis: "published", source: "https://news.samsung.com/my/introducing-the-samsung-galaxy-s20-change-the-way-you-experience-the-world",
  },
  "galaxy-s22-ultra": {
    body: [77.9, 163.3, 8.9], screen: [6.8, 1440, 3088], rearCameras: 4,
    aspectBasis: "illustrative", source: newsroom + "samsung-galaxy-s22-ultra-offers-the-ultimate-and-most-premium-s-series-experience-yet",
  },
  "galaxy-s24-ultra": {
    body: [79, 162.3, 8.6], screen: [6.8, 9, 19.5], rearCameras: 4,
    aspectBasis: "illustrative", source: newsroom + "enter-the-new-era-of-mobile-ai-with-samsung-galaxy-s24-series",
  },
  "galaxy-s25-ultra": {
    body: [77.6, 162.8, 8.2], screen: [6.9, 9, 19.5], rearCameras: 4,
    aspectBasis: "illustrative", source: newsroom + "samsung-galaxy-s25-series-sets-the-standard-of-ai-phone-as-a-true-ai-companion",
  },
  "galaxy-s26": {
    body: [71.7, 149.6, 7.2], screen: [6.3, 9, 19.5], rearCameras: 3,
    aspectBasis: "illustrative", source: s26,
  },
  "galaxy-s26-plus": {
    body: [75.8, 158.4, 7.3], screen: [6.7, 9, 19.5], rearCameras: 3,
    aspectBasis: "illustrative", source: s26,
  },
  "galaxy-s26-ultra": {
    body: [78.1, 163.6, 7.9], screen: [6.9, 9, 19.5], rearCameras: 4,
    aspectBasis: "illustrative", source: s26,
  },
  "galaxy-z-fold7": {
    body: [72.8, 158.4, 8.9], open: [143.2, 158.4, 4.2],
    screen: [8, 1968, 2184], cover: [6.5, 1080, 2520], rearCameras: 3,
    aspectBasis: "published", source: newsroom + "samsung-galaxy-z-fold7-raising-the-bar-for-smartphones",
  },
  "galaxy-z-flip7": {
    body: [75.2, 85.5, 13.7], open: [75.2, 166.7, 6.5],
    screen: [6.9, 1080, 2520], cover: [4.1, 948, 1048], rearCameras: 2,
    aspectBasis: "published", source: newsroom + "samsung-galaxy-z-flip7-a-pocket-sized-ai-powerhouse-with-a-new-edge-to-edge-flexwindow",
  },
  "galaxy-z-fold8": {
    body: [81.9, 123.9, 9.7], open: [161.4, 123.9, 4.5],
    screen: [7.6, 2448, 1848], cover: [5.5, 1248, 1972], rearCameras: 2,
    aspectBasis: "published", source: z8,
  },
  "galaxy-z-fold8-ultra": {
    body: [72.8, 158.4, 8.9], open: [143.2, 158.4, 4.1],
    screen: [8, 2256, 2504], cover: [6.5, 1080, 2520], rearCameras: 3,
    aspectBasis: "published", source: z8,
  },
  "galaxy-z-flip8": {
    body: [75.4, 85.7, 13.1], open: [75.4, 166.9, 6.1],
    screen: [6.9, 1080, 2520], cover: [4.1, 948, 1048], rearCameras: 2,
    aspectBasis: "published", source: z8,
  },
};

export function displayRectangle(spec: readonly [number, number, number], r: number): DisplayRectangle {
  const [diagonal, x, y] = spec;
  const scale = diagonal * 25.4 * MODEL_PX_PER_MM / Math.hypot(x, y);
  return { w: x * scale, h: y * scale, r };
}

export function applySamsungReference(phone: PhoneSpec): PhoneSpec {
  const ref = SAMSUNG_REFERENCE[phone.id];
  if (!ref) return phone;
  const [closedW, closedH, closedD] = ref.body;
  const isFlip = phone.fold?.axis === "flip";
  const width = (isFlip ? ref.open![0] : closedW) * MODEL_PX_PER_MM;
  const height = (isFlip ? ref.open![1] : closedH) * MODEL_PX_PER_MM;
  const screen = displayRectangle(ref.screen, phone.front.screen.r);
  const result: PhoneSpec = {
    ...phone,
    source: ref.source,
    thickness: ref.open?.[2] ?? closedD,
    body: { ...phone.body, w: width, h: height },
    front: {
      ...phone.front,
      frame: { ...phone.front.frame, w: phone.year >= 2024 ? 2.6 : 3.4 },
      screen: {
        ...phone.front.screen,
        wF: screen.w / width,
        hF: screen.h / height,
        yF: (height - screen.h) / (2 * height),
      },
    },
  };
  if (phone.fold && ref.open && ref.cover) {
    result.fold = {
      ...phone.fold,
      openWidth: ref.open[0] * MODEL_PX_PER_MM,
      openHeight: ref.open[1] * MODEL_PX_PER_MM,
      closedWidth: closedW * MODEL_PX_PER_MM,
      closedHeight: closedH * MODEL_PX_PER_MM,
      closedThickness: closedD,
      innerScreen: displayRectangle(ref.screen, isFlip ? 23 : 8),
      coverScreen: displayRectangle(ref.cover, isFlip ? 26 : 9),
    };
    // The fold's normal/front rectangle describes its cover, not an impossible
    // tablet-width screen squeezed into the one-panel body.
    const cover = isFlip ? screen : result.fold.coverScreen!;
    result.front.screen = { ...result.front.screen, wF: cover.w / width, hF: cover.h / height, yF: (height - cover.h) / (2 * height) };
  }
  return result;
}
