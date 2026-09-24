import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const { outputFiles } = await build({
  stdin: { resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts', contents: `
    export * as THREE from 'three';
    export { CATALOGUES } from './src/data/catalogue';
    export { PhoneModel, disposeScene } from './src/lib/phone3d';
    export { foldChoreography } from './src/lib/morph';
  ` }, bundle: true, write: false, platform: 'node', format: 'esm',
});
const { THREE, CATALOGUES, PhoneModel, disposeScene, foldChoreography } =
  await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, { get: (_, key) => String(key).startsWith('create') ? () => gradient : () => {}, set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.Path2D = class {};
const scene = new THREE.Scene(), texture = new THREE.Texture();
const model = new PhoneModel(), reverse = new PhoneModel();
scene.add(model.root, reverse.root);
const phones = Object.values(CATALOGUES).flat();
const phone = id => phones.find(p => p.id === id);
const ray = new THREE.Raycaster(), vector = new THREE.Vector3();
let assertions = 0, poses = 0;
function check(condition, label) { assert(condition, label); assertions++; }
function update(target, a, b = a, mix = 0, open = 1) {
  target.update(a, b, mix, texture, texture, open, true);
  target.root.updateMatrixWorld(true);
  poses++;
}
function box(mesh) {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
}
function edgeHit(mesh, center, y, z) {
  const side = Math.sign(center.x) || 1;
  ray.set(new THREE.Vector3(side * 100, center.y + y, center.z + z), new THREE.Vector3(-side, 0, 0));
  return ray.intersectObject(mesh, false).length > 0;
}

// Ray tests see the actual Y/Z button face: an X/Y corner radius on a box
// cannot satisfy these. Preserve circular historical keys as well as capsules.
for (const p of phones.filter(p => !p.fold)) {
  update(model, p);
  for (const [i, key] of [...model.keys, model.cameraControl].entries()) {
    if (!key.visible) continue;
    const bounds = box(key), extent = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const r = Math.min(extent.y, extent.z) / 2;
    check(edgeHit(key, center, 0, 0), `${p.id} key ${i}: center is solid`);
    check(edgeHit(key, center, extent.y / 2 - .25 * r, 0), `${p.id} key ${i}: rounded end is present`);
    for (const sign of [-1, 1]) {
      check(!edgeHit(key, center, sign * (extent.y / 2 - .12 * r), .88 * r),
        `${p.id} key ${i}: corners round off in the side-view plane`);
    }
    if (p.year >= 2010) {
      check(Math.abs(center.z) < 1e-6, `${p.id} key ${i}: centered between front and back`);
      check(extent.z < (p.thickness * .042) * .65, `${p.id} key ${i}: fits in the side rail`);
    }
  }
}

// Duo uses the top rail of each leaf for volume. Local transforms must remain
// fixed as the lid folds; controls must not inherit Air's Action button.
let duoLocalControls;
for (let i = 0; i <= 40; i++) {
  update(model, phone('iphone-duo'), phone('iphone-duo'), 0, i / 40);
  check(!model.keys[3].visible && model.cameraControl.visible, 'Duo: no inherited Action button, Camera Control is present');
  const controls = [...model.keys.slice(1, 3).map(key => [key, model.frame]),
    ...model.wingVolumeKeys.map(key => [key, model.wingFrame])];
  const matrices = [];
  for (const [key, host] of controls) {
    const inverse = host.matrixWorld.clone().invert();
    const local = inverse.multiply(key.matrixWorld);
    const center = new THREE.Vector3().setFromMatrixPosition(local);
    const bounds = host.geometry.boundingBox;
    check(key.visible && center.y > bounds.max.y && center.y - bounds.max.y < .02,
      'Duo: volume cap touches its host top rail');
    check(center.x > bounds.min.x && center.x < bounds.max.x && Math.abs(center.z) < 1e-6,
      'Duo: top keys stay within their own panel width and depth');
    matrices.push(local.elements.slice());
  }
  if (duoLocalControls) check(matrices.every((matrix, j) => matrix.every((value, k) => Math.abs(value - duoLocalControls[j][k]) < 1e-6)),
    'Duo: top-volume controls retain their rigid leaf attachment');
  duoLocalControls = matrices;
}

// The cover must remain outside BOTH display half-planes throughout opening.
// Testing only fully open/closed bounds missed the block cutting through glass.
for (const p of phones.filter(p => p.fold)) {
  for (let step = 0; step <= 80; step++) {
    update(model, p, p, 0, step / 80);
    const positions = model.hinge.geometry.getAttribute('position');
    const fixed = model.frame.matrixWorld.clone().invert();
    const moving = model.wingFrame.matrixWorld.clone().invert();
    const fixedBounds = model.frame.geometry.boundingBox;
    const movingBounds = model.wingFrame.geometry.boundingBox;
    for (let i = 0; i < positions.count; i++) {
      vector.fromBufferAttribute(positions, i).applyMatrix4(model.hinge.matrixWorld);
      check(vector.toArray().every(Number.isFinite), `${p.id}: finite hinge vertices`);
      const a = vector.clone().applyMatrix4(fixed), b = vector.clone().applyMatrix4(moving);
      if (p.fold.axis === 'book') {
        check(a.x <= fixedBounds.min.x + 1e-6 && b.x >= movingBounds.max.x - 1e-6,
          `${p.id}: hinge stays outside the opening, pose ${step}, vertex ${i}`);
      } else {
        check(a.y >= fixedBounds.max.y - 1e-6 && b.y <= movingBounds.min.y + 1e-6,
          `${p.id}: hinge stays outside the clamshell opening, pose ${step}, vertex ${i}`);
      }
    }
  }
}

function snapshot(target) {
  const vertices = target.hinge.geometry.getAttribute('position');
  const values = new Float64Array(vertices.count * 3);
  for (let i = 0; i < vertices.count; i++) {
    vector.fromBufferAttribute(vertices, i).applyMatrix4(target.hinge.matrixWorld);
    values.set(vector.toArray(), i * 3);
  }
  return { vertices: values, opacity: target.hinge.visible ? target.hinge.material.opacity : 0 };
}
function compare(a, b, tolerance, label) {
  check(a.vertices.length === b.vertices.length, label + ': constant topology');
  let error = 0;
  for (let i = 0; i < a.vertices.length; i++) error = Math.max(error, Math.abs(a.vertices[i] - b.vertices[i]));
  check(error <= tolerance, label + ': no spatial jump, error=' + error);
  check(Math.abs(a.opacity - b.opacity) <= tolerance, label + ': no opacity jump');
}
for (const id of ['iphone-18-pro', 'iphone-18-pro-max', 'galaxy-s26-ultra']) {
  const slab = phone(id), fold = phone(id.startsWith('iphone') ? 'iphone-duo' : 'galaxy-z-fold8');
  for (const open of [0, .35, 1]) {
    for (let i = 0; i <= 120; i++) {
      const mix = i / 120;
      const forwardPose = foldChoreography(slab, fold, mix, 1, open);
      const backwardPose = foldChoreography(fold, slab, 1 - mix, open, 1);
      check(Math.abs(forwardPose.shapeMix + backwardPose.shapeMix - 1) < 1e-10
        && Math.abs(forwardPose.hingeOpen - backwardPose.hingeOpen) < 1e-10,
        `${id}: book choreography retraces the same path`);
      update(model, slab, fold, forwardPose.shapeMix, forwardPose.hingeOpen);
      update(reverse, fold, slab, backwardPose.shapeMix, backwardPose.hingeOpen);
      compare(snapshot(model), snapshot(reverse), 1e-5, id + ' reverse');
    }
  }
  // Directly straddle the previous 1% visibility cutoff, including a zero-size birth.
  for (const t of [0, .001, .01, .5, .99, 1]) {
    update(model, slab, fold, Math.max(0, t - 1e-6), 0);
    const before = snapshot(model);
    update(model, slab, fold, Math.min(1, t + 1e-6), 0);
    compare(before, snapshot(model), .0002, id + ' appearance cutoff ' + t);
  }
  update(model, slab, fold, 0, 0);
  check(!model.hinge.visible && model.hinge.material.opacity === 0, id + ': no residual slab hinge');
  update(model, slab, fold, .01, 0);
  check(box(model.hinge).getSize(new THREE.Vector3()).length() < .001
    && model.hinge.material.opacity < .001, id + ': hinge grows continuously out of the rail');
}
disposeScene(scene);
texture.dispose();
console.log(`${assertions} hinge-clearance, appearance, reversal and side-control assertions passed across ${poses} poses.`);
