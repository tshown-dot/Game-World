// Drag or tap: one helper for every game piece a student moves (blocks, tiles).
// Works with a mouse, a touchscreen and a trackpad (pointer events). A press that moves less than 8 px is a tap.
//
//   dragOrTap(event, sourceElement, {
//     targetAt(x, y)   which drop target is under the pointer (anything truthy), or null
//     glow(target)     light up that target (called with null to turn it off)
//     onDrop(target)   the piece was let go over a target
//     onTap()          a tap instead of a drag
//     lift             fade the original while its copy is dragged (default true)
//     scene            an element that gets the "dragging" class while dragging (for the cursor)
//   })
// Call it from the piece's pointerdown handler. Shared styles: .ghost, .lifted, .dragging in shared/game/game.css.
export function dragOrTap(e, src, { targetAt, glow = () => {}, onDrop, onTap = () => {}, lift = true, scene = null }) {
  e.preventDefault();
  const x0 = e.clientX, y0 = e.clientY;
  let ghost = null, over = null;
  const move = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;   // still a tap
    if (!ghost) {
      ghost = src.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.classList.remove('armed');
      ghost.classList.add('ghost');
      document.body.appendChild(ghost);
      if (lift) src.classList.add('lifted');
      scene?.classList.add('dragging');
    }
    ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`;
    over = targetAt(ev.clientX, ev.clientY);
    glow(over);
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    scene?.classList.remove('dragging');
    glow(null);
    if (!ghost) { if (ev.type === 'pointerup') onTap(); return; }
    ghost.remove();
    src.classList.remove('lifted');
    if (ev.type === 'pointerup' && over) onDrop(over);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

/** Is the point inside an element's box? */
export function inside(el, x, y) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
