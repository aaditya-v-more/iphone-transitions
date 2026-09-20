import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Exercise the production meshes without WebGL. Only canvas painting is stubbed;
// geometry, ray intersections, normals, materials and transforms remain real.
// Millimeter thresholds below reject visible regressions, not certify CAD radii.
const { outputFiles } = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
    contents: `
      export * as THREE from 'three';
      export { CATALOGUES } from './src/data/catalogue';
      export { APPLE_REFERENCE } from './src/data/apple-reference';
      export { SAMSUNG_REFERENCE } from './src/data/samsung-reference';
      export { PhoneModel, disposeScene } from './src/lib/phone3d';
    `,
  }, bundle: true, write: false, platform: 'node', format: 'esm',
});
const { THREE, CATALOGUES, APPLE_REFERENCE, SAMSUNG_REFERENCE, PhoneModel, disposeScene } =
  await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get: (_, key) => String(key).startsWith('create') ? () => gradient : () => {},
  set: () => true,
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.Path2D = class {};

const MM = 100 / 4.2;
const DIMENSION_EPS_MM = 0.03;
const INTERSECTION_EPS_MM = 0.04;
const JUMP_EPS_MM = 0.05;
const REVERSE_EPS_MM = 0.003;
const failures = new Map();
let assertions = 0, poses = 0, surfaceSamples = 0;
function check(condition, invariant, context = '', error = 0) {
  assertions++;
  if (condition) return;
  const previous = failures.get(invariant);
  const severity = Number.isFinite(error) ? Math.abs(error) : Infinity;
  if (!previous || severity > previous.error) {
    failures.set(invariant, { context, error: severity, count: (previous?.count ?? 0) + 1 });
  } else previous.count++;
}
const scene = new THREE.Scene();
const texture = new THREE.Texture();
const phones = new Map(Object.values(CATALOGUES).flat().map(phone => [phone.id, phone]));
const endpoints = new Map();
function newModel() {
  const model = new PhoneModel();
  scene.add(model.root);
  return model;
}
function update(model, a, b = a, t = 0) {
  model.update(a, b, t, texture, texture, 1, true);
  model.root.updateWorldMatrix(true, true);
  poses++;
}
function endpoint(id) {
  if (!phones.has(id)) throw new Error('Unknown catalogue model: ' + id);
  if (!endpoints.has(id)) {
    const model = newModel();
    update(model, phones.get(id));
    endpoints.set(id, model);
  }
  return endpoints.get(id);
}
function bounds(mesh) {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
}
const center = mesh => bounds(mesh).getCenter(new THREE.Vector3());
const extent = mesh => bounds(mesh).getSize(new THREE.Vector3());
const ray = new THREE.Raycaster();
function hit(mesh, point, axis = 'z', side = 1) {
  const origin = new THREE.Vector3(point.x ?? 0, point.y ?? 0, point.z ?? 0);
  const direction = new THREE.Vector3();
  origin[axis] = side * 100;
  direction[axis] = -side;
  ray.set(origin, direction);
  return ray.intersectObject(mesh, false)[0];
}
function surfaceZ(mesh, x, y, side, label) {
  const intersection = hit(mesh, { x, y }, 'z', side);
  surfaceSamples++;
  check(!!intersection, 'Surface is intersectable from outside', label + ` x=${x * MM} y=${y * MM}`);
  return intersection?.point.z ?? NaN;
}
function finiteGeometry(model, label) {
  model.root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute('position');
    const normals = mesh.geometry.getAttribute('normal');
    check([...mesh.matrixWorld.elements].every(Number.isFinite), 'Finite world transforms', label);
    check(positions && positions.array.every(Number.isFinite), 'Finite mesh vertices', label);
    check(normals && normals.array.every(Number.isFinite), 'Finite vertex normals', label);
    if (!normals) return;
    let valid = true;
    for (let i = 0; i < normals.count; i++) {
      const length = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i));
      // Coincident cap/bevel rings can have zero-area triangles and zero normals.
      if (length > 1e-6 && Math.abs(length - 1) > 0.0002) valid = false;
    }
    check(valid, 'Nonzero vertex normals are normalized', label);
  });
}
function frameEnvelope(model, dimensions, label) {
  const actual = extent(model.frame).multiplyScalar(MM).toArray();
  const error = Math.max(...actual.map((value, index) => Math.abs(value - dimensions[index])));
  check(error <= DIMENSION_EPS_MM, 'Frame retains published maximum dimensions',
    label + ' actual=' + actual.map(value => value.toFixed(5)).join(' × ') + ' mm', error);
}

