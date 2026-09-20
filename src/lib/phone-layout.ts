import * as THREE from "three";

/** Keep a rotating device centered on its whole silhouette, including an open lid. */
class PhonePlacement {
  readonly bounds = new THREE.Box3();
  readonly localBounds = new THREE.Box3();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly inverse = new THREE.Matrix4();
  private readonly matrix = new THREE.Matrix4();
  private readonly scratchBox = new THREE.Box3();
  private readonly center = new THREE.Vector3();
  private readonly translation = new THREE.Vector3();

  constructor(readonly root: THREE.Object3D) {
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) this.meshes.push(object);
    });
  }

  orient(x: number, y: number, z: number, visibility: number) {
    // Remove the previous presentation transform when measuring local geometry.
    // Hidden panels must not affect the pivot of a closed phone or a normal slab.
    this.root.updateWorldMatrix(true, true);
    this.inverse.copy(this.root.matrixWorld).invert();
    this.localBounds.makeEmpty();
    for (const mesh of this.meshes) {
      let visible = true;
      for (let node: THREE.Object3D | null = mesh; node && node !== this.root; node = node.parent) {
        if (!node.visible) { visible = false; break; }
      }
      if (!visible) continue;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      this.matrix.multiplyMatrices(this.inverse, mesh.matrixWorld);
      this.localBounds.union(this.scratchBox.copy(mesh.geometry.boundingBox!).applyMatrix4(this.matrix));
    }

    const scale = Math.max(0.001, visibility);
    this.localBounds.getCenter(this.center);
    this.root.rotation.set(x, y, z);
    this.root.scale.setScalar(scale);
    // Rotate the centering offset too. Applying it only along world X makes
    // the two unfolded phones orbit into each other at 90 and 180 degrees.
    this.root.position.copy(this.center).multiplyScalar(-scale).applyQuaternion(this.root.quaternion);
    this.root.visible = visibility > 0.01;
    this.root.updateMatrix();
    this.bounds.copy(this.localBounds).applyMatrix4(this.root.matrix);
  }

  place(x: number, y: number) {
    this.translation.set(x, y, 0);
    this.root.position.add(this.translation);
    this.bounds.translate(this.translation);
  }
}

/** Shared by the viewer and geometry regression tests; no renderer is required. */
export class PhoneLayout {
  readonly front: PhonePlacement;
  readonly back: PhonePlacement;
  readonly bounds = new THREE.Box3();

  constructor(front: THREE.Object3D, back: THREE.Object3D) {
    this.front = new PhonePlacement(front);
    this.back = new PhonePlacement(back);
  }

  update(angle: number, hoverX: number, hoverY: number, focusFront: number, focusBack: number, float = 0) {
    this.front.orient(-0.035 + hoverY, 0.12 + angle + hoverX, -0.035, focusFront);
    this.back.orient(0.045 + hoverY, Math.PI - 0.24 + angle + hoverX, 0.04, focusBack);

    // Equal slots keep the gap centered even when an angled lid changes depth.
    // Retain at least the resting width so edge-on views do not collapse together.
    const slotWidth = Math.max(
      this.front.localBounds.max.x - this.front.localBounds.min.x,
      this.back.localBounds.max.x - this.back.localBounds.min.x,
      (this.front.bounds.max.x - this.front.bounds.min.x) / Math.max(0.001, focusFront),
      (this.back.bounds.max.x - this.back.bounds.min.x) / Math.max(0.001, focusBack),
    );
    const gap = 0.72 * Math.min(focusFront, focusBack);
    this.front.place(-(slotWidth * focusBack + gap) / 2, float);
    this.back.place((slotWidth * focusFront + gap) / 2, 0.16 - float);
    this.updateBounds();
  }

  private updateBounds() {
    this.bounds.makeEmpty();
    if (this.front.root.visible) this.bounds.union(this.front.bounds);
    if (this.back.root.visible) this.bounds.union(this.back.bounds);
  }

  private separateInPerspective(camera: THREE.PerspectiveCamera) {
    if (!this.front.root.visible || !this.back.root.visible) return false;
    const frontScale = this.front.root.scale.x, backScale = this.back.root.scale.x;
    const totalScale = frontScale + backScale;
    // Let the disappearing view move farther, so the retained phone still eases
    // into the center without a sideways jump when its partner becomes hidden.
    const frontShare = backScale / totalScale, backShare = frontScale / totalScale;
    const frontRight = this.front.bounds.max.x - camera.position.x;
    const backLeft = this.back.bounds.min.x - camera.position.x;
    const screenGap = 0.04 * Math.min(frontScale, backScale) / camera.position.z;
    let separation = 0;
    // A world-space gutter can disappear under perspective when a folded panel
    // projects toward the smaller view. Check both depth extrema of each box.
    for (let f = 0; f < 2; f++) {
      const frontDepth = camera.position.z - (f ? this.front.bounds.max.z : this.front.bounds.min.z);
      for (let b = 0; b < 2; b++) {
        const backDepth = camera.position.z - (b ? this.back.bounds.max.z : this.back.bounds.min.z);
        separation = Math.max(separation,
          (frontRight / frontDepth - backLeft / backDepth + screenGap)
          / (frontShare / frontDepth + backShare / backDepth));
      }
    }
    if (separation <= 0) return false;
    this.front.place(-separation * frontShare, 0);
    this.back.place(separation * backShare, 0);
    this.updateBounds();
    return true;
  }

  fitCamera(camera: THREE.PerspectiveCamera, damping: number) {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const x = Math.max(Math.abs(this.bounds.min.x - camera.position.x), Math.abs(this.bounds.max.x - camera.position.x));
    const y = Math.max(Math.abs(this.bounds.min.y - camera.position.y), Math.abs(this.bounds.max.y - camera.position.y));
    const depth = this.bounds.max.z;
    const target = depth + Math.max(3.9 / tan, (x + 0.5) / (camera.aspect * tan), (y + 0.45) / tan);
    // Ease the framing, but never let a lid move through the near edge of the view
    // while that easing catches up during a fold, rapid rotation, or resize.
    const minimum = depth + Math.max((x + 0.08) / (camera.aspect * tan), (y + 0.08) / tan, camera.near + 0.1);
    camera.position.z = Math.max(minimum, THREE.MathUtils.lerp(camera.position.z, target, damping));
    if (this.separateInPerspective(camera)) {
      const correctedX = Math.max(Math.abs(this.bounds.min.x - camera.position.x), Math.abs(this.bounds.max.x - camera.position.x));
      // Widening the layout may require more camera distance. Moving farther
      // away preserves the projected separation and keeps the outer edges in view.
      camera.position.z = Math.max(camera.position.z, depth + (correctedX + 0.08) / (camera.aspect * tan));
    }
  }
}
