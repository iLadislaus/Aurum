// Долгое нажатие (0,4 с): срабатывает, если палец не уехал; после него обычный тап не засчитывается
export function longpress(node, cb) {
  let t = 0, x0 = 0, y0 = 0, fired = false;
  const clear = () => { clearTimeout(t); t = 0; };
  const down = (e) => {
    if (!cb) return;
    fired = false; x0 = e.clientX; y0 = e.clientY;
    clear();
    t = setTimeout(() => { fired = true; t = 0; cb(node); }, 400);
  };
  const move = (e) => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) clear(); };
  const click = (e) => { if (fired) { e.preventDefault(); e.stopImmediatePropagation(); fired = false; } };
  const ctx = (e) => e.preventDefault();
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', clear);
  node.addEventListener('pointercancel', clear);
  node.addEventListener('pointerleave', clear);
  node.addEventListener('click', click, true);
  node.addEventListener('contextmenu', ctx);
  return {
    update(next) { cb = next; },
    destroy() {
      clear();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', clear);
      node.removeEventListener('pointercancel', clear);
      node.removeEventListener('pointerleave', clear);
      node.removeEventListener('click', click, true);
      node.removeEventListener('contextmenu', ctx);
    }
  };
}