// Test all published slab envelopes, including models whose old curve field was
// nonzero even though their real housing family intentionally uses flat sides.
for (const phone of phones.values()) {
  if (phone.fold) continue;
  const reference = APPLE_REFERENCE[phone.id] ?? SAMSUNG_REFERENCE[phone.id];
  if (!reference) continue;
  const model = endpoint(phone.id);
  frameEnvelope(model, reference.body, phone.id);
  finiteGeometry(model, phone.id);
}

function rearProfile(id) {
  const model = endpoint(id), skin = bounds(model.back);
  const middle = surfaceZ(model.back, 0, 0, -1, id + ' rear center');
  for (const [x, y] of [[0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]]) {
    const z = surfaceZ(model.back, x * extent(model.frame).x, y * extent(model.frame).y, -1, id);
    check(Math.abs(z - middle) * MM < 0.03, 'Rear central plateau remains flat', id, Math.abs(z - middle) * MM);
  }
  const insets = [0.15, 0.3, 0.5, 1, 2, 3, 4, 6, 8, 12];
  const samples = insets.map(inset => {
    // Flat families intentionally inset their back glass inside the metal rail.
    // A rear-surface probe must start inside that glass, not outside its footprint.
    const right = surfaceZ(model.back, skin.max.x - inset / MM, 0, -1, id);
    const left = surfaceZ(model.back, skin.min.x + inset / MM, 0, -1, id);
    check(Math.abs(left - right) * MM < 0.03, 'Rear profile is laterally symmetric', id, Math.abs(left - right) * MM);
    return (right - middle) * MM;
  });
  for (let i = 1; i < samples.length; i++) {
    check(samples[i] <= samples[i - 1] + 0.03 && samples[i] > -0.03,
      'Rear curve retreats monotonically toward the perimeter', id + ' inset=' + insets[i] + ' mm');
  }
  const position = model.back.geometry.getAttribute('position');
  const vertexHeights = new Set();
  for (let i = 0; i < position.count; i++) vertexHeights.add(Math.round(position.getZ(i) * MM / 0.01));
  if (id === 'iphone' || id === 'iphone-3gs') {
    check(samples[3] > 1, 'Legacy rear has substantial real curvature', id + ' retreat at 1 mm=' + samples[3].toFixed(4) + ' mm');
    check(vertexHeights.size >= 8, 'Curved skin has multiple actual depth subdivisions', id + ' distinct heights=' + vertexHeights.size);
    check(!model.topStrip.visible && !model.bottomStrip.visible,
      'Rear caps do not float as separate slabs', id);
  } else {
    check(Math.abs(samples[3]) < 0.08, 'iPhone 4 and 5 retain flat rear faces', id + ' retreat at 1 mm=' + samples[3].toFixed(4) + ' mm');
  }
  return samples;
}
const originalProfile = rearProfile('iphone');
const plasticProfile = rearProfile('iphone-3gs');
rearProfile('iphone-4');
rearProfile('iphone-5');
check(plasticProfile[6] > originalProfile[6] + 0.3,
  '3GS has a broader curved rear than the original', 'Retreat at 4 mm: original=' + originalProfile[6].toFixed(4) + ', 3GS=' + plasticProfile[6].toFixed(4) + ' mm');

