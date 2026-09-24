import * as THREE from "three";
import type { PhoneSpec } from "../data/phones";
import { hingePose } from "./morph";
import { mixBodyProfile, rearSurfaceDrop, frontSurfaceDrop, type BodyProfile } from "./body-profile";
import { HingeSpineGeometry } from "./hinge-spine";

const TAU = Math.PI * 2;
const SEGMENTS = 12;
const RING = 4 * (SEGMENTS + 1);
const SIDE_KEY_ROTATION = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
const TOP_VOLUME_ROTATION = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -Math.PI / 2));
interface SurfaceProfile {
  profile: BodyProfile;
  w: number;
  h: number;
  d: number;
  r: number;
  skin?: boolean;
  glass?: boolean;
}
const applePath =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";

/** Constant topology: resize vertices, never allocate geometry while scrolling. */
class RoundedGeometry extends THREE.BufferGeometry {
  private previous = "";
  private ringCount: number;
  constructor(private detail: "plain" | "shell" | "glass" = "plain") {
    super();
    this.ringCount = detail === "shell" ? 26 : detail === "glass" ? 14 : 6;
    this.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array((RING * this.ringCount + 2) * 3), 3),
    );
    this.setAttribute("uv", new THREE.BufferAttribute(new Float32Array((RING * this.ringCount + 2) * 2), 2));
    const indices: number[] = [];
    for (let i = 0; i < RING; i++) {
      const j = (i + 1) % RING;
      indices.push(RING * this.ringCount, i, j, RING * this.ringCount + 1,
        RING * (this.ringCount - 1) + j, RING * (this.ringCount - 1) + i);
      for (let ring = 1; ring < this.ringCount - 2; ring++) {
        const a = ring * RING + i,
          b = ring * RING + j;
        indices.push(a, a + RING, b, b, a + RING, b + RING);
      }
    }
    this.setIndex(indices);
    this.reshape(1, 2, 0.1, 0.1);
  }
  reshape(
    w: number,
    h: number,
    depth: number,
    radius: number,
    flat: "left" | "right" | "top" | "bottom" | "none" = "none",
    flatStrength = 1,
    seamWeld = 0,
    surface?: SurfaceProfile,
  ) {
    w = Math.max(0.005, w);
    h = Math.max(0.005, h);
    depth = Math.max(0.002, depth);
    const r = Math.min(Math.max(0.002, radius), w / 2 - 0.001, h / 2 - 0.001);
    const signature = `${w},${h},${depth},${r},${flat},${flatStrength},${seamWeld},${surface ? JSON.stringify(surface) : ""}`;
    if (signature === this.previous) return;
    this.previous = signature;
    const bevel = Math.min(depth * 0.22, 0.035, r * 0.4);
    const profile = surface?.profile;
    const weight = profile?.weight ?? 0;
    const frontInset = Math.max(bevel, profile?.frontRoll ?? 0);
    const frameBevel = surface ? Math.min(surface.d * 0.22, 0.035, surface.r * 0.4) : bevel;
    const rearRoll = frameBevel * (1 - weight) + (profile?.roll ?? 0);
    const rearRise = frameBevel * (1 - weight) + (profile?.rise ?? 0);
    const skinRoll = Math.max(bevel, rearRoll - ((surface?.w ?? w) - w) / 2);
    const roll = surface?.skin ? skinRoll : this.detail === "shell" ? rearRoll : bevel;
    const rise = surface?.skin ? bevel : this.detail === "shell" ? rearRise : bevel;
    const frontExtra = this.detail === "plain" ? 0 : 8;
    const rearExtra = this.detail === "shell" ? 12 : 0;
    const rings: number[][] = [
      [frontExtra ? frontInset : bevel, depth / 2],
      [frontExtra ? frontInset : bevel, depth / 2],
      ...Array.from({ length: frontExtra }, (_, i) => [
        THREE.MathUtils.lerp(frontInset, bevel, (i + 1) / frontExtra), depth / 2,
      ]),
      [0, depth / 2 - bevel],
      [0, -depth / 2 + rise],
      ...Array.from({ length: rearExtra }, (_, i) => {
        const angle = ((i + 1) / (rearExtra + 1)) * Math.PI / 2;
        return [roll * (1 - Math.cos(angle)), -depth / 2 + rise * (1 - Math.sin(angle))];
      }),
      [roll, -depth / 2],
      [roll, -depth / 2],
    ];
    const pos = this.getAttribute("position") as THREE.BufferAttribute;
    const uv = this.getAttribute("uv") as THREE.BufferAttribute;
    for (let k = 0; k < this.ringCount; k++) {
      const [inset, z] = rings[k];
      for (let corner = 0; corner < 4; corner++) {
        const squared =
          flat === "left"
            ? corner === 1 || corner === 2
            : flat === "right"
              ? corner === 0 || corner === 3
              : flat === "top"
                ? corner < 2
                : flat === "bottom"
                  ? corner >= 2
                  : false;
        const cr = squared
          ? THREE.MathUtils.lerp(r, Math.min(r, Math.max(bevel + 0.001, 0.025)), flatStrength)
          : r;
        const innerRadius = Math.max(0.001, cr - inset);
        const centerX = (corner === 0 || corner === 3 ? 1 : -1) * (w / 2 - inset - innerRadius);
        const centerY = (corner < 2 ? 1 : -1) * (h / 2 - inset - innerRadius);
        for (let s = 0; s <= SEGMENTS; s++) {
          const theta = (corner * Math.PI) / 2 + ((s / SEGMENTS) * Math.PI) / 2;
          let x = centerX + Math.cos(theta) * innerRadius;
          let y = centerY + Math.sin(theta) * innerRadius;
          // As an open clamshell becomes a slab, both caps meet exactly. Keep
          // the outside corners rounded while removing only the internal bevel.
          if (squared && seamWeld > 0 && (flat === "top" || flat === "bottom")) {
            x = THREE.MathUtils.lerp(x, (corner === 0 || corner === 3 ? 1 : -1) * (w / 2 - inset), seamWeld);
            y = THREE.MathUtils.lerp(y, (flat === "top" ? 1 : -1) * h / 2, seamWeld);
          }
          const i = k * RING + corner * (SEGMENTS + 1) + s;
          let shapedZ = z;
          if (surface?.skin && weight > 0) {
            shapedZ += rearSurfaceDrop(x, y, surface.w, surface.h, surface.r, rearRoll, rearRise);
          } else if (surface && (surface.glass || k <= frontExtra + 2)) {
            shapedZ -= frontSurfaceDrop(x, surface.w, profile?.frontRoll ?? 0, profile?.frontDrop ?? 0);
          }
          pos.setXYZ(i, x, y, shapedZ);
          uv.setXY(i, x / w + 0.5, y / h + 0.5);
        }
      }
    }
    pos.setXYZ(RING * this.ringCount, 0, 0, depth / 2);
    pos.setXYZ(RING * this.ringCount + 1, 0, 0, -depth / 2);
    uv.setXY(RING * this.ringCount, 0.5, 0.5);
    uv.setXY(RING * this.ringCount + 1, 0.5, 0.5);
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    this.computeVertexNormals();
    this.computeBoundingSphere();
    this.computeBoundingBox();
  }
}

type Panel<M extends THREE.MeshStandardMaterial = THREE.MeshStandardMaterial> = THREE.Mesh<
  RoundedGeometry,
  M
