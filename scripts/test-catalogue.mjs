import { build } from "esbuild";

// Exercise the actual catalogue and scroll sampler without a browser or server.
const { outputFiles } = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "ts",
    contents: `
      import assert from 'node:assert/strict';
      import { CATALOGUES } from './src/data/catalogue';
      import { activeIndex, defaultFoldOpen, foldChoreography, hingePose, modelProgress, sampleJourney } from './src/lib/morph';

      let assertions = 0;
      const check = (condition, message) => { assert(condition, message); assertions++; };
      for (const [brand, phones] of Object.entries(CATALOGUES)) {
        check(new Set(phones.map(p => p.id)).size === phones.length, brand + ': unique model IDs');
        check(sampleJourney(-1, phones).from.id === phones[0].id, 'Start clamps to first phone');
        check(sampleJourney(2, phones).to.id === phones.at(-1).id, 'End clamps to final phone');
        for (const [i, p] of phones.entries()) {
          check(p.brand === brand, p.id + ': correct brand');
          check(p.body.w > 0 && p.body.h > 0 && p.body.r > 0, p.id + ': valid body');
          check(p.body.r * 2 < p.body.w, p.id + ': valid corner radius');
          check(p.finish && p.material && p.display && p.source, p.id + ': complete model metadata');
          check(i === 0 || phones[i - 1].year <= p.year, p.id + ': chronological order');
          const center = modelProgress(i, phones.length);
          check(activeIndex(center, phones.length) === i, p.id + ': navigation and captions agree');
          const sample = sampleJourney(center, phones);
          const actualWidth = sample.from.body.w * (1 - sample.mix) + sample.to.body.w * sample.mix;
          check(Math.abs(actualWidth - p.body.w) < .001, p.id + ': navigation lands on the held shape');
          if (p.fold) check(p.fold.openWidth > 0 && p.fold.openHeight > 0, p.id + ': usable unfolded display');
          for (const l of [...p.lenses, p.extraLens].filter(Boolean)) {
            if (l.o) check(l.x - l.r >= 0 && l.x + l.r <= p.body.w && l.y - l.r >= 0 && l.y + l.r <= p.body.h, p.id + ': camera stays inside body');
          }
        }
        let previousWidth = phones[0].body.w;
        for (let step = 0; step <= 10000; step++) {
          const s = sampleJourney(step / 10000, phones);
          const width = s.from.body.w * (1 - s.mix) + s.to.body.w * s.mix;
          check(Number.isFinite(width) && Math.abs(width - previousWidth) < 2, brand + ': continuous body morph');
          previousWidth = width;
        }
      }
      for (const id of ['iphone-17','iphone-air','iphone-17-pro-max','iphone-17e','iphone-18-pro','iphone-18-pro-max','iphone-duo']) check(CATALOGUES.apple.some(p => p.id === id), id + ': included');
      for (const id of ['galaxy-s26','galaxy-s26-plus','galaxy-s26-ultra','galaxy-z-fold8','galaxy-z-fold8-ultra','galaxy-z-flip8']) check(CATALOGUES.samsung.some(p => p.id === id), id + ': included');
      check(!!CATALOGUES.apple.find(p => p.id === 'iphone-duo').availability, 'Announced model carries availability');
      const slab = CATALOGUES.samsung.find(p => p.id === 'galaxy-s26-ultra');
      const book = CATALOGUES.samsung.find(p => p.id === 'galaxy-z-fold8');
      const flip = CATALOGUES.samsung.find(p => p.id === 'galaxy-z-flip8');
      check(foldChoreography(slab, book, .46).shapeMix === 1, 'Book body forms before it opens');
      check(foldChoreography(slab, book, .46).hingeOpen === 0, 'Book hinge remains closed during reshaping');
      check(foldChoreography(slab, book, .75).hingeOpen > 0 && foldChoreography(slab, book, .75).hingeOpen < 1, 'Book unfolds through an intermediate angle');
      check(foldChoreography(book, slab, .42).hingeOpen === 0 && foldChoreography(book, slab, .42).shapeMix === 0, 'Book closes before it becomes a slab');
      check(foldChoreography(slab, flip, .34).shapeMix > 0 && foldChoreography(slab, flip, .34).shapeMix < 1
        && foldChoreography(slab, flip, .34).hingeOpen === 1, 'Clamshell starts reshaping at full height');
      check(foldChoreography(slab, flip, .75).hingeOpen > 0 && foldChoreography(slab, flip, .75).hingeOpen < 1, 'Clamshell physically folds');
      const overlap = foldChoreography(flip, slab, .42);
      check(overlap.hingeOpen > 0 && overlap.hingeOpen < 1 && overlap.shapeMix > 0 && overlap.shapeMix < 1,
        'Final unfolding overlaps with reshaping instead of pausing at a hard stage boundary');
      for (const opened of [0, .3, 1]) for (let step = 0; step <= 100; step++) {
        const mix = step / 100;
        const forward = foldChoreography(flip, slab, mix, opened, 1);
        const reverse = foldChoreography(slab, flip, 1 - mix, 1, opened);
        check(Math.abs(forward.shapeMix + reverse.shapeMix - 1) < 1e-12
          && Math.abs(forward.hingeOpen - reverse.hingeOpen) < 1e-12,
          'Flip/slab choreography retraces the same path in reverse, including manual hinge poses');
      }
      check(foldChoreography(book, flip, .5).hingeOpen === 0, 'Hinge axes change while closed');
      for (const from of [slab, book, flip]) for (const to of [slab, book, flip]) {
        let previous = foldChoreography(from, to, 0);
        for (let step = 1; step <= 1000; step++) {
          const pose = foldChoreography(from, to, step / 1000);
          check(pose.shapeMix >= 0 && pose.shapeMix <= 1 && pose.hingeOpen >= 0 && pose.hingeOpen <= 1, 'Fold pose remains physically bounded');
          check(Math.abs(pose.shapeMix - previous.shapeMix) < .01 && Math.abs(pose.hingeOpen - previous.hingeOpen) < .01, 'Fold choreography has no jumps');
          previous = pose;
        }
        check(previous.shapeMix === 1, 'Morph reaches the destination body');
        if (to.fold) check(previous.hingeOpen === defaultFoldOpen(to), 'Fold arrives in the correct pose');
      }
      check(foldChoreography(book, book, 0, .3, .3).hingeOpen === .3, 'Manual hinge control is retained at a held model');
      for (const phone of Object.values(CATALOGUES).flat().filter(p => p.fold)) {
        const thickness = phone.thickness * 4.2 / 100;
        const radius = thickness / 2 + .04;
        const closed = hingePose(0, thickness);
        check(closed.lift - thickness - .057 > .02, phone.id + ': closed displays have physical clearance');
        for (let step = 0; step <= 100; step++) {
          const pose = hingePose(step / 100, thickness);
          check(Math.abs(Math.hypot(pose.shift, radius - pose.lift) - radius) < 1e-10, phone.id + ': hinge stays on its fixed circular path');
        }
        check(hingePose(1, thickness).lift === 0 && hingePose(1, thickness).shift === 0, phone.id + ': open panels meet without a displaced hinge');
      }
      for (const [from, to] of [[book, flip], [flip, book], [book, slab], [slab, flip]]) {
        const fromOpen = 1 - defaultFoldOpen(from), toOpen = 1 - defaultFoldOpen(to);
        const start = foldChoreography(from, to, 0, fromOpen, toOpen);
        const end = foldChoreography(from, to, 1, fromOpen, toOpen);
        if (from.fold) check(start.hingeOpen === fromOpen, 'Leaving a manually positioned fold retains its pose');
        if (to.fold) check(end.hingeOpen === toOpen, 'Returning to a manually positioned fold restores its pose');
      }
      console.log(assertions + ' assertions passed across ' + Object.values(CATALOGUES).flat().length + ' phone models.');
    `,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
