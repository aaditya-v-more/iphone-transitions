import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Run with node scripts/test-flip-slab.mjs. Bundle the production model and
// shader hooks; only canvas painting is stubbed, never geometry or transforms.
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const { outputFiles } = await build({
  stdin: {
    resolveDir: repoRoot,
    loader: "ts",
    contents: `
      export * as THREE from 'three';
      export { PhoneModel, disposeScene } from './src/lib/phone3d';
      export { foldChoreography } from './src/lib/morph';
      export { PhoneLayout } from './src/lib/phone-layout';
      export { CATALOGUES } from './src/data/catalogue';
    `,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { THREE, PhoneModel, disposeScene, foldChoreography, PhoneLayout, CATALOGUES } =
  await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get: (_, key) => String(key).startsWith("create") ? () => gradient : () => {},
  set: () => true,
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.Path2D = class {};

const MM = 100 / 4.2;
const GEOMETRY_EPS = 0.0005; // 0.012 mm; includes the model's 4-decimal shape cache.
const JUMP_EPS = 0.05 / MM; // At +/- 1e-6, no visible feature may jump 0.05 mm.
const UV_EPS = 0.000002;
const failures = new Map();
let assertions = 0, poses = 0, scenarios = 0, boundaryPairs = 0, trajectoryPairs = 0;

// Aggregate failures so one bad endpoint cannot hide a second regression.
// Retain one worst example per invariant rather than thousands of repeated rows.
function check(condition, invariant, context, error = 0) {
  assertions++;
  if (condition) return;
  const old = failures.get(invariant);
  const severity = Number.isFinite(error) ? Math.abs(error) : Infinity;
  if (!old || severity > old.error) {
    failures.set(invariant, { context, error: severity, count: (old?.count ?? 0) + 1 });
  } else old.count++;
}
const describe = (value) => JSON.stringify(value);
const vec = () => new THREE.Vector3();
const worldPosition = (object) => object.getWorldPosition(vec());
function visible(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  if (object.material) {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    return materials.some((mat) => mat.visible && (!mat.transparent || mat.opacity > 0.001));
  }
  return true;
}
function box(object, reference) {
  const result = new THREE.Box3();
  const inverse = reference ? reference.matrixWorld.clone().invert() : new THREE.Matrix4();
  object.traverse((mesh) => {
    if (!mesh.isMesh || !visible(mesh)) return;
    mesh.geometry.computeBoundingBox();
    result.union(mesh.geometry.boundingBox.clone().applyMatrix4(
      inverse.clone().multiply(mesh.matrixWorld),
    ));
  });
  return result;
}
function union(objects, reference) {
  return objects.reduce((result, object) => result.union(box(object, reference)), new THREE.Box3());
}
const bodyParts = (model) => [model.frame, model.wingFrame, model.hinge];
const bodyCenter = (model) => union(bodyParts(model)).getCenter(vec());
const maxBoxError = (a, b) => Math.max(...["min", "max"].flatMap((edge) =>
  ["x", "y", "z"].map((axis) => Math.abs(a[edge][axis] - b[edge][axis]))));
const maxMatrixError = (a, b) => Math.max(...a.elements.map((n, i) => Math.abs(n - b.elements[i])));
const innerNotches = (model) => [model.notch, model.wingNotch].filter(visible);
function features(model) {
  return new Map([
    ["module", model.module], ["flash", model.flash.group],
    ["sensor", model.sensor.group], ["sensorPad", model.sensorPad],
    ["logo", model.logo], ["port", model.port],
    ...model.optics.map((optic, i) => ["camera" + i, optic.group]),
    ...model.keys.map((key, i) => ["key" + i, key]),
    ...model.antennae.map((part, i) => ["antenna" + i, part]),
    ...model.grille.map((part, i) => ["speaker" + i, part]),
    ["selfie", innerNotches(model)[0]],
  ].filter(([, object]) => object && visible(object)));
}
function snapshot(model, centered = false) {
  const center = centered ? bodyCenter(model) : vec();
  return new Map([...features(model)].map(([name, object]) => [name, {
    position: worldPosition(object).sub(center),
    bounds: box(object).translate(center.clone().negate()),
  }]));
}
function compareFeatures(a, b, label, invariant, epsilon = GEOMETRY_EPS, allowVanishing = false) {
  for (const name of new Set([...a.keys(), ...b.keys()])) {
    if (!a.has(name) || !b.has(name)) {
      // A detail shrinking below the same spatial tolerance may disappear.
      // Endpoint identity remains strict; motion checks must not mistake a
      // 0.039 mm fading sensor for the old full-sized camera/key teleport.
      const size = (a.get(name) ?? b.get(name)).bounds.getSize(vec());
      const extent = Math.max(size.x, size.y, size.z);
      check(allowVanishing && extent <= epsilon, invariant + ": visibility",
        label + " " + name + " disappearing extent=" + (extent * MM).toFixed(6) + " mm", extent);
      continue;
    }
    check(true, invariant + ": visibility", label + " " + name);
    const one = a.get(name), two = b.get(name);
    const error = Math.max(one.position.distanceTo(two.position), maxBoxError(one.bounds, two.bounds));
    check(error <= epsilon, invariant + ": " + name,
      label + " error=" + (error * MM).toFixed(6) + " mm", error);
  }
}
const textures = new Map();
function texture(phone) {
  if (!textures.has(phone.id)) {
    const tex = new THREE.Texture();
    tex.userData.sentinel = textures.size + 1;
    if (phone.fold?.axis === "flip") {
      tex.userData.cover = new THREE.Texture();
      tex.userData.cover.userData.sentinel = 20 + textures.size;
    }
    textures.set(phone.id, tex);
  }
  return textures.get(phone.id);
}
function update(model, from, to, shapeMix, hingeOpen) {
  model.update(from, to, shapeMix, texture(from), texture(to), hingeOpen, true);
  model.root.updateMatrixWorld(true);
}
function atProgress(model, from, to, progress, fromOpen, toOpen) {
  const pose = foldChoreography(from, to, progress, fromOpen, toOpen);
  update(model, from, to, pose.shapeMix, pose.hingeOpen);
  return pose;
}

// Evaluate the expressions emitted by the real onBeforeCompile hook, rather
// than reproducing splitY's implementation in a test-only UV helper. A nonlinear
// texture ramp also detects ghosting from mixing full and cropped artwork.
const vec2 = (x, y) => ({ x, y });
function mix(a, b, t) {
  if (typeof a === "number") return a * (1 - t) + b * t;
  if (Array.isArray(a)) return a.map((n, i) => mix(n, b[i], t));
  return vec2(mix(a.x, b.x, t), mix(a.y, b.y, t));
}
function sampleTexture(tex, uv) {
  return [uv.x * uv.x + uv.y * 0.1, uv.y * uv.y + uv.x * 0.2,
    tex.userData.sentinel * (0.25 + uv.x * uv.y), 1];
}
const evaluators = new WeakMap();
function shaderSample(shader, u, v) {
  let evaluate = evaluators.get(shader.mat);
  if (!evaluate) {
    const compiled = { uniforms: {}, fragmentShader: "#include <map_fragment>\n#include <emissivemap_fragment>" };
    shader.mat.onBeforeCompile(compiled);
    const uv = compiled.fragmentShader.match(/vec2 phoneUv = ([^;]+);/);
    const color = compiled.fragmentShader.match(/vec4 phoneTexel = ([^;]+);/);
    assert(uv && color, "The real shader must expose its phone UV and artwork expressions");
    evaluate = new Function("vMapUv", "map", "mapB", "innerA", "innerB", "blend",
      "split", "panelHalf", "flip", "splitY", "mix", "vec2", "texture2D",
      "const phoneUv = " + uv[1] + "; return {uv: phoneUv, color: " + color[1] + "};");
    evaluators.set(shader.mat, evaluate);
  }
  const uniform = (name) => shader.uniforms[name]?.value;
  return evaluate(vec2(u, v), shader.mat.map, uniform("mapB"), uniform("innerA"),
    uniform("innerB"), uniform("blend"), uniform("split"), uniform("panelHalf"),
    uniform("flip"), uniform("splitY"), mix, vec2, sampleTexture);
}
function checkUV(model, from, to, shapeMix, label) {
  const lower = box(model.screen, model.frame).getSize(vec());
  const upper = box(model.wingScreen, model.wingFrame).getSize(vec());
  const seam = lower.y / (lower.y + upper.y);
  let worstUV = 0, worstColor = 0;
  for (const u of [0.1, 0.5, 0.9]) {
    const bottomSeam = shaderSample(model.screenShader, u, 1).uv;
    const topSeam = shaderSample(model.wingShader, u, 0).uv;
    worstUV = Math.max(worstUV, Math.abs(bottomSeam.x - topSeam.x), Math.abs(bottomSeam.y - topSeam.y));
    for (const [shader, low, high] of [[model.screenShader, 0, seam], [model.wingShader, seam, 1]]) {
      for (const v of [0, 0.37, 1]) {
        const expectedUV = vec2(u, low + (high - low) * v);
        const actual = shaderSample(shader, u, v);
        const expectedColor = mix(sampleTexture(texture(from), expectedUV), sampleTexture(texture(to), expectedUV), shapeMix);
        worstUV = Math.max(worstUV, Math.abs(actual.uv.x - expectedUV.x), Math.abs(actual.uv.y - expectedUV.y));
        worstColor = Math.max(worstColor, ...actual.color.map((n, i) => Math.abs(n - expectedColor[i])));
      }
    }
  }
  check(worstUV < UV_EPS, "UV intervals cover one image and share a seam", label + " uvError=" + worstUV, worstUV);
  check(worstColor < 0.00002, "Artwork is crossfaded once at the continuous UV", label + " colorError=" + worstColor, worstColor);
  const lowerSpan = shaderSample(model.screenShader, 0.5, 1).uv.y - shaderSample(model.screenShader, 0.5, 0).uv.y;
  const upperSpan = shaderSample(model.wingShader, 0.5, 1).uv.y - shaderSample(model.wingShader, 0.5, 0).uv.y;
  const densityError = Math.max(Math.abs(lowerSpan / lower.y - upperSpan / upper.y), Math.abs(1 / lower.x - 1 / upper.x));
  check(densityError < UV_EPS, "Texture density matches across physical panels", label + " densityError=" + densityError, densityError);
}

function supportGap(model, optic) {
  const center = worldPosition(optic.group).applyMatrix4(model.wingFrame.matrixWorld.clone().invert());
  const barrel = box(optic.group, model.wingFrame);
  const surfaces = [model.wingFrame, model.wingBack, model.coverScreen, model.module]
    .filter(visible).map((object) => box(object, model.wingFrame)).filter((bounds) =>
      center.x >= bounds.min.x && center.x <= bounds.max.x && center.y >= bounds.min.y && center.y <= bounds.max.y);
  if (!surfaces.length) return Infinity;
  // The lid exterior is -Z. Positive means the entire barrel floats off every
  // backing surface beneath its center; a negative value means contact/inset.
  return Math.min(...surfaces.map((bounds) => bounds.min.z)) - barrel.max.z;
}
function checkPose(model, from, to, shapeMix, hingeOpen, label, allowedGaps) {
  poses++;
  for (const [host, names] of [
    [model.frame, ["back", "face", "screen"]],
    [model.wingFrame, ["wingBack", "wingFace", "wingScreen", "wingNotch", "coverFace", "coverScreen"]],
  ]) {
    const hostBounds = box(host, host);
    for (const name of names) {
      if (!visible(model[name])) continue;
      const bounds = box(model[name], host);
      const overhang = Math.max(0, ...["x", "y"].flatMap((axis) =>
        [hostBounds.min[axis] - bounds.min[axis], bounds.max[axis] - hostBounds.max[axis]]));
      check(overhang <= GEOMETRY_EPS, "Layer stays inside its half panel: " + name,
        label + " overhang=" + (overhang * MM).toFixed(6) + " mm", overhang);
    }
  }
  const notches = innerNotches(model);
  check(notches.length === 1, "Exactly one inner selfie cutout persists", label + " count=" + notches.length, Math.abs(notches.length - 1));
  check(!visible(model.coverNotch), "Flip/slab does not introduce a cover cutout", label);
  const lower = box(model.frame, model.frame).getSize(vec());
  const upper = box(model.wingFrame, model.wingFrame).getSize(vec());
  check(lower.distanceTo(upper) <= GEOMETRY_EPS, "Half-panel dimensions remain matched", label, lower.distanceTo(upper));
  const expectedCameras = model.wingPivot.matrixWorld.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI));
  const cameraError = maxMatrixError(model.cameraRig.matrixWorld, expectedCameras);
  const keyError = maxMatrixError(model.keyRig.matrixWorld, model.wingPivot.matrixWorld);
  check(cameraError < 1e-7 && keyError < 1e-7, "Attachments retain the rigid lid transform",
    label + " matrixError=" + Math.max(cameraError, keyError), Math.max(cameraError, keyError));
  const host = box(model.wingFrame, model.wingFrame);
  for (const [i, optic] of [...model.optics, model.flash].entries()) {
    if (!visible(optic.group)) continue;
    const bounds = box(optic.group, model.wingFrame);
    const overhang = Math.max(0, ...["x", "y"].flatMap((axis) =>
      [host.min[axis] - bounds.min[axis], bounds.max[axis] - host.max[axis]]));
    check(overhang <= GEOMETRY_EPS, "Camera footprint stays on lid " + i,
      label + " overhang=" + (overhang * MM).toFixed(6) + " mm", overhang);
    const gap = supportGap(model, optic);
    const allowedGap = allowedGaps[i];
    check(gap <= allowedGap + JUMP_EPS, "Camera does not separate from its backing " + i,
      label + " gap=" + (gap * MM).toFixed(6) + " mm (endpoint allowance " + (allowedGap * MM).toFixed(6) + " mm)", gap);
  }
  for (const [i, key] of model.keys.entries()) {
    if (!visible(key)) continue;
    const bounds = box(key, model.wingFrame);
    const overhang = Math.max(0, host.min.y - bounds.min.y, bounds.max.y - host.max.y);
    const nearestEdge = Math.min(Math.abs(bounds.max.x - host.min.x), Math.abs(bounds.min.x - host.max.x));
    check(overhang <= GEOMETRY_EPS && nearestEdge < 0.06, "Side key stays on lid edge " + i,
      label + " yOverhang=" + (overhang * MM).toFixed(6) + " mm, edgeGap=" + (nearestEdge * MM).toFixed(6) + " mm", Math.max(overhang, nearestEdge));
  }
  for (const object of [model.cameraRig, model.keyRig, ...notches]) {
    const determinant = object.matrixWorld.determinant();
    const finite = object.matrixWorld.elements.every(Number.isFinite)
      && new THREE.Matrix3().getNormalMatrix(object.matrixWorld).elements.every(Number.isFinite);
    check(finite && Math.abs(determinant) > 1e-8, "Attachment transforms remain finite and nonsingular", label + " determinant=" + determinant, finite ? 0 : Infinity);
  }
  if (hingeOpen > 1 - 1e-9) {
    const gap = Math.abs(box(model.screen).max.y - box(model.wingScreen).min.y);
    check(gap <= GEOMETRY_EPS, "Open inner-screen rectangles meet at the hinge", label + " gap=" + (gap * MM).toFixed(6) + " mm", gap);
  }
  if (hingeOpen >= 0.7) {
    check(model.coverShader.mat.emissiveIntensity <= 1e-7,
      "Opened exterior display stays off during reshape", label,
      model.coverShader.mat.emissiveIntensity);
  }
  checkUV(model, from, to, shapeMix, label);
}

function outline(model, objects) {
  const center = bodyCenter(model), vertices = [];
  for (const object of objects) {
    if (!visible(object)) continue;
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) vertices.push(vec().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).sub(center));
  }
  // Oblique support directions detect changed outside corner radii, which an
  // axis-aligned envelope alone cannot catch at the morph-to-held handoff.
  return Array.from({ length: 32 }, (_, i) => {
    const angle = i * Math.PI / 16;
    return Math.max(...vertices.map((v) => v.x * Math.cos(angle) + v.y * Math.sin(angle)));
  });
}
function checkEndpoint(model, held, label) {
  compareFeatures(snapshot(model, true), snapshot(held, true), label, "Centered endpoint matches held device");
  for (const [name, one, two] of [
    ["chassis", bodyParts(model), bodyParts(held)],
    ["inner screen", [model.screen, model.wingScreen], [held.screen, held.wingScreen]],
    ["back skin", [model.back, model.wingBack], [held.back, held.wingBack]],
  ]) {
    const first = union(one).translate(bodyCenter(model).negate());
    const second = union(two).translate(bodyCenter(held).negate());
    const envelopeError = maxBoxError(first, second);
    check(envelopeError <= GEOMETRY_EPS, "Endpoint envelope: " + name,
      label + " error=" + (envelopeError * MM).toFixed(6) + " mm", envelopeError);
    // A closed or partially open Flip is checked in 3D above. Compare the
    // visible outer perimeter for all endpoint states as well.
    const a = outline(model, one), b = outline(held, two);
    const cornerError = Math.max(...a.map((n, i) => Math.abs(n - b[i])));
    check(cornerError <= GEOMETRY_EPS, "Endpoint silhouette: " + name,
      label + " error=" + (cornerError * MM).toFixed(6) + " mm", cornerError);
  }
  const layout = new PhoneLayout(model.root, held.root);
  layout.front.orient(0, 0, 0, 1);
  layout.back.orient(0, 0, 0, 1);
  model.root.updateMatrixWorld(true);
  held.root.updateMatrixWorld(true);
  // Relative attachment identity was checked above. One additional invariant
  // checks the actual viewer's centering, without repeating the same global
  // translation defect once for every camera, button and speaker hole.
  const centerError = bodyCenter(model).distanceTo(bodyCenter(held));
  check(centerError <= GEOMETRY_EPS, "Endpoint presentation center matches held device",
    label + " error=" + (centerError * MM).toFixed(6) + " mm", centerError);
  for (const phone of [model, held]) {
    phone.root.position.set(0, 0, 0);
    phone.root.rotation.set(0, 0, 0);
    phone.root.scale.setScalar(1);
    phone.root.updateMatrixWorld(true);
  }
}
function dispose(...models) {
  const scene = new THREE.Scene();
  scene.add(...models.map((model) => model.root));
  disposeScene(scene);
}