>;
function material(color: string, metalness = 0.1, roughness = 0.35) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: 0.5 });
}
function glassMaterial(color: string, roughness = 0.32, specularIntensity = 0.16) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness,
    specularIntensity,
    envMapIntensity: 0.08,
    clearcoat: 0,
  });
}
function panel<M extends THREE.MeshStandardMaterial>(parent: THREE.Object3D, mat: M,
  detail: "plain" | "shell" | "glass" = "plain"): Panel<M> {
  const mesh = new THREE.Mesh(new RoundedGeometry(detail), mat);
  parent.add(mesh);
  return mesh;
}
function size(
  mesh: Panel,
  w: number,
  h: number,
  d: number,
  r: number,
  x = 0,
  y = 0,
  z = 0,
  flat: "left" | "right" | "top" | "bottom" | "none" = "none",
  flatStrength = 1,
  seamWeld = 0,
  surface?: SurfaceProfile,
) {
  mesh.geometry.reshape(w, h, d, r, flat, flatStrength, seamWeld, surface);
  mesh.position.set(x, y, z);
}
function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function logoTexture(samsung: boolean) {
  return canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = "white";
    if (samsung) {
      ctx.font = "bold 35px Arial";
      ctx.textAlign = "center";
      ctx.fillText("SAMSUNG", 128, 77);
    } else {
      ctx.translate(82, 12);
      ctx.scale(4, 4);
      ctx.fill(new Path2D(applePath));
    }
  });
}

/** Original outer-display artwork; keep the clock clear of the lower-right cameras. */
export function coverWallpaper(p: PhoneSpec) {
  return canvasTexture(512, 512, (ctx) => {
    const background = ctx.createLinearGradient(0, 0, 512, 512);
    background.addColorStop(0, "#10121b");
    background.addColorStop(1, "#26202e");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 512, 512);
    const glow = ctx.createRadialGradient(420, 460, 10, 370, 440, 390);
    glow.addColorStop(0, p.accent);
    glow.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f5f1f5";
    ctx.textAlign = "left";
    ctx.font = "300 100px Arial";
    ctx.fillText(p.brand === "samsung" ? "12:45" : "9:41", 32, 150);
    ctx.font = "22px Arial";
    ctx.fillText("Tuesday, September 9", 38, 190);
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.beginPath();
    ctx.roundRect(199, 480, 114, 5, 3);
    ctx.fill();
  });
}

/** Original procedural wallpapers and a readable lock screen; no remote images. */
export function wallpaper(p: PhoneSpec, inner = false) {
  const logicalWidth =
    inner && p.fold?.axis === "book"
      ? (1024 * (p.fold.innerScreen?.w ?? p.fold.openWidth)) / (p.fold.innerScreen?.h ?? p.fold.openHeight)
      : 512;
  const width = Math.round(Math.min(1024, logicalWidth * 0.75));
  return canvasTexture(width, 768, (ctx) => {
    ctx.scale(width / logicalWidth, 0.75);
    ctx.save();
    ctx.scale(logicalWidth / 512, 1);
    const samsung = p.brand === "samsung";
    const warm = /17-pro|16-pro/.test(p.id);
    const hue = p.id === "iphone" || p.year < 2015 ? "#219ba8" : warm ? "#ee8c56" : p.accent;
    const bg = ctx.createLinearGradient(0, 0, 400, 1024);
    bg.addColorStop(0, "#040914");
    bg.addColorStop(0.48, "#10202f");
    bg.addColorStop(1, "#020308");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 1024);
    // The nested arcs read as luminous, folded glass at device scale.
    ctx.save();
    ctx.translate(130, 650);
    ctx.rotate(samsung ? -0.48 : -0.28);
    for (let i = 8; i >= 0; i--) {
      const grad = ctx.createLinearGradient(-310, -200, 350, 300);
      grad.addColorStop(0, "#060c1c");
      grad.addColorStop(0.34, hue);
      grad.addColorStop(0.48, "#bac4c8");
      grad.addColorStop(0.53, hue);
      grad.addColorStop(0.8, "#142334");
      grad.addColorStop(1, "#01050e");
      ctx.strokeStyle = grad;
      ctx.globalAlpha = 0.6 + (8 - i) * 0.035;
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.ellipse(0, 0, 150 + i * 32, 285 + i * 38, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.translate((logicalWidth - 512) / 2, 0);
    if (p.year < 2013) {
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(0, 0, 512, 42);
      ctx.fillStyle = "#fff";
      ctx.font = "20px Arial";
      ctx.fillText(samsung ? "9:41" : "AT&T", 20, 29);
      ctx.textAlign = "center";
      ctx.fillText("9:41", 256, 29);
      const colors = [
        "#60a269",
        "#f3f1ed",
        "#e8a052",
        "#747f8b",
        "#80b2ca",
        "#d1af78",
        "#548dca",
        "#787b85",
        "#709955",
        "#61b7d5",
        "#996aa4",
        "#c7c9cb",
      ];
      const labels = samsung
        ? [
            "Phone",
            "Contacts",
            "Messages",
            "Camera",
            "Gallery",
            "Maps",
            "Internet",
            "Settings",
            "Music",
            "Weather",
            "Market",
            "Clock",
          ]
        : [
            "Messages",
            "Calendar",
            "Photos",
            "Camera",
            "YouTube",
            "Maps",
            "Weather",
            "Clock",
            "Notes",
            "Settings",
            "iTunes",
            "Calculator",
          ];
      colors.forEach((color, i) => {
        const x = 20 + (i % 4) * 124,
          y = 80 + Math.floor(i / 4) * 160;
        const g = ctx.createLinearGradient(x, y, x, y + 90);
        g.addColorStop(0, color);
        g.addColorStop(1, "#314153");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, 94, 94, 18);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.22)";
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, 88, 42, [16, 16, 8, 8]);
        ctx.fill();
        ctx.strokeStyle = "#f5f5f1";
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 27, y + 27, 40, 35);
        ctx.fillStyle = "white";
        ctx.font = "17px Arial";
        ctx.fillText(labels[i], x + 47, y + 121);
      });
      ctx.fillStyle = "rgba(221,235,245,.23)";
      ctx.fillRect(0, 865, 512, 159);
      (samsung ? ["Phone", "Contacts", "Messages", "Apps"] : ["Phone", "Mail", "Safari", "iPod"]).forEach((t, i) => {
        ctx.fillStyle = ["#58ac64", "#619adb", "#82bad3", "#e5a140"][i];
        ctx.beginPath();
        ctx.roundRect(20 + i * 124, 885, 94, 94, 18);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 38px Arial";
        ctx.fillText(["☎", "✉", "◈", "♫"][i], 67 + i * 124, 945);
        ctx.font = "17px Arial";
        ctx.fillText(t, 67 + i * 124, 1007);
      });
    } else {
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.textAlign = "center";
      ctx.font = samsung ? "300 111px Arial" : "500 119px Arial";
      ctx.fillText(samsung ? "12:45" : "9:41", 256, 250);
      ctx.font = "24px Arial";
      ctx.fillText("Tuesday, September 9", 256, 135);
      ctx.font = "15px Arial";
      ctx.fillText("Swipe up to open", 256, 928);
      ctx.fillStyle = "rgba(255,255,255,.76)";
      ctx.beginPath();
      ctx.roundRect(172, 987, 168, 6, 3);
      ctx.fill();
      for (const x of [64, 448]) {
        ctx.fillStyle = "rgba(240,244,249,.15)";
        ctx.beginPath();
        ctx.arc(x, 949, 24, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#fff";
      ctx.font = "20px Arial";
      ctx.fillText("⌁", 64, 956);
      ctx.fillText("▣", 448, 956);
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(450, 25, 29, 12);
    ctx.fillRect(481, 29, 3, 4);
  });
}

