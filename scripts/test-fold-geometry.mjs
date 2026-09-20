import { build } from "esbuild";

// Exercise the actual meshes without creating a browser or WebGL renderer.
const { outputFiles } = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "ts",
    contents: `
      import assert from 'node:assert/strict';
      import * as THREE from 'three';
      import { PhoneModel, bindEnvironment, disposeScene } from './src/lib/phone3d';
      import { CATALOGUES } from './src/data/catalogue';
      import { SAMSUNG_REFERENCE } from './src/data/samsung-reference';
      import { APPLE_REFERENCE } from './src/data/apple-reference';
      import { PhoneLayout } from './src/lib/phone-layout';

      // Canvas artwork is irrelevant to geometry; keep the real Three.js transforms.
      const gradient = { addColorStop() {} };
      const ctx = new Proxy({}, {
        get: (_, key) => String(key).startsWith('create') ? () => gradient : () => {},
        set: () => true,
      });
      globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
      globalThis.Path2D = class {};
      let assertions = 0;
      const check = (value, message) => { assert(value, message); assertions++; };
      const box = mesh => {
        mesh.geometry.computeBoundingBox();
        return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      };
      const mmPerUnit = 100 / 4.2;
      const foldReference = phone => {
        if (phone.brand === 'samsung') return SAMSUNG_REFERENCE[phone.id];
        const reference = APPLE_REFERENCE[phone.id];
        const rectangle = ([x, y, ppi]) => [Math.hypot(x, y) / ppi, x, y];
        return { ...reference, screen: rectangle(reference.display), cover: rectangle(reference.cover) };
      };
      // Include every structural skin and display layer, not only the metal frames.
      // Cameras, decals, controls and antenna strips are separate surface details.
      const bodyParts = ['frame', 'wingFrame', 'hinge', 'back', 'wingBack',
        'face', 'wingFace', 'screen', 'wingScreen', 'notch', 'wingNotch',
        'coverFace', 'coverScreen', 'coverNotch', 'crease'];
      const bodyBox = model => bodyParts.reduce((bounds, name) =>
        model[name].visible ? bounds.union(box(model[name])) : bounds, new THREE.Box3());
      // Samsung excludes the main-screen frame from unfolded thickness. Keep the
      // actual drawing's small lip explicit: 0.119 / 0.179 / 0.202 mm, respectively.
      const innerLip = { screen: .005, wingScreen: .005,
        notch: .0075, wingNotch: .0075, crease: .0085 };
      const texture = new THREE.Texture();
      const phones = Object.values(CATALOGUES).flat().filter(phone => phone.fold);
      for (const phone of phones) {
        const model = new PhoneModel();
        for (let i = 0; i <= 20; i++) {
          const open = i / 20;
          model.update(phone, phone, 0, texture, texture, open, true);
          model.root.updateMatrixWorld(true);
          const lidCenter = model.wingFrame.getWorldPosition(new THREE.Vector3());
          check(lidCenter.z >= -1e-8, phone.id + ': lid folds toward the inner screen at ' + open);
          if (i === 10) check(lidCenter.z > 1, phone.id + ': halfway pose shows a real perpendicular lid');
          if (i === 0) {
            const fixedGlass = box(model.screen), movingGlass = box(model.wingScreen);
            const gap = movingGlass.min.z - fixedGlass.max.z;
            check(gap > (phone.fold.closedThickness ? .005 : .02), phone.id + ': closed inner glass never intersects');
            if (phone.fold.closedThickness) {
              const chassis = box(model.frame).union(box(model.wingFrame)).union(box(model.hinge));
              const dimensions = chassis.getSize(new THREE.Vector3()).multiplyScalar(100 / 4.2);
              const reference = foldReference(phone);
              check(Math.abs(dimensions.x - reference.body[0]) < .05, phone.id + ': folded chassis width includes the hinge spine');
              check(Math.abs(dimensions.y - reference.body[1]) < .05, phone.id + ': folded chassis height includes the hinge spine');
              check(Math.abs(dimensions.z - reference.body[2]) < .05, phone.id + ': folded chassis depth matches the published stack');
            }
          }
          if (phone.fold.closedThickness && (i === 0 || i === 20)) {
            const reference = foldReference(phone);
            const expected = i === 0 ? reference.body : reference.open;
            const envelope = bodyBox(model);
            const dimensions = envelope.getSize(new THREE.Vector3()).multiplyScalar(mmPerUnit);
            const lip = i === 0 ? 0 : innerLip.crease * mmPerUnit;
            check(Math.abs(dimensions.x - expected[0]) < .02, phone.id + ': complete body/display width at open=' + open);
            check(Math.abs(dimensions.y - expected[1]) < .02, phone.id + ': complete body/display height at open=' + open);
            check(Math.abs(dimensions.z - expected[2] - lip) < .02,
              phone.id + ': complete body/display depth, with only the explicit inner lip at open=' + open);
            const lower = -reference.open[2] / (2 * mmPerUnit);
            const upper = lower + expected[2] / mmPerUnit;
            for (const name of bodyParts) {
              if (!model[name].visible) continue;
              const bounds = box(model[name]);
              const allowance = i === 20 ? (innerLip[name] ?? 0) : 0;
              check(bounds.min.z >= lower - 1e-6, phone.id + ': ' + name + ' stays within the exterior thickness budget at open=' + open);
              check(bounds.max.z <= upper + allowance + 1e-6,
                phone.id + ': ' + name + ' does not add an unbudgeted skin at open=' + open);
            }
            // Express blockers in the moving lid's coordinates. Its exterior is -Z.
            const lidInverse = model.wingPivot.matrixWorld.clone().invert();
            const lidBox = mesh => {
              mesh.geometry.computeBoundingBox();
              return mesh.geometry.boundingBox.clone().applyMatrix4(
                lidInverse.clone().multiply(mesh.matrixWorld));
            };
            const cover = lidBox(model.coverScreen);
            const blockers = ['wingFrame', 'wingBack', 'coverFace'];
            if (phone.fold.axis === 'flip') blockers.push('module');
            for (const name of blockers) {
              check(cover.max.z < lidBox(model[name]).min.z - .001,
                phone.id + ': ' + name + ' cannot obscure the exterior display at open=' + open);
            }
            if (phone.fold.axis === 'flip') {
              for (const optic of [...model.optics, model.flash].filter(optic => optic.group.visible)) {
                const barrel = new THREE.Box3();
                optic.group.traverseVisible(object => {
                  if (object instanceof THREE.Mesh) barrel.union(lidBox(object));
                });
                check(Math.abs(barrel.max.z - cover.min.z) < 1e-6,
                  phone.id + ': camera/flash barrels contact the cover glass at open=' + open);
              }
            }
          }
          if (phone.fold.axis === 'flip') {
            const expected = model.wingPivot.matrixWorld.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI));
            check(expected.elements.every((n, index) => Math.abs(n - model.cameraRig.matrixWorld.elements[index]) < 1e-8), phone.id + ': cameras stay attached throughout folding');
            check(model.wingPivot.matrixWorld.elements.every((n, index) => Math.abs(n - model.keyRig.matrixWorld.elements[index]) < 1e-8), phone.id + ': side buttons stay attached throughout folding');
            if (i === 0) {
              const optics = model.optics.filter(optic => optic.group.visible);
              const center = box(model.coverScreen).getCenter(new THREE.Vector3());
              check(optics.length === 2, phone.id + ': cover has the two rear cameras');
              check(optics.every(optic => {
                const position = optic.group.getWorldPosition(new THREE.Vector3());
                return position.x > center.x && position.y < center.y;
              }), phone.id + ': closed-cover cameras are at the lower right');
            }
          } else {
            check(model.screenShader.uniforms.split.value === 1 && model.wingShader.uniforms.split.value === 1, phone.id + ': inner wallpaper keeps its scale while folding');
            if (i === 20) {
              const right = box(model.screen), left = box(model.wingScreen);
              check(Math.abs(left.min.y - right.min.y) < 1e-6 && Math.abs(left.max.y - right.max.y) < 1e-6, phone.id + ': wallpaper halves align vertically at the hinge');
            }
          }
        }
        if (phone.fold.innerScreen) {
          const inner = box(model.screen).union(box(model.wingScreen)).getSize(new THREE.Vector3());
          const cover = box(model.coverScreen).getSize(new THREE.Vector3());
          const reference = foldReference(phone);
          const diagonal = Math.hypot(inner.x, inner.y) * 100 / 4.2 / 25.4;
          const coverDiagonal = Math.hypot(cover.x, cover.y) * 100 / 4.2 / 25.4;
          check(Math.abs(diagonal - reference.screen[0]) < .01, phone.id + ': rendered inner screen matches the official full-rectangle diagonal');
          check(Math.abs(inner.x / inner.y - reference.screen[1] / reference.screen[2]) < .002, phone.id + ': rendered inner screen preserves the published pixel aspect');
          check(Math.abs(coverDiagonal - reference.cover[0]) < .01, phone.id + ': cover uses its own diagonal instead of filling the whole lid');
          check(Math.abs(cover.x / cover.y - reference.cover[1] / reference.cover[2]) < .002, phone.id + ': cover preserves its independent aspect ratio');
          check(box(model.back).min.z < box(model.frame).min.z - .002, phone.id + ': back glass is outside the metal cap without coplanar flicker');
          check(box(model.face).max.z > box(model.frame).max.z + .002, phone.id + ': display mask is outside the metal cap without coplanar flicker');
        }
        const scene = new THREE.Scene();
        scene.add(model.root);
        disposeScene(scene);
      }

      // Use the real model, not just the data conversion, to check the slab pass.
      for (const phone of CATALOGUES.samsung) {
        const reference = SAMSUNG_REFERENCE[phone.id];
        if (!reference || phone.fold) continue;
        const model = new PhoneModel();
        const scene = new THREE.Scene();
        scene.add(model.root);
        model.update(phone, phone, 0, texture, texture, 1, true);
        model.root.updateMatrixWorld(true);
        const body = box(model.frame).getSize(new THREE.Vector3()).multiplyScalar(100 / 4.2);
        const screen = box(model.screen).getSize(new THREE.Vector3()).multiplyScalar(100 / 4.2);
        check([body.x, body.y, body.z].every((value, i) => Math.abs(value - reference.body[i]) < .02), phone.id + ': rendered body matches the published millimeter dimensions');
        check(Math.abs(Math.hypot(screen.x, screen.y) / 25.4 - reference.screen[0]) < .01, phone.id + ': active rectangle follows the published diagonal');
        check(model.optics.filter(optic => optic.group.visible).length === reference.rearCameras, phone.id + ': correct rear camera count, including DepthVision where specified');
        check(model.keys.filter(key => key.visible).length === (['galaxy-s8', 'galaxy-s10'].includes(phone.id) ? 3 : 2), phone.id + ': correct side-key arrangement');
        if (phone.id.includes('ultra') && phone.year >= 2022) {
          check(!model.sensor.group.visible && model.sensorPad.visible, phone.id + ': the laser sensor is a flat window, not a fifth photographic lens');
          check(model.keys[1].position.y > model.keys[0].position.y, phone.id + ': volume rocker is above the side key');
        }
        if (phone.id === 'galaxy-s10') check(model.notch.position.x > .8, 'S10 selfie cutout is on the upper right');
        if (phone.id === 'galaxy-s20-ultra') {
          check(!model.sensor.group.visible && !model.sensorPad.visible, 'S20 Ultra retains DepthVision without inheriting the later Ultra laser window');
          check(Math.abs(screen.x / screen.y - 1440 / 3200) < .001, 'S20 Ultra screen uses the published pixel aspect');
        }
        disposeScene(scene);
      }

      // Regress the inherited-environment bug and resource ownership on the real model.
      const air = CATALOGUES.apple.find(p => p.id === 'iphone-air');
      const displayModel = new PhoneModel();
      const displayScene = new THREE.Scene();
      const environment = new THREE.Texture();
      let environmentDisposals = 0;
      environment.addEventListener('dispose', () => environmentDisposals++);
      displayScene.environment = environment;
      displayScene.add(displayModel.root);
      bindEnvironment(displayScene, environment);
      displayModel.update(air, air, 0, texture, texture, 1, true);
      displayModel.root.updateMatrixWorld(true);
      const displayBounds = box(displayModel.screen), bodyBounds = box(displayModel.frame);
      const mmPerSceneUnit = 100 / 4.2;
      const metalInset = (bodyBounds.max.x - box(displayModel.face).max.x) * mmPerSceneUnit;
      check(metalInset > 0 && metalInset < .5, 'Air keeps a narrow metal-only perimeter distinct from the black display border');
      check(Math.abs(displayBounds.getSize(new THREE.Vector3()).x * mmPerSceneUnit - 1260 / 460 * 25.4) < .1, 'Air active display width follows the published resolution and pixel density');
      check(Math.abs(displayBounds.getSize(new THREE.Vector3()).y * mmPerSceneUnit - 2736 / 460 * 25.4) < .1, 'Air active display height follows the published resolution and pixel density');
      check(Math.abs((displayBounds.min.x - bodyBounds.min.x) - (displayBounds.min.y - bodyBounds.min.y)) * mmPerSceneUnit < .1, 'Air has an even display inset on its sides and top');
      const bezel = displayModel.face.material;
      check(bezel.envMap === environment && displayModel.screen.material.envMap === environment, 'Dark glass uses its own reflection controls instead of inheriting the studio intensity');
      check(bezel !== displayModel.frame.material, 'Black bezel and metallic rim remain independently shaded');
      disposeScene(displayScene);
      check(environmentDisposals === 0, 'Disposing device meshes does not dispose the shared studio environment');
      environment.dispose();
      check(environmentDisposals === 1, 'The environment owner can dispose the texture exactly once');

      for (const ids of [['galaxy-z-fold7', 'galaxy-z-flip7'], ['galaxy-z-fold8-ultra', 'galaxy-z-flip8']]) {
        const endpoints = ids.map(id => phones.find(p => p.id === id));
        for (const [from, to] of [endpoints, [...endpoints].reverse()]) {
          const model = new PhoneModel();
          const label = from.id + ' to ' + to.id;
          const samples = [];
          for (const mix of [.499999, .500001]) {
            model.update(from, to, mix, texture, texture, 0, true);
            model.root.updateMatrixWorld(true);
            samples.push({
              cover: box(model.coverScreen),
              camera: model.optics.map(optic => optic.group.getWorldPosition(new THREE.Vector3())),
              keys: model.keys.map(key => key.getWorldPosition(new THREE.Vector3())),
              flash: model.flash.group.getWorldPosition(new THREE.Vector3()),
              notch: model.coverNotch.getWorldPosition(new THREE.Vector3()),
            });
          }
          for (const axis of ['x', 'y', 'z']) {
            for (const edge of ['min', 'max']) {
              check(Math.abs(samples[0].cover[edge][axis] - samples[1].cover[edge][axis]) * mmPerUnit < .01,
                label + ': cover ' + edge + '.' + axis + ' is continuous at the hinge-axis switch');
            }
          }
          for (const kind of ['camera', 'keys']) {
            for (let i = 0; i < samples[0][kind].length; i++) {
              check(samples[0][kind][i].distanceTo(samples[1][kind][i]) * mmPerUnit < .01,
                label + ': ' + kind + ' ' + i + ' has no world-coordinate jump');
            }
          }
          for (const kind of ['flash', 'notch']) {
            check(samples[0][kind].distanceTo(samples[1][kind]) * mmPerUnit < .01,
              label + ': ' + kind + ' has no world-coordinate jump');
          }
          // Continuity alone is insufficient: a smooth 72 mm camera excursion
          // still looks detached. Bound the actual visible attachment meshes
          // throughout the closed reshape, including the backing plate.
          for (let step = 0; step <= 100; step++) {
            const mix = step / 100;
            model.update(from, to, mix, texture, texture, 0, true);
            model.root.updateMatrixWorld(true);
            const shell = bodyBox(model);
            for (const [rig, allowance, name] of [[model.cameraRig, .2, 'camera assembly'], [model.keyRig, .06, 'side keys']]) {
              const attachments = new THREE.Box3();
              rig.traverseVisible(object => {
                if (!(object instanceof THREE.Mesh)) return;
                attachments.union(box(object));
                check(object.matrixWorld.elements.every(Number.isFinite)
                  && new THREE.Matrix3().getNormalMatrix(object.matrixWorld).elements.every(Number.isFinite),
                  label + ': finite ' + name + ' transforms at ' + mix);
              });
              for (const axis of ['x', 'y', 'z']) {
                check(attachments.min[axis] >= shell.min[axis] - allowance
                  && attachments.max[axis] <= shell.max[axis] + allowance,
                  label + ': ' + name + ' stays near the closed shell on ' + axis + ' at ' + mix);
              }
            }
          }
          const scene = new THREE.Scene();
          scene.add(model.root);
          disposeScene(scene);
        }
      }

      // Check the actual visible meshes after presentation transforms, independently
      // of the layout's own bounds. Include perspective, not only world-space gaps.
      const actualBounds = (root, camera) => {
        const world = new THREE.Box3(), projected = new THREE.Box3();
        const point = new THREE.Vector3();
        root.updateWorldMatrix(true, true);
        root.traverseVisible(object => {
          if (!(object instanceof THREE.Mesh)) return;
          if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
          const bounds = object.geometry.boundingBox;
          for (const x of [bounds.min.x, bounds.max.x])
            for (const y of [bounds.min.y, bounds.max.y])
              for (const z of [bounds.min.z, bounds.max.z]) {
                point.set(x, y, z).applyMatrix4(object.matrixWorld);
                world.expandByPoint(point);
                projected.expandByPoint(point.project(camera));
              }
        });
        return { world, projected };
      };
      let rotationPoses = 0, dampedTransitions = 0, transitionFrames = 0, lowVisibilityFrames = 0;
      const frameDamping = 1 - Math.exp(-9 / 60);
      for (const phone of phones) {
        const front = new PhoneModel(), rear = new PhoneModel();
        const presentationScene = new THREE.Scene();
        presentationScene.add(front.root, rear.root);
        const layout = new PhoneLayout(front.root, rear.root);
        const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
        camera.position.set(0, .05, 16);
        const verify = (label, focusFront = 1, focusBack = 1, damping = .08, singleCenterX = 0) => {
          layout.fitCamera(camera, damping);
          camera.updateMatrixWorld(true);
          const a = actualBounds(front.root, camera), b = actualBounds(rear.root, camera);
          for (const [result, weight] of [[a, focusFront], [b, focusBack]]) {
            if (weight <= .01) continue;
            check(!result.world.isEmpty(), label + ': visible phone has geometry');
            check(result.projected.min.x > -1 && result.projected.max.x < 1 && result.projected.min.y > -1 && result.projected.max.y < 1, label + ': camera contains the whole rotated phone');
            check(result.projected.min.z > -1 && result.projected.max.z < 1, label + ': no near/far clipping');
          }
          if (focusFront > .01 && focusBack > .01) {
            check(a.world.max.x < b.world.min.x, label + ': front and rear never intersect');
            check(a.projected.max.x < b.projected.min.x, label + ': front and rear never overlap on screen');
          } else {
            const active = focusFront > .01 ? a : b;
            check(Math.abs(active.world.getCenter(new THREE.Vector3()).x - singleCenterX) < .15,
              label + ': retained view converges to its standalone position');
          }
          rotationPoses++;
        };
        for (const open of [0, .25, .5, .75, 1]) {
          front.update(phone, phone, 0, texture, texture, open, true);
          rear.update(phone, phone, 0, texture, texture, open, true);
          // Two full turns include every button position and the halfway animations.
          for (let step = 0; step <= 16; step++) {
            const angle = step * Math.PI / 4;
            for (const aspect of [.55, 1.8]) {
              camera.aspect = aspect;
              camera.updateProjectionMatrix();
              layout.update(angle, .06, -.04, 1, 1, .026);
              verify(phone.id + ': open=' + open + ', turn=' + step + ', aspect=' + aspect);
            }
          }
        }
        // Enter and exit single-side views while rotated, including the hidden state.
        for (const weights of [[1, 0], [1, .25], [1, .5], [1, .75], [1, 1], [.75, 1], [.5, 1], [.25, 1], [0, 1]]) {
          for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
            layout.update(angle, 0, 0, weights[0], weights[1]);
            verify(phone.id + ': changing view at ' + angle, ...weights);
          }
        }
        // Regress perspective overlap as one partially folded view shrinks away.
        // The Fold8 half-open, 180-degree, aspect-1.5 case failed below .25 visibility
        // despite disjoint world bounds. Measure projected meshes after every frame,
        // using the same 60 FPS focus and camera damping as PhoneScene.
        for (const open of [.25, .5, .75]) {
          front.update(phone, phone, 0, texture, texture, open, true);
          rear.update(phone, phone, 0, texture, texture, open, true);
          for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
            for (const aspect of [.55, 1.5, 3]) {
              camera.aspect = aspect;
              camera.updateProjectionMatrix();
              for (const view of ['back', 'front']) {
                const targetFront = Number(view === 'front'), targetBack = Number(view === 'back');
                const label = phone.id + ': 60 FPS pair-to-' + view + ', open=' + open
                  + ', angle=' + angle + ', aspect=' + aspect;
                let focusFront = 1, focusBack = 1, sampledLowVisibility = false, hidden = false;
                camera.position.set(0, .05, 16);
                camera.updateMatrixWorld(true);
                // An asymmetric folded silhouette need not have its world AABB center
                // at the local rotation pivot. Compare with the same pose shown alone.
                layout.update(angle, 0, 0, targetFront, targetBack);
                const retained = view === 'front' ? front.root : rear.root;
                const singleCenterX = actualBounds(retained, camera).world.getCenter(new THREE.Vector3()).x;
                // Each transition begins from a settled pair, independent of earlier cases.
                layout.update(angle, 0, 0, focusFront, focusBack);
                verify(label + ', initial pair', focusFront, focusBack, 1);
                for (let frame = 1; frame <= 60; frame++) {
                  focusFront += (targetFront - focusFront) * frameDamping;
                  focusBack += (targetBack - focusBack) * frameDamping;
                  const fading = view === 'back' ? focusFront : focusBack;
                  layout.update(angle, 0, 0, focusFront, focusBack);
                  verify(label + ', frame=' + frame + ', fading=' + fading,
                    focusFront, focusBack, frameDamping, singleCenterX);
                  check(front.root.visible === (focusFront > .01)
                    && rear.root.visible === (focusBack > .01), label + ': visibility follows the hide threshold');
                  transitionFrames++;
                  if (fading < .25 && fading > .01) {
                    sampledLowVisibility = true;
                    lowVisibilityFrames++;
                  }
                  if (fading <= .01) { hidden = true; break; }
                }
                check(sampledLowVisibility, label + ': covers visible frames below .25');
                check(hidden, label + ': reaches the hidden state with a retained visible phone');
                layout.update(angle, 0, 0, targetFront, targetBack);
                verify(label + ', settled single view', targetFront, targetBack, frameDamping, singleCenterX);
                dampedTransitions++;
              }
            }
          }
        }
        // Cached geometry bounds must shrink after returning from a wide fold to Air.
        front.update(air, air, 0, texture, texture, 1, true);
        rear.update(air, air, 0, texture, texture, 1, true);
        layout.update(Math.PI, 0, 0, 1, 1);
        verify(phone.id + ': return to a non-folding phone');
        check(layout.front.localBounds.max.x - layout.front.localBounds.min.x < 3.3, 'Hidden folding wing does not enlarge the Air rotation pivot');
        disposeScene(presentationScene);
      }
      texture.dispose();
      console.log(assertions + ' geometry assertions passed across ' + phones.length + ' foldable models and ' + (phones.length * 21) + ' hinge poses.');
      console.log(rotationPoses + ' rotation, perspective, and view-transition poses verified.');
      console.log(dampedTransitions + ' damped pair-to-single transitions verified across ' + transitionFrames
        + ' frames, including ' + lowVisibilityFrames + ' visible frames below .25 visibility.');
    `,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
try {
  await import(
    `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