// Ray-test the exterior skin against the actual frame triangles. Checking their
// bounding boxes alone misses a skin that cuts through its supporting enclosure.
function shellClearance(model, label) {
  const body = bounds(model.frame), w = body.max.x - body.min.x, h = body.max.y - body.min.y;
  for (const [x, y] of [[0, 0], [0.2 * w, 0], [-0.2 * w, 0],
    [w / 2 - 1 / MM, 0], [-w / 2 + 1 / MM, 0],
    [w / 2 - 3 / MM, 0.2 * h], [0, h / 2 - 1 / MM], [0, -h / 2 + 1 / MM],
    [0.45 * w, 0.45 * h], [-0.45 * w, 0.45 * h],
    [0.45 * w, -0.45 * h], [-0.45 * w, -0.45 * h]]) {
    const skinZ = surfaceZ(model.back, x, y, -1, label + ' skin');
    const frameZ = surfaceZ(model.frame, x, y, -1, label + ' frame');
    const penetration = (skinZ - frameZ) * MM;
    check(penetration <= INTERSECTION_EPS_MM, 'Rear skin remains outside the frame',
      label + ` at (${(x * MM).toFixed(3)}, ${(y * MM).toFixed(3)}) mm penetration=${penetration.toFixed(6)} mm`, penetration);
    check(penetration >= -0.8, 'Rear skin does not float above the frame',
      label + ' separation=' + (-penetration).toFixed(6) + ' mm', penetration);
  }
}
for (const id of ['iphone', 'iphone-3gs', 'iphone-4', 'iphone-5', 'iphone-6', 'galaxy-s3', 'galaxy-s6-edge', 'galaxy-s8']) {
  shellClearance(endpoint(id), id);
}

function circularSilhouette(mesh, axis, label) {
  const b = bounds(mesh), c = center(mesh);
  const plane = axis === 'x' ? ['y', 'z'] : ['x', 'y'];
  const diameters = plane.map(key => b.max[key] - b.min[key]);
  check(Math.abs(diameters[0] - diameters[1]) * MM < 0.03, 'Circular control has equal diameters', label);
  const radius = Math.min(...diameters) / 2;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    for (const [fraction, expected] of [[0.88, true], [1.12, false]]) {
      const point = c.clone();
      point[plane[0]] += radius * fraction * Math.cos(angle);
      point[plane[1]] += radius * fraction * Math.sin(angle);
      check(!!hit(mesh, point, axis, axis === 'x' ? -1 : 1) === expected,
        'Control silhouette is round rather than square', label + ` angle=${i} radius=${fraction}`);
    }
  }
}
for (const id of ['iphone', 'iphone-3gs', 'iphone-4', 'iphone-5']) {
  const model = endpoint(id), early = phones.get(id).year <= 2009, body = bounds(model.frame);
  circularSilhouette(model.home, 'z', id + ' Home');
  check(model.home.visible && model.homeOutline.visible, 'Legacy Home button retains a visible circular rim', id);
  const mark = bounds(model.homeMark), inset = bounds(model.homeMarkInset);
  const symbolSize = mark.getSize(new THREE.Vector3()), openingSize = inset.getSize(new THREE.Vector3());
  check(model.homeMark.visible && model.homeMarkInset.visible &&
    openingSize.x > symbolSize.x * 0.5 && openingSize.x < symbolSize.x * 0.92 &&
    openingSize.y > symbolSize.y * 0.5 && openingSize.y < symbolSize.y * 0.92 &&
    inset.min.x > mark.min.x && inset.max.x < mark.max.x &&
    inset.min.y > mark.min.y && inset.max.y < mark.max.y && inset.min.z > mark.max.z,
  'Home symbol has a recessed-looking hollow square, not a solid mark', id);
  const brightness = material => material.color.r + material.color.g + material.color.b;
  check(brightness(model.homeMarkInset.material) < brightness(model.homeMark.material) * 0.5,
    'Home symbol interior stays dark', id);
  const top = bounds(model.topKey);
  check(model.topKey.visible && center(model.topKey).x > 0 && top.max.y > body.max.y && top.min.y <= body.max.y,
    'Early sleep button is attached to the upper right top edge', id);
  const keys = model.keys.filter(key => key.visible);
  check(keys.length === (early ? 2 : 3), 'Legacy side controls have the generation-correct count', id + ' count=' + keys.length);
  check(keys.every(key => center(key).x < body.min.x && bounds(key).max.x >= body.min.x - 0.03 / MM),
    'Early controls attach to the left edge without a modern right-side sleep key', id);
  check(!model.cameraControl.visible, 'Legacy phones have no Camera Control', id);
  check(!model.keys[0].visible, 'Legacy phones have no inherited modern side key', id);
  check(model.keys[2].visible && center(model.keys[2]).y > center(model.keys[1]).y,
    'Silent switch is above the volume controls', id);
  if (early) {
    check(!model.flash.group.visible && !model.frontCamera.group.visible && !model.notch.visible,
      'Original and 3GS have no modern flash, selfie camera or notch', id);
    check(model.antennae.every(part => !part.visible), 'Original and 3GS have no modern antenna bands', id);
  } else {
    circularSilhouette(model.keys[1], 'x', id + ' volume up');
    circularSilhouette(model.keys[3], 'x', id + ' volume down');
  }
}
check(extent(endpoint('iphone-5').port).x < extent(endpoint('iphone-4').port).x * 0.7,
  'iPhone 5 uses a narrow Lightning opening instead of the earlier 30-pin port');