type ScreenUniforms = {
  innerA: { value: THREE.Texture | null };
  innerB: { value: THREE.Texture | null };
  mapB: { value: THREE.Texture | null };
  blend: { value: number };
  split: { value: number };
  panelHalf: { value: number };
  flip: { value: number };
  splitY: { value: number };
};
function screenMaterial(): { mat: THREE.MeshPhysicalMaterial; uniforms: ScreenUniforms } {
  const uniforms: ScreenUniforms = {
    innerA: { value: null },
    innerB: { value: null },
    mapB: { value: null },
    blend: { value: 0 },
    split: { value: 0 },
    panelHalf: { value: 1 },
    flip: { value: 0 },
    splitY: { value: 0.5 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: "#000000",
    roughness: 0.34,
    metalness: 0,
    specularIntensity: 0.12,
    envMapIntensity: 0.06,
    emissive: "#ffffff",
    emissiveIntensity: 1,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader =
      "uniform sampler2D mapB; uniform sampler2D innerA; uniform sampler2D innerB; uniform float blend; uniform float split; uniform float panelHalf; uniform float flip; uniform float splitY;\n" +
      shader.fragmentShader;
    const uv =
      "mix(vMapUv, mix(vec2(vMapUv.x * .5 + panelHalf * .5, vMapUv.y), vec2(vMapUv.x, vMapUv.y * mix(1.0 - splitY, splitY, panelHalf) + (1.0 - panelHalf) * splitY), flip), split)";
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `vec2 phoneUv = ${uv}; vec4 phoneTexel = mix(mix(texture2D(map, vMapUv), texture2D(mapB, vMapUv), blend), mix(texture2D(innerA, phoneUv), texture2D(innerB, phoneUv), blend), split); diffuseColor *= phoneTexel;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "totalEmissiveRadiance *= phoneTexel.rgb;",
    );
  };
  return { mat, uniforms };
}

class Optic {
  group = new THREE.Group();
  private glass: THREE.Mesh;
  constructor(parent: THREE.Object3D, simple = false) {
    parent.add(this.group);
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.25, 40),
      material("#636971", 0.92, 0.21),
    );
    cylinder.rotation.x = Math.PI / 2;
    this.group.add(cylinder);
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.87, 0.87, 0.28, 40),
      material("#07090c", 0.35, 0.18),
    );
    inner.rotation.x = Math.PI / 2;
    inner.position.z = 0.035;
    this.group.add(inner);
    const tex = canvasTexture(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(51, 46, 4, 64, 64, 65);
      g.addColorStop(0, simple ? "#fff9d8" : "#050916");
      g.addColorStop(0.35, simple ? "#f5e8ba" : "#090d16");
      g.addColorStop(0.48, simple ? "#e8d5a4" : "#34485e");
      g.addColorStop(0.55, simple ? "#ddd2af" : "#111625");
      g.addColorStop(0.78, simple ? "#ede4cb" : "#0a1830");
      g.addColorStop(1, "#070a13");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      if (!simple) {
        ctx.fillStyle = "rgba(138,174,208,.65)";
        ctx.beginPath();
        ctx.ellipse(42, 39, 10, 4, -0.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(109,80,194,.48)";
        ctx.beginPath();
        ctx.ellipse(84, 82, 7, 4, -0.6, 0, TAU);
        ctx.fill();
      }
    });
    this.glass = new THREE.Mesh(
      new THREE.CircleGeometry(0.76, 40),
      new THREE.MeshPhysicalMaterial({
        map: tex,
        roughness: 0.1,
        metalness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMapIntensity: 0.6,
      }),
    );
    this.glass.position.z = 0.19;
    this.group.add(this.glass);
  }
  set(x: number, y: number, z: number, r: number, opacity: number) {
    this.group.visible = opacity > 0.005;
    this.group.position.set(x, y, z);
    this.group.scale.setScalar(Math.max(0.001, r * opacity));
  }
}

/** Blend the attachment basis while a closed body changes its folding axis.
 * Rotating the whole rig would swing its long lever arm outside the phone.
 * The affine blend instead contracts the details through the shell; at either
 * endpoint it is the exact rigid transform used by the physical folding lid.
 */
function poseAttachment(rig: THREE.Group, weight: number, y: number, z: number, angle: number) {
  rig.position.set(0, y * weight, z * weight);
  rig.rotation.set(angle, 0, 0);
  rig.updateMatrix();
  const e = rig.matrix.elements;
  for (let i = 0; i < 12; i++) e[i] = THREE.MathUtils.lerp(i % 5 === 0 ? 1 : 0, e[i], weight);
  rig.matrixAutoUpdate = false;
}

export class PhoneModel {
  root = new THREE.Group();
  private frame = panel(this.root, material("#aaa", 0.85, 0.25), "shell");
  private back = panel(
    this.root,
    new THREE.MeshPhysicalMaterial({
      color: "#999",
      metalness: 0.22,
      roughness: 0.32,
      clearcoat: 0.2,
      clearcoatRoughness: 0.34,
      envMapIntensity: 0.3,
    }),
    "shell",
  );
  private backFinish = {
    shellTop: { value: 0 }, shellBottom: { value: 0 },
    shellTopOpacity: { value: 0 }, shellBottomOpacity: { value: 0 },
    shellTopColor: { value: new THREE.Color() }, shellBottomColor: { value: new THREE.Color() },
  };
  private face = panel(this.root, glassMaterial("#050608"), "glass");
  private screenShader = screenMaterial();
  private screen = panel(this.root, this.screenShader.mat, "glass");
  private rear = new THREE.Group();
  private cameraRig = new THREE.Group();
  private module: Panel;
  private bottomStrip: Panel;
  private topStrip: Panel;
  private optics: Optic[];
  private flash: Optic;
  private sensor: Optic;
  private sensorPad: Panel;
  private logo: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private appleLogo = logoTexture(false);
  private samsungLogo = logoTexture(true);
  private notch = panel(this.root, glassMaterial("#010203", 0.5, 0.05));
  private home = panel(this.root, glassMaterial("#08090c", 0.38, 0.2));
  private homeMark = panel(this.root, material("#5a6068", 0.6, 0.28));
  private homeMarkInset = panel(this.root, glassMaterial("#08090c", 0.55, 0.05));
  private homeOutline = panel(this.root, material("#44464a", 0.05, 0.65));
  private ear = panel(this.root, glassMaterial("#020304", 0.7, 0.05));
  private frontCamera = new Optic(this.root);
  private keyRig = new THREE.Group();
  private keys = Array.from({ length: 4 }, () => panel(this.keyRig, material("#777", 0.8, 0.26)));
  private topKey = panel(this.root, material("#bbb", 0.65, 0.35));
  private cameraControl = panel(this.keyRig, material("#777", 0.1, 0.65));
  private port = panel(this.root, material("#020304", 0.1, 0.4));
  private antennae = Array.from({ length: 4 }, () => panel(this.root, material("#aaa", 0.15, 0.7)));
  private wingPivot = new THREE.Group();
  private wingVolumeKeys = Array.from({ length: 2 }, () => panel(this.wingPivot, material("#777", 0.8, 0.26)));
  private wingFrame = panel(this.wingPivot, this.frame.material, "shell");
  private wingBack = panel(this.wingPivot, this.back.material, "shell");
  private wingFace = panel(this.wingPivot, this.face.material, "glass");
  private wingNotch = panel(this.wingPivot, this.notch.material);
  private wingShader = screenMaterial();
  private wingScreen = panel(this.wingPivot, this.wingShader.mat, "glass");
  private coverShader = screenMaterial();
  private coverScreen = panel(this.wingPivot, this.coverShader.mat);
  private coverFace = panel(this.wingPivot, glassMaterial("#050608"));
  private coverNotch = panel(this.wingPivot, this.notch.material);
  private hinge = new THREE.Mesh(new HingeSpineGeometry(), material("#a3a7ac", 0.85, 0.3));
  private crease = panel(
    this.root,
    new THREE.MeshStandardMaterial({
      color: "#0d1119",
      transparent: true,
      opacity: 0.16,
      roughness: 0.15,
      envMapIntensity: 0.02,
    }),
  );
  private backInset: Panel;
  private grille: THREE.Mesh[] = [];

  constructor() {
    // Paint rear caps on the enclosure itself so they share its exact curvature.
    this.back.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.backFinish);
      shader.vertexShader = "varying float shellY;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>",
        "#include <uv_vertex>\nshellY = uv.y;");
      shader.fragmentShader = `varying float shellY;
        uniform float shellTop, shellBottom, shellTopOpacity, shellBottomOpacity;
        uniform vec3 shellTopColor, shellBottomColor;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
        #include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, shellTopColor, step(1.0-shellTop, shellY)*shellTopOpacity);
        diffuseColor.rgb = mix(diffuseColor.rgb, shellBottomColor, step(shellY, shellBottom)*shellBottomOpacity);
      `);
    };
    this.back.material.customProgramCacheKey = () => "phone-shell-caps-v1";
    this.coverShader.mat.transparent = true;
    this.coverFace.material.transparent = true;
    this.notch.material.envMapIntensity = 0;
    this.ear.material.envMapIntensity = 0;
    this.root.add(this.rear);
    this.rear.rotation.y = Math.PI;
    this.rear.add(this.cameraRig);
    this.module = panel(this.cameraRig, material("#888", 0.45, 0.3));
    this.bottomStrip = panel(this.rear, material("#14151b", 0.1, 0.26));
    this.topStrip = panel(this.rear, material("#14151b", 0.1, 0.26));
    this.backInset = panel(this.rear, material("#888", 0.15, 0.38));
    this.optics = Array.from({ length: 4 }, () => new Optic(this.cameraRig));
    this.flash = new Optic(this.cameraRig, true);
    this.sensor = new Optic(this.cameraRig);
    this.sensorPad = panel(this.cameraRig, glassMaterial("#07080b", 0.65, 0.05));
    this.logo = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.5),
      new THREE.MeshStandardMaterial({
        map: this.appleLogo,
        transparent: true,
        depthWrite: false,
        color: "#999",
        metalness: 0.55,
        roughness: 0.25,
        envMapIntensity: 0.35,
      }),
    );
    this.rear.add(this.logo);
    this.root.add(this.wingPivot);
    this.root.add(this.hinge);
    this.hinge.material.transparent = true;
    this.hinge.material.side = THREE.DoubleSide;
    this.root.add(this.keyRig);
    for (let i = 0; i < 12; i++) {
      const hole = new THREE.Mesh(
        new THREE.SphereGeometry(0.023, 8, 6),
        material("#0b0d10", 0.1, 0.5),
      );
      this.root.add(hole);
      this.grille.push(hole);
    }
  }

  update(
    a: PhoneSpec,
    b: PhoneSpec,
    t: number,
    textureA: THREE.Texture,
    textureB: THREE.Texture,
    open: number,
    isDisplay: boolean,
  ) {
    const num = (fn: (p: PhoneSpec) => number) => THREE.MathUtils.lerp(fn(a), fn(b), t);
    const col = (target: THREE.Color, fn: (p: PhoneSpec) => string) =>
      target.set(fn(a)).lerp(new THREE.Color(fn(b)), t);
    const p = t < 0.5 ? a : b;
    const book = num((v) => (v.fold?.axis === "book" ? 1 : 0)) * (isDisplay ? 1 : 0);
    const flip = num((v) => (v.fold?.axis === "flip" ? 1 : 0)) * (isDisplay ? 1 : 0);
    const foldWeight = book + flip;
    // Retain two matching halves through a Flip/slab morph. Shrinking only the
    // lid used to leave full-sized screens and controls suspended above it.
    const flipSlab = isDisplay && ((a.fold?.axis === "flip" && !b.fold)
      || (b.fold?.axis === "flip" && !a.fold));
    const isFlip = flipSlab || (flip > 0.001 && flip >= book);
    // Choreography changes fold axes while closed. Attachments still need a
    // continuous path between the rear shell and the clamshell's moving lid.
    const attachmentFlip = flipSlab ? 1 : a.fold && b.fold && foldWeight > 0
      ? flip / foldWeight : Number(isFlip);
    const baseW = num((v) => v.body.w) / 100,
      baseH = num((v) => v.body.h) / 100;
    const w =
      num((v) => (isDisplay && v.fold?.axis === "book" ? v.fold.openWidth / 2 : v.body.w)) / 100;
    const h = baseH * (1 - 0.5 * (flipSlab ? 1 : flip));
    const r = Math.min(num((v) => v.body.r) / 100, h / 3);
    const d = num((v) => (v.thickness ?? 8) * 4.2) / 100;
    const z = d / 2;
    const profile = mixBodyProfile(a, b, t);
    const measuredFold = num((v) => Number(!!v.fold?.closedThickness));
    const clearance = num((v) => v.fold?.closedThickness
      ? (v.fold.closedThickness - 2 * (v.thickness ?? 8)) * 4.2 / 100
      : 0.08);
    const pose = hingePose(open, d, foldWeight, clearance);
    // The measured closed stack leaves much less room between the inner panels.
    // Keep their thin dielectric layers inside that space instead of inflating the hinge.
    const faceDepth = THREE.MathUtils.lerp(0.035, 0.008, measuredFold);
    const faceZ = z - 0.004 * measuredFold;
    const screenDepth = THREE.MathUtils.lerp(0.009, 0.004, measuredFold);
    const screenZ = z + THREE.MathUtils.lerp(0.024, 0.003, measuredFold);
    const notchDepth = THREE.MathUtils.lerp(0.015, 0.003, measuredFold);
    const notchZ = z + THREE.MathUtils.lerp(0.038, 0.006, measuredFold);
    const backDepth = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.025, 0.004, measuredFold), 0.004, profile.weight);
    const backZ = THREE.MathUtils.lerp(-z + THREE.MathUtils.lerp(-0.008, 0.002, measuredFold), -z, profile.weight);
    // Leave room for the glass skins inside the nominal thickness. A metal cap
    // coplanar with the back glass produces flickering triangular reflections.
    const frameDepth = d - 0.024 * measuredFold;
    // Both existing folding halves retain equal dimensions when their hinge axis changes.
    const wingHeight = flipSlab || (a.fold && b.fold) ? h : isFlip ? Math.max(0.005, (baseH * flip) / 2) : h;
    const flat = isFlip ? "top" : book > 0 ? "left" : "none";
    const flatStrength = (flipSlab ? 1 : foldWeight) * open;
    const seamWeld = flipSlab ? (1 - flip) * THREE.MathUtils.smootherstep(open, 0.85, 1) : 0;
    const coverW = num((v) => v.fold?.coverScreen?.w ?? ((v.fold?.axis === "book" ? v.fold.openWidth / 2 : v.body.w) - 10)) / 100;
    const coverH = num((v) => v.fold?.coverScreen?.h ?? ((v.fold?.axis === "flip" || flipSlab ? v.body.h / 2 : v.body.h) - 10)) / 100;
    const coverDepth = THREE.MathUtils.lerp(0.012, 0.004, measuredFold);
    const coverZ = flipSlab ? backZ - backDepth / 2 + 0.005 * flip - 0.006 * (1 - flip) : -z + THREE.MathUtils.lerp(
      -THREE.MathUtils.lerp(0.029, 0.09, attachmentFlip), 0.005, measuredFold);
    // The catalogue stores a full rim stroke in model pixels; half is the per-side inset.
    const glassInset = num((v) => v.front.frame.w) / 200;
    const surface: SurfaceProfile = { profile, w, h, d: frameDepth, r };
    const rearInset = THREE.MathUtils.lerp(0.0325, 0.001, profile.weight);
    size(this.frame, w, h, frameDepth, r, 0, 0, 0, flat, flatStrength, seamWeld, surface);
    size(this.back, w - rearInset * 2, h - rearInset * 2 + 0.0325 * seamWeld, backDepth,
      r - THREE.MathUtils.lerp(0.025, 0.001, profile.weight),
      0, 0.01625 * seamWeld, backZ, flat, flatStrength, seamWeld, { ...surface, skin: true });
    size(
      this.face,
      w - 2 * glassInset,
      h - 2 * glassInset + glassInset * seamWeld,
      faceDepth,
      r - glassInset,
      0,
      glassInset * seamWeld / 2,
      faceZ,
      flat,
      flatStrength,
      seamWeld,
      { ...surface, glass: true },
    );
    col(this.frame.material.color, (v) => v.band.color);
    col(this.face.material.color, (v) => v.front.face);
    col(this.coverFace.material.color, (v) => v.front.face);
    // The black display mask is a dielectric, not another polished metal edge.
    // Finish values interpolate along with the silhouette, including brand switches.
    const polished = num((v) => (/polished|stainless|steel/i.test(v.material ?? "") ? 1 : 0));
    const plastic = num((v) => (/polycarbonate/i.test(v.material ?? "") ? 1 : 0));
    this.frame.material.metalness = 0.9 - 0.86 * plastic;
    this.frame.material.roughness = 0.38 - 0.15 * polished;
    this.frame.material.envMapIntensity = 0.42 + 0.1 * polished;
    col(this.back.material.color, (v) => v.body.color);
    this.back.material.roughness = num((v) => 0.14 + (1 - v.body.curve) * 0.29);
    this.back.material.metalness = num((v) => /polycarbonate|glass/i.test(v.material ?? "") ? 0.02 : 0.5);
    this.back.material.clearcoat = 0.2 + 0.35 * plastic;
    // The first two iPhones have a chrome front rim even around a plastic rear.
    const chromeRim = num((v) => Number(v.id === "iphone" || v.id === "iphone-3gs"));
    this.frame.material.color.lerp(new THREE.Color("#bfc2c5"), chromeRim);
    this.frame.material.metalness = THREE.MathUtils.lerp(this.frame.material.metalness, 0.86, chromeRim);
    this.frame.material.roughness = THREE.MathUtils.lerp(this.frame.material.roughness, 0.26, chromeRim);
    const innerWidth = (v: PhoneSpec) => v.fold?.innerScreen
      ? v.fold.innerScreen.w / (v.fold.axis === "book" ? 2 : 1) / 100
      : v.fold?.axis === "book" ? v.fold.openWidth / 200 - 0.075
        : v.body.w * v.front.screen.wF / 100;
    const innerHeight = (v: PhoneSpec) => v.fold?.innerScreen
      ? v.fold.innerScreen.h / (v.fold.axis === "flip" ? 2 : 1) / 100
      : v.fold ? v.body.h / (v.fold.axis === "flip" ? 2 : 1) / 100 - 0.075
        : v.body.h * v.front.screen.hF / 100;
    const hasMeasuredDisplay = num((v) => Number(!!v.fold?.innerScreen));
    const fullWidth = num((v) => v.fold?.innerScreen?.w ?? v.body.w * v.front.screen.wF) / 100;
    const topInset = num((v) => v.fold?.innerScreen
      ? (v.body.h - v.fold.innerScreen.h) / 2 : v.body.h * v.front.screen.yF) / 100;
    const bottomInset = num((v) => v.fold?.innerScreen
      ? (v.body.h - v.fold.innerScreen.h) / 2
      : v.body.h * (1 - v.front.screen.yF - v.front.screen.hF)) / 100;
    const sw = flipSlab ? fullWidth : THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(w * num((v) => v.front.screen.wF), w - 0.075, book),
      num(innerWidth), hasMeasuredDisplay);
    const sh = flipSlab ? h - bottomInset : THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(h * num((v) => v.front.screen.hF), h - 0.075, foldWeight),
      num(innerHeight), hasMeasuredDisplay);
    const sx = flipSlab ? 0 : THREE.MathUtils.lerp(-0.032 * book, -(w - sw) * book / 2, hasMeasuredDisplay);
    const sy = flipSlab ? bottomInset / 2 : THREE.MathUtils.lerp(
      h / 2 - h * num((v) => v.front.screen.yF) - sh / 2,
      THREE.MathUtils.lerp(0.032 * flip, (h - sh) * flip / 2, hasMeasuredDisplay),
      foldWeight,
    );
    const screenRadius = Math.min(r - THREE.MathUtils.lerp(0.07, 0.005, hasMeasuredDisplay),
      num((v) => v.fold?.innerScreen?.r ?? v.front.screen.r) / 100);
    size(
      this.screen,
      sw,
      sh,
      screenDepth,
      screenRadius,
      sx,
      sy,
      screenZ,
      flat,
      flatStrength,
      seamWeld,
      { ...surface, glass: true },
    );
    for (const shader of [this.screenShader, this.wingShader, this.coverShader]) {
      const mapA = shader === this.coverShader ? (textureA.userData.cover ?? textureA) : textureA;
      const mapB = shader === this.coverShader ? (textureB.userData.cover ?? textureB) : textureB;
      if (shader.mat.map !== mapA) {
        const hadMap = !!shader.mat.map;
        shader.mat.map = mapA;
        if (!hadMap) shader.mat.needsUpdate = true;
      }
      shader.uniforms.mapB.value = mapB;
      shader.uniforms.blend.value = t;
      shader.uniforms.innerA.value = textureA.userData.inner ?? textureA;
      shader.uniforms.innerB.value = textureB.userData.inner ?? textureB;
      shader.uniforms.split.value = flipSlab ? 1 : foldWeight;
      shader.uniforms.flip.value = flipSlab ? 1 : foldWeight ? flip / foldWeight : 0;
      shader.uniforms.splitY.value = flipSlab ? sh / (sh + wingHeight - topInset) : 0.5;
    }
    this.wingShader.uniforms.panelHalf.value = 0;
    this.coverShader.uniforms.split.value = 0;
    this.coverShader.mat.emissiveIntensity = 1 - (flipSlab ? 1 : flip) * THREE.MathUtils.smoothstep(open, 0.15, 0.7);
    const coverOpacity = flipSlab ? THREE.MathUtils.smootherstep(flip, 0, 1) : 1;
    this.coverShader.mat.opacity = coverOpacity;
    this.coverShader.mat.depthWrite = coverOpacity === 1;
    this.coverFace.material.opacity = coverOpacity;
    this.coverFace.material.depthWrite = coverOpacity === 1;
    const notchW = sw * num((v) => v.front.notch.wF);
    const notchH = num((v) => v.front.notch.h) / 100;
    const notchY = sy + sh / 2 - num((v) => v.front.notch.y) / 100 - notchH / 2;
    this.notch.visible = !flipSlab && num((v) => v.front.notch.o) > 0.01 && flip < 0.5;
    const notchX = sw * num((v) => v.front.notch.xF ?? 0);
    size(
      this.notch,
      notchW,
      notchH,
      notchDepth,
      num((v) => v.front.notch.r) / 100,
      notchX,
      notchY,
      notchZ,
    );
    this.notch.scale.setScalar(
      Math.max(
        0.001,
        num((v) => v.front.notch.o),
      ),
    );
    const homeO = num((v) => v.front.home.o),
      homeY = -h / 2 + ((1 - num((v) => v.front.screen.yF + v.front.screen.hF)) * (flipSlab ? baseH : h)) / 2;
    const homeR = num((v) => v.front.home.r) / 100;
    const samsungHome = num((v) => Number(v.brand === "samsung"));
    const homeWidth = homeR * THREE.MathUtils.lerp(2, 2.7, samsungHome);
    const homeHeight = homeR * THREE.MathUtils.lerp(2, 1.1, samsungHome);
    const homeRadius = THREE.MathUtils.lerp(homeR, 0.07, samsungHome);
    size(this.homeOutline, homeWidth + 0.018, homeHeight + 0.018, 0.009,
      homeRadius + 0.009, 0, homeY, z + 0.026);
    this.homeOutline.scale.setScalar(Math.max(0.001, homeO));
    this.homeOutline.visible = homeO > 0;
    size(
      this.home,
      homeWidth,
      homeHeight,
      0.022,
      homeRadius,
      0,
      homeY,
      z + 0.032,
    );
    this.home.scale.setScalar(Math.max(0.001, homeO));
    this.home.visible = homeO > 0;
    size(this.homeMark, homeR * 0.72, homeR * 0.72, 0.005, 0.025, 0, homeY, z + 0.046);
    this.homeMark.scale.setScalar(
      Math.max(
        0.001,
        num((v) => v.front.home.squareO),
      ),
    );
    this.homeMark.visible = num((v) => v.front.home.squareO) > 0;
    size(this.homeMarkInset, homeR * 0.58, homeR * 0.58, 0.003, 0.019, 0, homeY, z + 0.0505);
    this.homeMarkInset.scale.copy(this.homeMark.scale);
    this.homeMarkInset.visible = this.homeMark.visible;
    const earY = flipSlab ? 1.5 * h - topInset / 2 : h / 2 - (h * num((v) => v.front.screen.yF)) / 2;
    size(this.ear, num((v) => v.front.ear.w) / 100, 0.052, 0.025, 0.025, 0, earY, z + 0.028);
    this.ear.scale.setScalar(
      Math.max(
        0.001,
        num((v) => v.front.ear.o),
      ),
    );
    // Invisible legacy controls must not enlarge the folding phone's bounds.
    this.ear.visible = num((v) => v.front.ear.o) > 0;
    this.frontCamera.set(
      w * (num((v) => v.front.fcam.xF) - 0.5),
      earY + num((v) => v.front.fcam.yF === undefined ? 0
        : v.body.h / 100 * (v.front.screen.yF / 2 - v.front.fcam.yF)),
      z + 0.039,
      0.04,
      num((v) => v.front.fcam.o),
    );

    poseAttachment(this.cameraRig, attachmentFlip, h / 2 + pose.shift, -pose.lift, -pose.angle);
    const cameraTop = THREE.MathUtils.lerp(h / 2, wingHeight, attachmentFlip);
    const mx = num((v) => v.module.x + v.module.w / 2) / 100 - baseW / 2;
    const my = cameraTop - num((v) => v.module.y + v.module.h / 2) / 100;
    const frameBevel = Math.min(frameDepth * 0.22, 0.035, r * 0.4);
    const rearDrop = (x: number, y: number) => profile.weight > 0
      ? rearSurfaceDrop(x, y, w, h, r,
        frameBevel * (1 - profile.weight) + profile.roll,
        frameBevel * (1 - profile.weight) + profile.rise) : 0;
    const moduleO = num((v) => v.module.o);
    size(
      this.module,
      num((v) => v.module.w) / 100,
      num((v) => v.module.h) / 100,
      0.085,
      num((v) => v.module.r) / 100,
      mx,
      my,
      // On a measured Flip the large black plate backs the cover glass; it is
      // inside the body rather than another opaque panel above the display.
      z + 0.035 - 0.0895 * measuredFold * attachmentFlip - rearDrop(mx, my),
    );
    this.module.scale.z = Math.max(0.001, moduleO);
    this.module.visible = moduleO > 0.01;
    col(this.module.material.color, (v) => v.module.color);
    const insetO = num((v) => (/iphone-(17|18)-pro/.test(v.id) ? 1 : 0));
    size(this.backInset, w * 0.89, h * 0.63, 0.006, r * 0.7, 0, -h * 0.135, z + 0.028);
    this.backInset.visible = insetO > 0.01;
    col(this.backInset.material.color, (v) => v.body.color);
    this.backInset.material.color.multiplyScalar(0.9);
    // The Flip camera plate is recessed behind its outer display. Seat each
    // optic's barrel on that glass instead of leaving the old raised-plate gap.
    const slab = flipSlab ? (a.fold ? b : a) : null;
    const opticZ = (radius: number, opacity: number, raisedOffset: number, x: number, y: number,
      target: { x: number; y: number; r: number; o: number } | undefined, isFlash = false) => {
      const barrelHalf = 0.125 * Math.max(0.001, radius * opacity);
      const flushCamera = num((v) => Number(v.brand === "apple" && v.year <= 2012));
      const legacyMount = -backZ + backDepth / 2 + barrelHalf + 0.001;
      const natural = THREE.MathUtils.lerp(z + THREE.MathUtils.lerp(raisedOffset,
        -0.003 + barrelHalf, measuredFold * attachmentFlip), legacyMount, flushCamera) - rearDrop(x, y);
      if (!slab || !target) return natural;

      // Follow the actual surface beneath each lens as the wide Flip cover
      // becomes a narrower camera island. Preserve only its authored endpoint
      // stand-off, rather than letting a new lens hover over the shrinking plate.
      const coverage = (cx: number, cy: number, width: number, height: number) =>
        THREE.MathUtils.smootherstep(Math.min(width / 2 - Math.abs(x - cx), height / 2 - Math.abs(y - cy)),
          0, Math.max(0.001, radius * opacity));
      let mount = Math.max(frameDepth / 2, -backZ - 0.018 * measuredFold * flip * flip + backDepth / 2);
      const coverMount = -coverZ + coverDepth / 2;
      mount += Math.max(0, coverMount - mount)
        * coverage(0, wingHeight / 2, THREE.MathUtils.lerp(w - 0.1, coverW, measuredFold),
          THREE.MathUtils.lerp(wingHeight - 0.1, coverH, measuredFold))
        * THREE.MathUtils.smootherstep(coverOpacity, 0.001, 0.2);
      if (moduleO > 0) {
        const plateMount = this.module.position.z + 0.0425 * moduleO;
        mount += Math.max(0, plateMount - mount)
          * coverage(mx, my, num((v) => v.module.w) / 100, num((v) => v.module.h) / 100);
      }
      const slabZ = (slab.thickness ?? 8) * 4.2 / 200;
      const inPlate = slab.module.o > 0
        && target.x >= slab.module.x && target.x <= slab.module.x + slab.module.w
        && target.y >= slab.module.y && target.y <= slab.module.y + slab.module.h;
      const targetMount = Math.max(slabZ + 0.0205, inPlate ? slabZ + 0.035 + 0.0425 * slab.module.o : 0);
      const targetOrigin = slabZ + (isFlash ? 0.08 : 0.07 + slab.module.o * 0.055);
      const targetGap = Math.max(0, targetOrigin - 0.125 * Math.max(0.001, target.r * target.o / 100) - targetMount);
      return Math.min(natural, mount + barrelHalf + targetGap * (1 - flip));
    };
    this.optics.forEach((optic, i) => {
      const slot = (v: PhoneSpec) =>
        (i < 3 ? v.lenses[i] : v.extraLens) ?? { x: 55, y: 55, r: 8, o: 0 };
      const radius = num((v) => slot(v).r) / 100;
      const opacity = num((v) => slot(v).o);
      const x = num((v) => slot(v).x) / 100 - baseW / 2;
      const y = cameraTop - num((v) => slot(v).y) / 100;
      optic.set(
        x,
        y,
        opticZ(radius, opacity, 0.07 + moduleO * 0.055, x, y, slab ? slot(slab) : undefined),
        radius,
        opacity,
      );
    });
    this.flash.set(
      num((v) => v.flash.x) / 100 - baseW / 2,
      cameraTop - num((v) => v.flash.y) / 100,
      opticZ(num((v) => v.flash.r) / 100, num((v) => v.flash.o), THREE.MathUtils.lerp(0.08, 0.12, flipSlab ? flip : attachmentFlip),
        num((v) => v.flash.x) / 100 - baseW / 2, cameraTop - num((v) => v.flash.y) / 100, slab?.flash, true),
      num((v) => v.flash.r) / 100,
      num((v) => v.flash.o),
    );
    this.sensor.set(
      num((v) => v.sensor.x) / 100 - baseW / 2,
      cameraTop - num((v) => v.sensor.y) / 100,
      z + 0.08 - rearDrop(num((v) => v.sensor.x) / 100 - baseW / 2, cameraTop - num((v) => v.sensor.y) / 100),
      num((v) => v.sensor.r) / 100,
      num((v) => v.sensor.o * Number(!v.sensorShape || v.sensorShape === "optical")),
    );
    const padO = num((v) => v.sensor.o * Number(v.sensorShape === "flat" || v.sensorShape === "fingerprint"));
    const fingerprint = num((v) => Number(v.sensorShape === "fingerprint"));
    const padRadius = num((v) => v.sensor.r) / 100;
    size(this.sensorPad, padRadius * 2, padRadius * (2 + 0.35 * fingerprint), 0.012,
      THREE.MathUtils.lerp(padRadius, 0.065, fingerprint),
      num((v) => v.sensor.x) / 100 - baseW / 2,
      cameraTop - num((v) => v.sensor.y) / 100,
      z + 0.032 - rearDrop(num((v) => v.sensor.x) / 100 - baseW / 2, cameraTop - num((v) => v.sensor.y) / 100));
    this.sensorPad.visible = padO > 0;
    this.sensorPad.scale.setScalar(Math.max(0.000001, padO));
    this.logo.material.map = p.brand === "samsung" ? this.samsungLogo : this.appleLogo;
    col(this.logo.material.color, (v) => v.logo.color);
    const logoY = h * (0.5 - num((v) => v.logo.yFrac));
    this.logo.position.set(0, flipSlab
      ? THREE.MathUtils.lerp(baseH * (0.75 - num((v) => v.logo.yFrac)), logoY, flip)
      : logoY, THREE.MathUtils.lerp(z + 0.035, -backZ + backDepth / 2 + 0.001, profile.weight) - rearDrop(0, logoY));
    this.logo.scale.setScalar(num((v) => v.logo.scale) * 0.53);
    this.topStrip.visible = this.bottomStrip.visible = false;
    this.backFinish.shellTop.value = num((v) => v.topStrip.hFrac);
    this.backFinish.shellBottom.value = num((v) => v.bottomStrip.hFrac);
    this.backFinish.shellTopOpacity.value = num((v) => v.topStrip.o);
    this.backFinish.shellBottomOpacity.value = num((v) => v.bottomStrip.o);
    col(this.backFinish.shellTopColor.value, (v) => v.topStrip.color);
    col(this.backFinish.shellBottomColor.value, (v) => v.bottomStrip.color);
    poseAttachment(this.keyRig, attachmentFlip, h / 2 + pose.shift, pose.lift, pose.angle);
    const duoControls = num((v) => Number(v.id === "iphone-duo"));
    this.keys.forEach((key, i) => {
      const keySlot = (v: PhoneSpec) => {
        if (v.id === "iphone-duo") return { side: i === 0 ? 1 : -1,
          yF: i === 0 ? 0.32 : 0, h: i === 0 ? 48 : 28, o: Number(i < 3) };
        if (v.sideKeys) return v.sideKeys[i] ?? { side: 1, yF: 0.3, h: 0, o: 0 };
        if (v.brand === "apple" && v.year <= 2012) {
          const rocker = v.year <= 2009;
          return { side: -1, yF: i === 1 ? 0.27 : i === 2 ? 0.17 : 0.35,
            h: i === 1 ? (rocker ? 48 : 20) : i === 2 ? 18 : 20,
            o: Number(i === 1 || i === 2 || (i === 3 && !rocker)) };
        }
        return { side: i === 0 ? 1 : -1, yF: i === 0 ? 0.26 : i === 3 ? 0.17 : 0.27 + (i - 1) * 0.09,
          h: i === 0 ? v.power.h : i === 3 ? v.mute.h : 40, o: 1 };
      };
      const visibility = num((v) => keySlot(v).o);
      const circularVolume = num((v) => Number(v.brand === "apple" && (v.id === "iphone-4" || v.id === "iphone-5") && (i === 1 || i === 3)));
      const earlyRail = num((v) => Number(v.brand === "apple" && v.year <= 2009));
      const faceWidth = THREE.MathUtils.lerp(d * THREE.MathUtils.lerp(0.22, i === 0 ? 0.42 : 0.22, duoControls), 0.20, circularVolume);
      const keyLength = num((v) => keySlot(v).h) / 100;
      const topVolume = i === 1 || i === 2 ? duoControls : 0;
      size(
        key,
        faceWidth,
        keyLength,
        0.045,
        Math.min(faceWidth, keyLength) / 2,
        THREE.MathUtils.lerp(num((v) => keySlot(v).side) * (w / 2 + 0.015), w * (0.02 + (i - 1) * 0.12), topVolume),
        THREE.MathUtils.lerp(baseH * (0.5 - num((v) => keySlot(v).yF)), h / 2 + 0.009, topVolume),
        d * 0.21 * earlyRail,
      );
      col(key.material.color, (v) => v.band.color);
      // Round the Y/Z contact face seen from the edge, not the narrow X/Y extrusion.
      key.quaternion.copy(SIDE_KEY_ROTATION).slerp(TOP_VOLUME_ROTATION, topVolume);
      key.visible = visibility > 0.01;
      key.scale.setScalar(Math.max(0.001, visibility));
    });
    const topSleep = num((v) => Number(v.brand === "apple" && v.year <= 2012));
    size(this.topKey, num((v) => v.power.w) / 100, d * 0.22, 0.038, d * 0.11,
      num((v) => v.power.x + v.power.w / 2 - v.body.w / 2) / 100,
      h / 2 + 0.009, d * 0.21 * profile.weight);
    this.topKey.rotation.x = Math.PI / 2;
    this.topKey.scale.setScalar(Math.max(0.001, topSleep));
    this.topKey.visible = topSleep > 0;
    const cameraControlO = num((v) => v.brand === "apple" ? v.camCtl.o : 0);
    size(this.cameraControl, d * 0.28, num((v) => v.camCtl.h) / 100, 0.018, d * 0.14,
      w / 2 + 0.004, baseH * (0.5 - num((v) => v.camCtl.yF)), 0);
    this.cameraControl.rotation.y = Math.PI / 2;
    col(this.cameraControl.material.color, (v) => v.band.color);
    this.cameraControl.material.color.multiplyScalar(0.65);
    this.cameraControl.scale.setScalar(Math.max(0.001, cameraControlO));
    this.cameraControl.visible = cameraControlO > 0;
    size(this.port, num((v) => v.brand === "samsung" ? (v.year < 2017 ? 0.3 : 0.36) : v.year < 2012 ? 0.78 : 0.36), 0.1, 0.015, 0.035, 0, -h / 2 - 0.001, d * 0.21 * profile.weight);
    this.port.rotation.x = Math.PI / 2;
    this.grille.forEach((hole, i) =>
      hole.position.set((i < 6 ? -1 : 1) * (0.4 + (i % 6) * 0.09), -h / 2, d * 0.21 * profile.weight),
    );
    this.antennae.forEach((part, i) => {
      const antennaOpacity = num((v) => Number(!/polycarbonate/i.test(v.material ?? "") && !(v.brand === "apple" && v.year <= 2009)));
      part.visible = antennaOpacity > 0;
      part.scale.setScalar(Math.max(0.001, antennaOpacity));
      size(
        part,
        0.009,
        0.039,
        d + 0.005,
        0.003,
        (i % 2 ? 1 : -1) * (w / 2 + 0.004),
        flipSlab ? THREE.MathUtils.lerp(baseH * ((i < 2 ? 0.35 : -0.35) + 0.25), h * (i < 2 ? 0.35 : -0.35), flip)
          : h * (i < 2 ? 0.35 : -0.35),
        0,
      );
    });

    // A physical second panel rotates about the hinge, instead of stretching a flat image.
    this.wingPivot.visible = flipSlab || foldWeight > 0.01;
    this.hinge.visible = foldWeight > 0;
    this.crease.visible = foldWeight > 0.01 && open > 0.5;
    const changingFoldAxis = !!a.fold && !!b.fold && a.fold.axis !== b.fold.axis;
    const spineWeight = THREE.MathUtils.smootherstep(foldWeight, 0, 1)
      * (changingFoldAxis ? THREE.MathUtils.smootherstep(Math.abs(book - flip), 0, 1) : 1);
    this.hinge.scale.setScalar(spineWeight);
    this.hinge.material.opacity = spineWeight;
    this.hinge.material.depthWrite = spineWeight === 1;
    this.crease.material.opacity = 0.16 * (flipSlab ? flip : 1);
    this.wingPivot.scale.set(1, 1, flipSlab ? 1 : Math.max(0.001, foldWeight));
    const wingX = isFlip ? 0 : -w / 2;
    const wingY = isFlip ? wingHeight / 2 : 0;
    // Duo repeats its volume pair on the other leaf's top rail. Keep the pair
    // in that leaf's local coordinates, including when the device is closed.
    this.wingVolumeKeys.forEach((key, i) => {
      size(key, d * 0.22, 0.28, 0.045, d * 0.11,
        wingX - w * (0.02 + (1 - i) * 0.12), wingY + wingHeight / 2 + 0.009, 0);
      key.quaternion.copy(TOP_VOLUME_ROTATION);
      key.scale.setScalar(duoControls);
      key.visible = duoControls > 0;
      col(key.material.color, (v) => v.band.color);
    });
    this.wingPivot.position.set(
      isFlip ? 0 : -w / 2 - pose.shift,
      isFlip ? h / 2 + pose.shift : 0,
      pose.lift,
    );
    this.wingPivot.rotation.set(isFlip ? pose.angle : 0, isFlip ? 0 : pose.angle, 0);
    const wingFlat = isFlip ? "bottom" : "right";
    this.wingNotch.visible = flipSlab ? num((v) => v.front.notch.o) > 0.01 : isFlip && foldWeight > 0.99;
    this.wingNotch.scale.setScalar(flipSlab ? Math.max(0.001, num((v) => v.front.notch.o)) : 1);
    size(
      this.wingNotch,
      notchW,
      notchH,
      notchDepth,
      num((v) => v.front.notch.r) / 100,
      flipSlab ? notchX : 0,
      flipSlab ? wingHeight - topInset - num((v) => v.fold?.axis === "flip" ? 0.12 : v.front.notch.y / 100) - notchH / 2
        : wingHeight - (h - sh) - 0.12 - notchH / 2,
      notchZ,
    );
    size(this.wingFrame, w, wingHeight, frameDepth, r, wingX, wingY, 0, wingFlat, flatStrength, seamWeld);
    size(
      this.wingBack,
      w - 0.065,
      wingHeight - 0.065 + 0.0325 * seamWeld,
      backDepth,
      r - 0.025,
      wingX,
      wingY - 0.01625 * seamWeld,
      // The moving half has an external display. Its colored backing must sit
      // behind the black mask, not at the same depth as the display surface.
      backZ + 0.018 * measuredFold * (flipSlab ? flip * flip : 1),
      wingFlat,
      flatStrength,
      seamWeld,
    );
    size(
      this.wingFace,
      w - 2 * glassInset,
      wingHeight - 2 * glassInset + glassInset * seamWeld,
      faceDepth,
      r - glassInset,
      wingX,
      wingY - glassInset * seamWeld / 2,
      faceZ,
      wingFlat,
      flatStrength,
      seamWeld,
    );
    size(
      this.wingScreen,
      flipSlab ? sw : THREE.MathUtils.lerp(w - 0.075, sw, hasMeasuredDisplay),
      flipSlab ? wingHeight - topInset : THREE.MathUtils.lerp(wingHeight - 0.075, sh, hasMeasuredDisplay),
      screenDepth,
      flipSlab ? screenRadius : Math.min(r - 0.005, num((v) => v.fold?.innerScreen?.r ?? (v.body.r - 7)) / 100),
      wingX - sx,
      wingY - (flipSlab ? topInset / 2 : isFlip ? sy : 0),
      screenZ,
      wingFlat,
      flatStrength,
      seamWeld,
    );
    size(this.coverFace, w - 2 * glassInset, wingHeight - 2 * glassInset, 0.006,
      r - glassInset, wingX, wingY, coverZ + 0.007);
    this.coverFace.visible = measuredFold > 0.01 && coverOpacity > 0.001;
    this.coverScreen.visible = !flipSlab || coverOpacity > 0.001;
    size(
      this.coverScreen,
      THREE.MathUtils.lerp(w - 0.1, coverW, measuredFold),
      THREE.MathUtils.lerp(wingHeight - 0.1, coverH, measuredFold),
      coverDepth,
      Math.min(r - 0.005, num((v) => v.fold?.coverScreen?.r ?? v.body.r - 5.5) / 100),
      wingX,
      wingY,
      coverZ,
    );
    this.coverScreen.rotation.set(isFlip ? Math.PI : 0, isFlip ? 0 : Math.PI, 0);
    const coverNotchWeight = measuredFold * (1 - attachmentFlip);
    this.coverNotch.visible = coverNotchWeight > 0.01;
    this.coverNotch.scale.setScalar(Math.max(0.001, coverNotchWeight));
    size(this.coverNotch, 0.13, 0.13, 0.003, 0.065,
      wingX, wingY + (isFlip ? -1 : 1) * (coverH / 2 - 0.16), -z + 0.0015);
    const hingeOverhang = num((v) => {
      const fold = v.fold;
      if (!fold) return 0.055;
      if (fold.axis === "book" && fold.closedWidth) return 2 * (fold.closedWidth - fold.openWidth / 2) / 100;
      if (fold.axis === "flip" && fold.closedHeight) return 2 * (fold.closedHeight - fold.openHeight / 2) / 100;
      return 0.055;
    });
    // Join the exterior rear edges and retract beneath the seam as the device
    // opens. A centered rectangular block would cut across the display wedge.
    this.hinge.geometry.reshape(isFlip ? w * 0.92 : h * 0.95,
      d, clearance, pose.angle, hingeOverhang, foldWeight, isFlip);
    this.hinge.position.set(isFlip ? 0 : -w / 2, isFlip ? h / 2 : 0, 0);
    col(this.hinge.material.color, (v) => v.band.color);
    const creaseWidth = THREE.MathUtils.lerp(isFlip ? 0.025 : 0.055, 0.012, measuredFold);
    size(
      this.crease,
      isFlip ? w * 0.93 : creaseWidth,
      isFlip ? creaseWidth : h * 0.94,
      0.003,
      0.008,
      isFlip ? 0 : -w / 2 + THREE.MathUtils.lerp(0.025, creaseWidth / 2, measuredFold),
      isFlip ? h / 2 - THREE.MathUtils.lerp(0.018, creaseWidth / 2, measuredFold) : 0,
      THREE.MathUtils.lerp(z + 0.03, screenZ + screenDepth / 2 + 0.002, measuredFold),
    );
    const c = Math.cos(pose.angle),
      edge = z * Math.sin(pose.angle) * foldWeight;
    const minX =
      isFlip || foldWeight < 0.01
        ? -w / 2
        : Math.min(-w / 2, -w / 2 - pose.shift + Math.min(0, -w * c) - edge);
    const maxX =
      isFlip || foldWeight < 0.01
        ? w / 2
        : Math.max(w / 2, -w / 2 - pose.shift + Math.max(0, -w * c) + edge);
    const minY = isFlip
      ? Math.min(-h / 2, h / 2 + pose.shift + Math.min(0, wingHeight * c) - edge)
      : -h / 2;
    const maxY = isFlip
      ? Math.max(h / 2, h / 2 + pose.shift + Math.max(0, wingHeight * c) + edge)
      : h / 2;
    return {
      width: maxX - minX,
      height: maxY - minY,
      offsetX: -(minX + maxX) / 2,
      offsetY: -(minY + maxY) / 2,
      foldWeight,
    };
  }
}

/** Bind explicitly: a scene-inherited environment overrides per-material intensity in Three.js. */
export function bindEnvironment(root: THREE.Object3D, environment: THREE.Texture) {
  const visited = new Set<THREE.MeshStandardMaterial>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(mat instanceof THREE.MeshStandardMaterial) || visited.has(mat)) continue;
      visited.add(mat);
      mat.envMap = environment;
      mat.needsUpdate = true;
    }
  });
}

export function disposeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(mat);
      for (const [key, value] of Object.entries(mat))
        // The shared environment render target is owned and disposed by PhoneScene.
        if (key !== "envMap" && value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