async function main() {
  const find = (id) => {
    const phone = CATALOGUES.samsung.find((p) => p.id === id);
    assert(phone, "Missing regression fixture " + id);
    return phone;
  };
  for (const flipId of ["galaxy-z-flip7", "galaxy-z-flip8"]) {
    for (const slabId of ["galaxy-s26", "galaxy-s26-ultra"]) {
      const flip = find(flipId), slab = find(slabId);
      for (const manualOpen of [0, 0.5, 1]) {
        const forward = new PhoneModel(), reverse = new PhoneModel();
        const heldFlip = new PhoneModel(), heldSlab = new PhoneModel();
        update(heldFlip, flip, flip, 0, manualOpen);
        update(heldSlab, slab, slab, 0, 1);
        // Preserve authored barrel stand-off at held endpoints, while rejecting
        // any larger floating gap introduced during their interpolation.
        const heldGaps = Array.from({ length: 5 }, () => [0]);
        for (const model of [heldFlip, heldSlab]) {
          for (const [index, optic] of [...model.optics, model.flash].entries()) {
            if (!visible(optic.group)) continue;
            if (model === heldFlip) heldGaps[index].push(supportGap(model, optic));
            else {
              const center = worldPosition(optic.group), barrel = box(optic.group);
              const supports = [model.frame, model.back, model.module].filter(visible).map((p) => box(p))
                .filter((b) => center.x >= b.min.x && center.x <= b.max.x && center.y >= b.min.y && center.y <= b.max.y);
              heldGaps[index].push(Math.min(...supports.map((b) => b.min.z)) - barrel.max.z);
            }
          }
        }
        const allowedGaps = heldGaps.map((gaps) => Math.max(...gaps));
        assert(allowedGaps.every(Number.isFinite), "Every held camera must have a backing surface");
        const label = flipId + " <-> " + slabId + " manualOpen=" + manualOpen;
        scenarios += 2;
        for (let step = 0; step <= 100; step++) {
          const p = step / 100;
          const a = atProgress(forward, flip, slab, p, manualOpen, 1);
          const b = atProgress(reverse, slab, flip, 1 - p, 1, manualOpen);
          checkPose(forward, flip, slab, a.shapeMix, a.hingeOpen, label + " forward p=" + p, allowedGaps);
          checkPose(reverse, slab, flip, b.shapeMix, b.hingeOpen, label + " reverse p=" + (1 - p), allowedGaps);
          const scheduleError = Math.max(Math.abs(a.shapeMix + b.shapeMix - 1), Math.abs(a.hingeOpen - b.hingeOpen));
          check(scheduleError < 1e-10, "Schedule retraces the same shape and hinge pose", label + " p=" + p, scheduleError);
          compareFeatures(snapshot(forward, true), snapshot(reverse, true), label + " p=" + p, "Reverse path retraces attachments");
          if (step === 0) {
            checkEndpoint(forward, heldFlip, label + " forward Flip endpoint");
            checkEndpoint(reverse, heldFlip, label + " reverse Flip endpoint");
          }
          if (step === 100) {
            checkEndpoint(forward, heldSlab, label + " forward slab endpoint");
            checkEndpoint(reverse, heldSlab, label + " reverse slab endpoint");
          }
          // Reversal symmetry does not rule out a symmetric teleport. Probe
          // both sides of every scheduled sample, including the schedule knots.
          for (const [model, from, to, progress, fromOpen, toOpen] of [
            [forward, flip, slab, p, manualOpen, 1],
            [reverse, slab, flip, 1 - p, 1, manualOpen],
          ]) {
            atProgress(model, from, to, Math.max(0, progress - 1e-6), fromOpen, toOpen);
            const before = snapshot(model, true);
            atProgress(model, from, to, Math.min(1, progress + 1e-6), fromOpen, toOpen);
            compareFeatures(before, snapshot(model, true),
              label + " " + from.id + " -> " + to.id + " p=" + progress,
              "Scheduled attachment trajectory stays continuous", JUMP_EPS, true);
            trajectoryPairs++;
          }
        }
        // Probe immediately around every former binary cutoff in shape space.
        // These complement the schedule samples, whose quintic easing can skip
        // the 0.001 attachment cutoff even with many uniformly spaced frames.
        for (const [from, to] of [[flip, slab], [slab, flip]]) {
          for (const cut of [0.001, 0.01, 0.5, 0.99, 0.999]) {
            update(forward, from, to, cut - 1e-6, 1);
            const before = snapshot(forward, true);
            update(forward, from, to, cut + 1e-6, 1);
            compareFeatures(before, snapshot(forward, true), label + " shapeCutoff=" + cut,
              "No feature jump across former cutoff", JUMP_EPS, true);
            boundaryPairs++;
          }
        }
        dispose(forward, reverse, heldFlip, heldSlab);
      }
    }
  }
  for (const tex of textures.values()) {
    tex.userData.cover?.dispose();
    tex.dispose();
  }
  console.log(`${assertions} assertions across ${poses} validated mesh poses, ${scenarios} directed scenarios, ${trajectoryPairs} trajectory pairs, and ${boundaryPairs} cutoff pairs.`);
  if (failures.size) {
    console.error(`${failures.size} failing invariants (worst example of each):`);
    for (const [invariant, failure] of failures) {
      console.error("FAIL " + invariant + " [" + failure.count + " occurrences]: " + failure.context);
    }
    process.exitCode = 1;
  } else console.log("Flip/slab panel, shader, attachment, reversal and held-endpoint checks passed.");
}
try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : describe(error));
  process.exitCode = 1;
}
