// A number-line track: the playfield for games where something moves along numbers (4-3 Undo Machine's cart,
// 4-4 Gear Shift's gear). It draws the line, ticks and labels into an element and turns numbers into positions.
//
//   const track = createTrack(document.getElementById('track'));
//   track.draw({ lo: 0, hi: 40 });      draw the line (call again when the numbers change)
//   track.X(16)                          how far from the element's left edge the number 16 is, in pixels
//   track.valueAt(event.clientX)         the whole number under a pointer, kept on the line
//   track.layer                          put carts, flags and marks in here (it is cleared by draw)
//
// The look is in shared/game/track.css.
export function createTrack(el, { left = 110 } = {}) {
  let axis = { lo: 0, hi: 10 };
  el.classList.add('track');
  el.innerHTML = '<div class="tr-ticks"></div><div class="tr-layer"></div>';
  const ticks = el.querySelector('.tr-ticks'), layer = el.querySelector('.tr-layer');
  const width = () => el.clientWidth - 2 * left;
  const X = (v) => left + ((v - axis.lo) / (axis.hi - axis.lo)) * width();
  function draw(next) {
    axis = next;
    const span = axis.hi - axis.lo, every = span <= 60 ? 1 : span <= 100 ? 2 : 5, label = span <= 20 ? 1 : span <= 60 ? 5 : span <= 100 ? 10 : 20;
    let html = '<div class="tr-bar"></div>';
    for (let v = axis.lo; v <= axis.hi; v += every) {
      html += `<div class="tr-tick ${v % label ? 'small' : ''}" style="left:${X(v)}px"></div>`;
      if (v % label === 0) html += `<div class="tr-label" style="left:${X(v)}px">${v}</div>`;
    }
    ticks.innerHTML = html;
    layer.innerHTML = '';
  }
  function valueAt(clientX) {
    const r = el.getBoundingClientRect();
    const v = axis.lo + ((clientX - r.left - left) / width()) * (axis.hi - axis.lo);
    return Math.round(Math.min(axis.hi, Math.max(axis.lo, v)));
  }
  const clamp = (v) => Math.min(axis.hi, Math.max(axis.lo, v));
  return { draw, X, valueAt, clamp, layer, get axis() { return axis; } };
}
