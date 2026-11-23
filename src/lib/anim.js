// Плавный отсчёт числа от 0 до значения (easeOutCubic). Возвращает функцию отмены
export function tween(to, ms, delay, set) {
  let raf;
  const t0 = performance.now() + delay;
  set(0);
  const step = (t) => {
    if (t < t0) { raf = requestAnimationFrame(step); return; }
    const k = Math.min(1, (t - t0) / ms);
    set(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
