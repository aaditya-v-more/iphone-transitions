import type { DisplayRectangle, LensSlot, PhoneSpec } from "./phones";

/** Apple technical specifications, checked 20 September 2026.
 * Body dimensions are millimeters; display pixels/PPI describe a full rectangle.
 * Rounded corners, cutouts and enclosure curvature remain photo-based artwork.
 */
export interface AppleReference {
  body: readonly [width: number, height: number, depth: number];
  display: readonly [widthPixels: number, heightPixels: number, ppi: number];
  rearCameras: number;
  source: string;
  open?: readonly [width: number, height: number, depth: number];
  cover?: readonly [widthPixels: number, heightPixels: number, ppi: number];
}
const support = "https://support.apple.com/en-us/";
export const APPLE_REFERENCE: Readonly<Record<string, AppleReference>> = {
  iphone: { body: [61, 115, 11.6], display: [320, 480, 163], rearCameras: 1, source: support + "112445" },
  "iphone-3gs": { body: [62.1, 115.5, 12.3], display: [320, 480, 163], rearCameras: 1, source: support + "112307" },
  "iphone-4": { body: [58.6, 115.2, 9.3], display: [640, 960, 326], rearCameras: 1, source: support + "112562" },
  "iphone-5": { body: [58.6, 123.8, 7.6], display: [640, 1136, 326], rearCameras: 1, source: support + "112016" },
  "iphone-6": { body: [67, 138.1, 6.9], display: [750, 1334, 326], rearCameras: 1, source: support + "111954" },
  "iphone-7-plus": { body: [77.9, 158.2, 7.3], display: [1080, 1920, 401], rearCameras: 2, source: support + "111953" },
  "iphone-x": { body: [70.9, 143.6, 7.7], display: [1125, 2436, 458], rearCameras: 2, source: support + "111864" },
  "iphone-11-pro": { body: [71.4, 144, 8.1], display: [1125, 2436, 458], rearCameras: 3, source: support + "111879" },
  "iphone-12": { body: [71.5, 146.7, 7.4], display: [1170, 2532, 460], rearCameras: 2, source: support + "111876" },
  "iphone-14-pro": { body: [71.5, 147.5, 7.85], display: [1179, 2556, 460], rearCameras: 3, source: support + "111849" },
  "iphone-15-pro": { body: [70.6, 146.6, 8.25], display: [1179, 2556, 460], rearCameras: 3, source: support + "111829" },
  "iphone-16-pro": { body: [71.5, 149.6, 8.25], display: [1206, 2622, 460], rearCameras: 3, source: support + "121031" },
  "iphone-17": { body: [71.5, 149.6, 7.95], display: [1206, 2622, 460], rearCameras: 2, source: support + "125089" },
  "iphone-air": { body: [74.7, 156.2, 5.64], display: [1260, 2736, 460], rearCameras: 1, source: support + "125092" },
  "iphone-17-pro": { body: [71.9, 150, 8.75], display: [1206, 2622, 460], rearCameras: 3, source: support + "125090" },
  "iphone-17-pro-max": { body: [78, 163.4, 8.75], display: [1320, 2868, 460], rearCameras: 3, source: support + "125091" },
  "iphone-17e": { body: [71.5, 146.7, 7.8], display: [1170, 2532, 460], rearCameras: 1, source: support + "126470" },
  "iphone-18-pro": { body: [71.9, 150, 8.75], display: [1206, 2622, 460], rearCameras: 3, source: support + "148590" },
  "iphone-18-pro-max": { body: [78, 163.4, 8.75], display: [1320, 2868, 460], rearCameras: 3, source: support + "148591" },
  "iphone-duo": {
    body: [84.1, 117.8, 11.3], open: [164.6, 117.8, 5.2],
    display: [2670, 1878, 430], cover: [1398, 2034, 460], rearCameras: 2,
    source: "https://www.apple.com/iphone-duo/specs/",
  },
};

export function appleDisplayRectangle(display: AppleReference["display"], radius: number): DisplayRectangle {
  const [width, height, ppi] = display;
  return { w: width / ppi * 25.4 * 4.2, h: height / ppi * 25.4 * 4.2, r: radius };
}

export function applyAppleReference(phone: PhoneSpec): PhoneSpec {
  const ref = APPLE_REFERENCE[phone.id];
  if (!ref) return phone;
  const [width, height, depth] = ref.body;
  const w = width * 4.2, h = height * 4.2;
  const scaleX = w / phone.body.w, scaleY = h / phone.body.h;
  const scaleRadius = Math.min(scaleX, scaleY);
  const optic = (slot: LensSlot): LensSlot => ({ ...slot, x: slot.x * scaleX, y: slot.y * scaleY, r: slot.r * scaleRadius });
  const display = appleDisplayRectangle(ref.cover ?? ref.display, phone.front.screen.r * scaleRadius);
  // Retain the photo-based asymmetric old top/bottom bezels, while using the
  // actual active rectangle. Current all-screen models remain centered.
  const marginShare = phone.year < 2017
    ? phone.front.screen.yF / Math.max(0.0001, 1 - phone.front.screen.hF) : 0.5;
  const result: PhoneSpec = {
    ...phone,
    brand: "apple",
    source: ref.source,
    thickness: ref.open?.[2] ?? depth,
    body: { ...phone.body, w, h, r: phone.body.r * scaleRadius },
    module: { ...phone.module, x: phone.module.x * scaleX, y: phone.module.y * scaleY,
      w: phone.module.w * scaleX, h: phone.module.h * scaleY, r: phone.module.r * scaleRadius },
    lenses: phone.lenses.map(optic) as PhoneSpec["lenses"],
    extraLens: phone.extraLens ? optic(phone.extraLens) : undefined,
    flash: optic(phone.flash), sensor: optic(phone.sensor),
    power: { ...phone.power, x: phone.power.x * scaleX, y: phone.power.y * scaleY,
      w: phone.power.w * scaleX, h: phone.power.h * scaleY },
    front: { ...phone.front, screen: { wF: display.w / w, hF: display.h / h,
      yF: (1 - display.h / h) * marginShare, r: display.r } },
  };
  if (phone.fold && ref.open && ref.cover) {
    result.fold = { ...phone.fold,
      closedWidth: w, closedHeight: h, closedThickness: depth,
      openWidth: ref.open[0] * 4.2, openHeight: ref.open[1] * 4.2,
      innerScreen: appleDisplayRectangle(ref.display, 8),
      coverScreen: appleDisplayRectangle(ref.cover, 9),
    };
  }
  return result;
}