const five = endpoint('iphone-5');
check(Math.abs(five.frontCamera.group.getWorldPosition(new THREE.Vector3()).x) * MM < 0.03 &&
  five.frontCamera.group.getWorldPosition(new THREE.Vector3()).y > bounds(five.ear).max.y,
  'iPhone 5 selfie camera is centered above the earpiece');
const edge = endpoint('galaxy-s6-edge');
check(edge.frontCamera.group.getWorldPosition(new THREE.Vector3()).x > bounds(edge.ear).max.x,
  'S6 edge selfie camera is on the right of the earpiece');
for (const id of ['iphone-16-pro', 'iphone-17-pro', 'iphone-17e', 'iphone-15-pro', 'galaxy-s8', 'galaxy-s26']) {
  const model = endpoint(id), expected = id === 'iphone-16-pro' || id === 'iphone-17-pro';
  check(model.cameraControl.visible === expected, 'Camera Control appears only on supported phones', id);
  if (expected) {
    check(center(model.cameraControl).x > bounds(model.frame).max.x &&
      center(model.cameraControl).y < center(model.keys[0]).y,
      'Camera Control stays below the right-side power key', id);
  }
}

for (const id of ['galaxy-s6-edge', 'galaxy-s8']) {
  const model = endpoint(id), screen = bounds(model.screen), w = screen.max.x - screen.min.x;
  const middle = surfaceZ(model.screen, 0, 0, 1, id + ' display center');
  for (const x of [-0.25 * w, 0.25 * w]) {
    const z = surfaceZ(model.screen, x, 0, 1, id);
    check(Math.abs(z - middle) * MM < 0.03, 'Dual-edge display keeps a flat center', id);
  }
  const edges = [-1, 1].map(side => {
    const x = side * (w / 2 - 0.02 / MM);
    const z = surfaceZ(model.screen, x, 0, 1, id);
    const drop = (middle - z) * MM;
    check(drop >= 0.1, 'Dual-edge display has visible geometric edge depression',
      id + ' side=' + side + ' depression=' + drop.toFixed(6) + ' mm', 0.1 - drop);
    return drop;
  });
  check(Math.abs(edges[0] - edges[1]) < 0.03, 'Dual-edge display bends symmetrically', id);
}

const meshNames = ['frame', 'back', 'face', 'screen', 'home', 'homeOutline', 'homeMark',
  'homeMarkInset', 'topKey', 'cameraControl', 'ear', 'port'];
