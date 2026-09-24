import * as THREE from "three";

const STEPS = 24;
const SECTION = 2 * (STEPS + 1);
const ENDS = 4;

/** A retracting exterior cover, rather than a block through the inner displays.
 * The section joins the two rear edges. Its bulge points out of the opening,
 * so it stays outside both panel footprints at every angle. The hinge is an
 * illustration: its closed overhang follows the measured exterior envelope.
 */
export class HingeSpineGeometry extends THREE.BufferGeometry {
  private previous = "";

  constructor() {
    super();
    this.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SECTION * ENDS * 3), 3));
    const indices: number[] = [];
    // Duplicate the end rings to keep cap normals independent of the long cover.
    for (let i = 0; i < SECTION; i++) {
      const j = (i + 1) % SECTION;
      indices.push(SECTION + i, SECTION + j, 2 * SECTION + i,
        SECTION + j, 2 * SECTION + j, 2 * SECTION + i);
    }
    for (let i = 1; i < SECTION - 1; i++) {
      indices.push(0, i + 1, i, 3 * SECTION, 3 * SECTION + i, 3 * SECTION + i + 1);
    }
    this.setIndex(indices);
  }

  reshape(length: number, depth: number, clearance: number, angle: number,
    overhang: number, weight: number, flip: boolean) {
    const signature = [length, depth, clearance, angle, overhang, weight, flip].join(",");
    if (signature === this.previous) return;
    this.previous = signature;
    const position = this.getAttribute("position") as THREE.BufferAttribute;
    const half = angle / 2;
    const radius = (depth + clearance) * weight / 2;
    const rearRadius = radius + depth / 2;
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const reach = overhang / 2 * Math.sin(half);
    for (let end = 0; end < ENDS; end++) {
      const along = (end < 2 ? -1 : 1) * length / 2;
      for (let i = 0; i < SECTION; i++) {
        const outer = i <= STEPS;
        const q = outer ? i / STEPS : (SECTION - 1 - i) / STEPS;
        const bulge = outer ? reach * Math.sin(Math.PI * q) : 0;
        const outward = q * rearRadius * sin + bulge * Math.sin(half);
        const z = -depth / 2 + q * rearRadius * (1 - cos) - bulge * Math.cos(half);
        // Book: outside is -X; Flip: outside is +Y. The rear edge is the origin.
        position.setXYZ(end * SECTION + i, flip ? along : -outward, flip ? outward : along, z);
      }
    }
    position.needsUpdate = true;
    this.computeVertexNormals();
    this.computeBoundingBox();
    this.computeBoundingSphere();
  }
}
