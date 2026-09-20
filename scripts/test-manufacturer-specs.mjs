import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const { outputFiles } = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
    contents: `
      export * as THREE from 'three';
      export { CATALOGUES } from './src/data/catalogue';
      export { APPLE_REFERENCE } from './src/data/apple-reference';
      export { PhoneModel, disposeScene } from './src/lib/phone3d';
    `,
  }, bundle: true, write: false, platform: 'node', format: 'esm',
});
const { THREE, CATALOGUES, APPLE_REFERENCE, PhoneModel, disposeScene } =
  await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, { get: (_, key) => String(key).startsWith('create') ? () => gradient : () => {}, set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.Path2D = class {};

let assertions = 0;
function check(condition, label) { assert(condition, label); assertions++; }
function mmBounds(mesh) {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld).getSize(new THREE.Vector3()).multiplyScalar(100 / 4.2);
}
const texture = new THREE.Texture();
check(Object.keys(APPLE_REFERENCE).length === CATALOGUES.apple.length, 'Every Apple entry has its own specification reference');
for (const phone of CATALOGUES.apple) {
  const ref = APPLE_REFERENCE[phone.id];
  check(!!ref, phone.id + ': reference exists');
  check(phone.source === ref.source, phone.id + ': UI links the actual model specification');
  check(Math.abs(phone.body.w / 4.2 - ref.body[0]) < 1e-8 && Math.abs(phone.body.h / 4.2 - ref.body[1]) < 1e-8,
    phone.id + ': catalogue preserves manufacturer body dimensions');
  check(phone.thickness === (ref.open?.[2] ?? ref.body[2]), phone.id + ': published depth is not inherited from a neighboring generation');
  const model = new PhoneModel();
  model.update(phone, phone, 0, texture, texture, 1, true);
  model.root.updateMatrixWorld(true);
  if (!phone.fold) {
    const body = mmBounds(model.frame).toArray();
    check(body.every((value, index) => Math.abs(value - ref.body[index]) < 0.03), phone.id + ': rendered frame matches millimeter body envelope');
    const screen = mmBounds(model.screen);
    const [x, y, ppi] = ref.display;
    check(Math.abs(screen.x - x / ppi * 25.4) < 0.03 && Math.abs(screen.y - y / ppi * 25.4) < 0.03,
      phone.id + ': rendered full display rectangle follows published pixels/PPI');
    check(screen.x < body[0] && screen.y < body[1], phone.id + ': active display stays inside the body');
  }
  check(model.optics.filter(optic => optic.group.visible).length === ref.rearCameras,
    phone.id + ': physical rear camera count excludes digital zoom modes');
  if (phone.year <= 2009) {
    check(!model.flash.group.visible, phone.id + ': no anachronistic rear flash');
    check(!model.frontCamera.group.visible && !model.notch.visible, phone.id + ': no anachronistic selfie camera or notch');
    check(model.home.visible, phone.id + ': physical Home button remains');
  }
  const scene = new THREE.Scene(); scene.add(model.root); disposeScene(scene);
}
texture.dispose();
console.log(assertions + ' manufacturer-data and rendered-mesh assertions passed across ' + CATALOGUES.apple.length + ' Apple models.');