function meshes(model) {
  return new Map([...meshNames.map(name => [name, model[name]]), ...model.keys.map((key, i) => ['key' + i, key])]);
}
function snapshot(model) {
  const vector = new THREE.Vector3();
  return new Map([...meshes(model)].map(([name, mesh]) => {
    const position = mesh.geometry.getAttribute('position');
    const world = new Float64Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      vector.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      world.set(vector.toArray(), i * 3);
    }
    return [name, { world, normal: mesh.geometry.getAttribute('normal').array.slice(),
      bounds: bounds(mesh), geometry: mesh.geometry, index: mesh.geometry.index.array }];
  }));
}
function compare(one, two, label, invariant, toleranceMm, compareNormals = false) {
  for (const [name, a] of one) {
    const b = two.get(name);
    check(!!b && a.world.length === b.world.length, invariant + ': stable vertex count', label + ' ' + name);
    if (!b || a.world.length !== b.world.length) continue;
    let error = 0;
    for (let i = 0; i < a.world.length; i += 3) {
      error = Math.max(error, Math.hypot(a.world[i] - b.world[i], a.world[i + 1] - b.world[i + 1], a.world[i + 2] - b.world[i + 2]) * MM);
    }
    check(error <= toleranceMm, invariant + ': vertex trajectory', label + ' ' + name + ' error=' + error.toFixed(6) + ' mm', error);
    const boxError = Math.max(...['min', 'max'].flatMap(end => ['x', 'y', 'z'].map(axis => Math.abs(a.bounds[end][axis] - b.bounds[end][axis]) * MM)));
    check(boxError <= toleranceMm, invariant + ': bounds', label + ' ' + name + ' error=' + boxError.toFixed(6) + ' mm', boxError);
    if (compareNormals) {
      let normalError = 0;
      for (let i = 0; i < a.normal.length; i++) normalError = Math.max(normalError, Math.abs(a.normal[i] - b.normal[i]));
      check(a.normal.length === b.normal.length && normalError < 0.002,
        invariant + ': matching normals', label + ' ' + name + ' error=' + normalError.toFixed(6), normalError);
    }
  }
}
const forward = newModel(), reverse = newModel();
const pairs = [
  ['iphone', 'iphone-3gs'], ['iphone-3gs', 'iphone-4'], ['iphone-5', 'iphone-6'],
  ['iphone-11-pro', 'iphone-12'], ['galaxy-s3', 'galaxy-s6-edge'],
  ['galaxy-s6-edge', 'galaxy-s8'], ['galaxy-s22-ultra', 'galaxy-s24-ultra'],
];
for (const [first, last] of pairs) {
  const a = phones.get(first), b = phones.get(last), label = first + ' → ' + last;
  update(forward, a, b, 0);
  const topology = snapshot(forward);
  let previous;
  for (let step = 0; step <= 32; step++) {
    const t = step / 32;
    update(forward, a, b, t);
    update(reverse, b, a, 1 - t);
    const current = snapshot(forward), opposite = snapshot(reverse);
    finiteGeometry(forward, label + ' t=' + t);
    frameEnvelope(forward, [a.body.w / 4.2, a.body.h / 4.2, a.thickness].map((value, i) =>
      value + ([b.body.w / 4.2, b.body.h / 4.2, b.thickness][i] - value) * t), label + ' t=' + t);
    for (const [name, data] of current) {
      check(data.geometry === topology.get(name).geometry && data.index === topology.get(name).index,
        'Morph reuses constant geometry and topology', label + ' ' + name);
    }
    compare(current, opposite, label + ' t=' + t, 'Forward and reverse retrace identical geometry', REVERSE_EPS_MM, true);
    if (previous) compare(previous, current, label + ' t=' + t, 'Coarse trajectory has no spatial teleport', 4);
    if (step % 4 === 0) shellClearance(forward, label + ' t=' + t);
    if (step === 0 || step === 32) {
      compare(current, snapshot(endpoint(step === 0 ? first : last)), label + ' t=' + t,
        'Morph endpoint equals standalone model', REVERSE_EPS_MM, true);
    }
    previous = current;
  }
  // Include endpoint limits, the nearest-model branch, and visibility/shape
  // thresholds. Tiny progress changes must not produce a visible geometry step.
  for (const t of [0, 0.001, 0.01, 0.5, 0.99, 0.999, 1]) {
    for (const [model, from, to] of [[forward, a, b], [reverse, b, a]]) {
      update(model, from, to, Math.max(0, t - 1e-6));
      const before = snapshot(model);
      update(model, from, to, Math.min(1, t + 1e-6));
      const after = snapshot(model);
      compare(before, after, from.id + ' → ' + to.id + ' boundary=' + t,
        'Infinitesimal progress preserves continuity', JUMP_EPS_MM);
    }
  }
}

disposeScene(scene);
texture.dispose();
const description = `${assertions} body/profile and hardware assertions across ${poses} mesh poses, ${surfaceSamples} surface samples and ${pairs.length} bidirectional transitions`;
if (failures.size) {
  console.error(description + ': FAILED');
  for (const [invariant, failure] of failures) {
    console.error(`- ${invariant} (${failure.count} failures): ${failure.context}`);
  }
  process.exitCode = 1;
} else console.log(description + ': passed.');
