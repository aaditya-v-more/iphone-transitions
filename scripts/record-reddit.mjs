import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Capture the existing viewer through scroll and pointer events. No app changes.
const output = path.resolve(process.env.CAPTURE_OUTPUT || 'recordings/reddit-both-sides');
const fps = 30;
const sourceDuration = 54;
const brands = process.env.CAPTURE_BRAND ? [process.env.CAPTURE_BRAND] : ['apple', 'samsung'];
const width = 960, height = 1080;
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => x * x * (3 - 2 * x);

// Use one shared time map. Either brand's folding movement slows BOTH clips,
// preserving their original relative progress and exactly matching rotations.
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), loader: 'ts', contents: "export { CATALOGUES } from './src/data/catalogue';" },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { CATALOGUES } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const foldWindows = Object.entries(CATALOGUES).flatMap(([brand, phones]) =>
  phones.slice(0, -1).flatMap((phone, index) => {
    const next = phones[index + 1];
    if (!phone.fold && !next.fold) return [];
    // sampleJourney morphs across local .2–.8; include spring settling time.
    return [{ brand, from: phone.name, to: next.name,
      start: 2 + 47 * (index + .7) / phones.length - .2,
      end: 2 + 47 * (index + 1.3) / phones.length + .45 }];
  }));
const speedAt = sourceTime => {
  if (sourceTime < 2 || sourceTime >= 49) return 1;
  const distance = Math.min(...foldWindows.map(w => Math.max(w.start - sourceTime, sourceTime - w.end, 0)));
  // Ease into and out of the protected folding windows over .25 source seconds.
  return 1 + ease(clamp(distance / .25));
};
const timeMap = [{ source: 0, output: 0 }];
for (let millisecond = 1; millisecond <= sourceDuration * 1000; millisecond++) {
  const previous = timeMap.at(-1);
  timeMap.push({ source: millisecond / 1000, output: previous.output + .001 / speedAt((millisecond - .5) / 1000) });
}
const fullFrameCount = Math.ceil(timeMap.at(-1).output * fps);
const duration = fullFrameCount / fps;
const frameCount = Number(process.env.CAPTURE_FRAMES || fullFrameCount);
let mapIndex = 0;
const sourceTimeAt = outputTime => {
  while (mapIndex < timeMap.length - 2 && timeMap[mapIndex + 1].output <= outputTime) mapIndex++;
  const a = timeMap[mapIndex], b = timeMap[mapIndex + 1];
  return a.source + clamp((outputTime - a.output) / (b.output - a.output)) * (b.source - a.source);
};
for (const window of foldWindows) {
  for (let t = window.start; t <= window.end; t += .01) assert.equal(speedAt(t), 1);
}
assert.equal(speedAt(10), 2);
assert(duration < sourceDuration);
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'timing-plan.json'), JSON.stringify({ sourceDuration, duration, fps, normalSpeed: 2, foldSpeed: 1, view: 'pair', foldWindows }, null, 2));
console.log(`Shared timing: ${duration.toFixed(2)}s; 2× regular sections, 1× folding; both sides.`);
if (process.env.CAPTURE_PLAN_ONLY) process.exit(0);
const browser = await chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] });
try {
  for (const brand of brands) {
    mapIndex = 0;
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-09-23T12:00:00Z') });
    await page.goto(`http://127.0.0.1:5173/?brand=${brand}`);
    await page.locator('[data-renderer="webgl"]').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Both sides', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.clock.pauseAt(new Date('2026-09-23T13:00:00Z'));
    await page.clock.runFor(4000);
    // Browser-compositor text fades use wall time, unlike the stepped 3D clock.
    // Keep chapter labels readable while preserving all phone morphs and folds.
    await page.addStyleTag({ content: '* { cursor: none !important; } .viewer-help { visibility: hidden !important; } .model-heading > div { opacity: 1 !important; transform: none !important; }' });
    await page.evaluate(() => document.activeElement?.blur());
    const box = await page.locator('.scene-canvas').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    const filename = path.join(output, `${brand}-scroll-rotate.mp4`);
    const encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
      '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', filename], { stdio: ['pipe', 'ignore', 'inherit'] });
    const finished = once(encoder, 'close');
    let previousAngle = 0;
    const started = Date.now();
    const checkpoints = [];
    for (let frame = 0; frame < frameCount; frame++) {
      const t = frame / fps;
      const sourceTime = sourceTimeAt(t);
      // Match start/end holds and rotation timing across both brand timelines.
      const progress = clamp((sourceTime - 2) / 47);
      const rotationPhase = clamp((sourceTime - 1) / 51);
      const angle = 8 * Math.PI * ease(rotationPhase);
      const delta = (angle - previousAngle) / 0.008;
      previousAngle = angle;
      await page.evaluate(({ progress, cx, cy, delta }) => {
        const journey = document.querySelector('.journey');
        window.scrollTo({ top: progress * (journey.offsetHeight - innerHeight), behavior: 'instant' });
        window.dispatchEvent(new Event('scroll'));
        const scene = document.querySelector('.scene-canvas');
        // Recenter the held drag to allow continuous full turns inside the viewport.
        scene.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', clientX: cx, clientY: cy, buttons: 1 }));
        scene.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: cx + delta, clientY: cy, buttons: 1 }));
      }, { progress, cx, cy, delta });
      await page.clock.runFor(Math.round((frame + 1) * 1000 / fps) - Math.round(frame * 1000 / fps));
      const image = await page.screenshot({ type: 'jpeg', quality: 96 });
      if (!encoder.stdin.write(image)) await once(encoder.stdin, 'drain');
      if (frame % (fps * 6) === 0 || frame === frameCount - 1) {
        const title = await page.locator('h1').innerText();
        checkpoints.push({ second: t, sourceTime, title, scroll: progress, rotation: angle });
        await writeFile(path.join(output, `${brand}-frame-${String(frame).padStart(4, '0')}.jpg`), image);
        console.log(`${brand}: ${t.toFixed(1)} / ${duration}s — ${title} (${((Date.now() - started) / 1000).toFixed(1)}s elapsed)`);
      }
    }
    encoder.stdin.end();
    const [code] = await finished;
    if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
    await page.mouse.up();
    await writeFile(path.join(output, `${brand}-capture.json`), JSON.stringify({ filename, width, height, fps, duration: frameCount / fps, view: 'pair', errors, checkpoints }, null, 2));
    if (errors.length) throw new Error(errors.join('\n'));
    await page.close();
    console.log(`Saved ${filename}`);
  }
} finally {
  await browser.close();
}
