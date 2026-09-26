/** Horizontal touch drags rotate; the browser owns vertical pans and pinch zoom. */
export function bindPhoneDrag(
  element: HTMLElement,
  rotate: (pixels: number) => void,
  hover: (x: number, y: number) => void,
) {
  let pointer: number | null = null;
  let touch = false, horizontal = false;
  let startX = 0, startY = 0, lastX = 0;

  const finish = (event?: PointerEvent) => {
    if (event && event.pointerId !== pointer) return;
    const id = pointer;
    pointer = null;
    horizontal = false;
    element.classList.remove("is-dragging");
    if (id !== null && element.hasPointerCapture(id)) element.releasePointerCapture(id);
    if (touch) hover(0, 0);
    touch = false;
  };
  const down = (event: PointerEvent) => {
    if (event.pointerType === "touch" && !event.isPrimary) {
      if (touch) finish();
      return;
    }
    if (event.button !== 0 || (pointer !== null && pointer !== event.pointerId)) return;
    pointer = event.pointerId;
    touch = event.pointerType === "touch";
    horizontal = !touch;
    startX = lastX = event.clientX;
    startY = event.clientY;
    if (touch) hover(0, 0);
    else element.classList.add("is-dragging");
    element.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && (pointer === null || pointer === event.pointerId)) {
      const rect = element.getBoundingClientRect();
      hover((event.clientX - rect.left) / rect.width - 0.5,
        (event.clientY - rect.top) / rect.height - 0.5);
    }
    if (event.pointerId !== pointer) return;
    if (touch && !horizontal) {
      const dx = event.clientX - startX, dy = event.clientY - startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        finish(event);
        return;
      }
      horizontal = true;
      element.classList.add("is-dragging");
    }
    rotate(event.clientX - lastX);
    lastX = event.clientX;
  };
  const leave = () => hover(0, 0);
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", finish);
  element.addEventListener("pointercancel", finish);
  element.addEventListener("lostpointercapture", finish);
  element.addEventListener("pointerleave", leave);
  return () => {
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", finish);
    element.removeEventListener("pointercancel", finish);
    element.removeEventListener("lostpointercapture", finish);
    element.removeEventListener("pointerleave", leave);
    finish();
  };
}
