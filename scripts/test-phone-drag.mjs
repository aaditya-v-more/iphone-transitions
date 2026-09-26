import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/lib/phone-drag.ts'], bundle: true,
  write: false, platform: 'node', format: 'esm' });
const { bindPhoneDrag } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
class Surface extends EventTarget {
  captured = new Set();
  classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
  classes = new Set();
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 600 }; }
}
function harness(pointerType = 'touch') {
  const surface = new Surface(), moves = [], hovers = [];
  const dispose = bindPhoneDrag(surface, dx => moves.push(dx), (x,y) => hovers.push([x,y]));
  const send = (type, x, y, options = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      pointerType, pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, ...options,
    });
    surface.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, 'Native vertical pan and zoom must remain available');
  };
  return { surface, moves, hovers, dispose, send };
}

// Horizontal finger motion rotates in both directions and accumulates across swipes.
{
  const h = harness();
  h.send('pointerdown', 80, 200);
  h.send('pointermove', 83, 202);
  assert.deepEqual(h.moves, [], 'A tap or small finger jitter must not rotate');
  h.send('pointermove', 120, 203);
  h.send('pointermove', 180, 204);
  h.send('pointermove', 150, 208);
  assert.deepEqual(h.moves, [40,60,-30]);
  assert(h.surface.classes.has('is-dragging'));
  h.send('pointerup', 150, 208);
  h.send('pointermove', 300, 208);
  h.send('pointerdown', 100, 200);
  h.send('pointermove', 60, 200);
  assert.deepEqual(h.moves, [40,60,-30,-40]);
  assert(h.hovers.every(([x,y]) => x === 0 && y === 0), 'Touch must not leave mouse-hover tilt');
  h.dispose();
  assert.equal(h.surface.captured.size, 0);
}
// Once a gesture starts vertically, later lateral drift must not rotate the phone.
{
  const h = harness();
  h.send('pointerdown', 100, 200);
  h.send('pointermove', 103, 180);
  h.send('pointermove', 200, 120);
  assert.deepEqual(h.moves, []);
  assert.equal(h.surface.captured.size, 0);
  assert(!h.surface.classes.has('is-dragging'));
  h.dispose();
}
// Browser cancellation and lost capture end the drag; a new gesture works normally.
for (const ending of ['pointerup','pointercancel','lostpointercapture']) {
  const h = harness();
  h.send('pointerdown', 100, 200);
  h.send('pointermove', 130, 200);
  h.send(ending, 130, 200, { pointerId: 2 });
  h.send('pointermove', 140, 200);
  h.send(ending, 140, 200);
  h.send('pointermove', 250, 200);
  assert.deepEqual(h.moves, [30,10]);
  assert.equal(h.surface.captured.size, 0);
  assert(!h.surface.classes.has('is-dragging'));
  h.send('pointerdown', 200, 200);
  h.send('pointermove', 160, 200);
  assert.deepEqual(h.moves, [30,10,-40]);
  h.dispose();
}
// A second finger hands the gesture to native pinch zoom instead of hijacking rotation.
{
  const h = harness();
  h.send('pointerdown', 100, 200);
  h.send('pointermove', 130, 200);
  h.send('pointerdown', 220, 200, { pointerId: 2, isPrimary: false });
  h.send('pointermove', 280, 200, { pointerId: 2, isPrimary: false });
  h.send('pointermove', 50, 200);
  assert.deepEqual(h.moves, [30]);
  assert.equal(h.surface.captured.size, 0);
  h.dispose();
}
// Desktop drag and the recording script's recentered pointer gestures still work.
{
  const h = harness('mouse');
  h.send('pointerdown', 100, 200, { button: 2 });
  h.send('pointermove', 140, 200);
  assert.deepEqual(h.moves, []);
  h.send('pointerdown', 100, 200);
  h.send('pointermove', 103, 200);
  h.send('pointerdown', 100, 200);
  h.send('pointermove', 104, 200);
  assert.deepEqual(h.moves, [3,4]);
  h.dispose();
  h.send('pointerdown', 100, 200);
  h.send('pointermove', 200, 200);
  assert.deepEqual(h.moves, [3,4], 'Unmount must remove all interaction handlers');
}
console.log('Touch rotation, vertical pan arbitration, pinch handoff, cancellation, desktop drag and cleanup passed.');
