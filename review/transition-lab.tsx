// Development-only review page. Uses the production scene and real catalogue;
// it is not imported by the application or included in its production entry.
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useMotionValue } from "motion/react";
import PhoneScene from "../src/components/PhoneScene";
import { CATALOGUES, type View } from "../src/data/catalogue";
import "../src/index.css";

const pairs = [
  ["galaxy-z-flip7", "galaxy-s26"],
  ["galaxy-z-flip8", "galaxy-s26-ultra"],
  ["galaxy-s26-ultra", "galaxy-z-fold8"],
  ["galaxy-z-fold8-ultra", "galaxy-z-flip8"],
  ["iphone", "iphone-3gs"],
  ["iphone-3gs", "iphone-4"],
  ["iphone-5", "iphone-6"],
  ["iphone-11-pro", "iphone-12"],
  ["galaxy-s6-edge", "galaxy-s8"],
  ["galaxy-s22-ultra", "galaxy-s24-ultra"],
];
function Review() {
  const [pair, setPair] = useState(0), [position, setPosition] = useState(0);
  const [rotation, setRotation] = useState(0), [view, setView] = useState<View>("pair");
  const phones = useMemo(() => pairs[pair].map(id => Object.values(CATALOGUES).flat().find(p => p.id === id)!), [pair]);
  const progress = useMotionValue(.35);
  const update = (value: number) => {
    const next = Math.max(0, Math.min(100, value));
    setPosition(next);
    progress.jump(.35 + .003 * next);
  };
  const phone = phones[position < 50 ? 0 : 1];
  return <main style={{ height: "100svh", display: "flex", flexDirection: "column", padding: 24, gap: 12 }}>
    <h1 style={{ fontSize: 20, textAlign: "center" }}>{phones[0].name} → {phones[1].name}</h1>
    <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
      <label>Pair <select value={pair} onChange={e => { setPair(Number(e.target.value)); update(0); }}>
        {pairs.map((ids, i) => <option key={i} value={i}>{ids.join(" → ")}</option>)}
      </select></label>
      <label>Transition position <input type="number" min="0" max="100" step="1" value={position}
        style={{ width: 68 }} onChange={e => update(Number(e.target.value))}/></label>
      <label>Angle <select value={rotation} onChange={e => setRotation(Number(e.target.value))}>
        {[0, 0.5, 1, 1.5, 2, 3].map(i => <option key={i} value={i}>{i * 90}°</option>)}
      </select></label>
      <label>View <select value={view} onChange={e => setView(e.target.value as View)}>
        <option value="pair">Both sides</option><option value="front">Front</option><option value="back">Back</option>
      </select></label>
    </div>
    <PhoneScene phones={phones} phone={phone} progress={progress} view={view} open={phone.fold?.axis !== "flip"}
      foldStates={{}} reducedMotion={true} rotation={rotation}/>
  </main>;
}
const reviewRoot = createRoot(document.getElementById("root")!);
reviewRoot.render(<Review/>);
// This development entry can reload when its scene dependencies change.
import.meta.hot?.dispose(() => reviewRoot.unmount());
