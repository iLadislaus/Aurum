<script>
  // Единое окно снизу: размер, анимация и жесты одни для всех. Открывается на половину, тянется на весь экран.
  // fit: окно по высоте содержимого (до 88%), без половины и «на весь экран»; закрывается свайпом вниз
  let { open = false, onclose, title = '', sub = '', z = 55, fit = false, minh = '', snap = 0.46, full = $bindable(false), lead, footer, children } = $props();

  let dy = $state(0), y0 = null, dragging = $state(false);
  let H = $state(700), shEl, scEl, vel = 0, ly = 0, lt = 0;
  // snap: какая часть высоты окна уходит вниз при открытии (0.46 — видна чуть больше половины, 0.30 — видно 70%)
  const half = $derived(Math.round(H * snap));
  const base = $derived(fit || full ? 0 : half);
  const pos = $derived(Math.max(0, base + dy));

  // при открытии всегда начинаем с половины и верха списка
  $effect(() => {
    if (!open) return;
    full = false; dy = 0;
    if (scEl) scEl.scrollTop = 0;
    if (shEl) H = shEl.offsetHeight;
  });

  function down(e) { if (shEl) H = shEl.offsetHeight; y0 = e.clientY; dy = 0; vel = 0; ly = e.clientY; lt = performance.now(); }
  // положение пальца запоминаем сразу, а окно двигаем один раз за кадр: так тяжёлое содержимое не перерисовывается лишний раз
  let raf = 0, want = 0;
  function move(e) {
    if (y0 == null) return;
    want = Math.max(-base, e.clientY - y0);
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; dy = want; });
    const t = performance.now();
    vel = (e.clientY - ly) / Math.max(1, t - lt); ly = e.clientY; lt = t;
    if (Math.abs(dy) > 4 && !dragging) { dragging = true; e.currentTarget?.setPointerCapture?.(e.pointerId); }
  }
  function up() {
    if (y0 == null) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; dy = want; }
    const p = pos; y0 = null; dragging = false; dy = 0;
    if (fit) { if (vel > 0.5 || p > H * 0.3) onclose?.(); return; }
    if (vel < -0.5) full = true;
    else if (vel > 0.5) { if (full) full = false; else onclose?.(); }
    else {
      const d = [[0, 'f'], [half, 'h'], [H, 'c']].sort((m, n) => Math.abs(m[0] - p) - Math.abs(n[0] - p))[0][1];
      if (d === 'c') onclose?.(); else full = d === 'f';
    }
  }

  // содержимое: на половине тянется само окно; на весь экран — только когда список в самом верху и тянут вниз (как в iOS)
  function grab(node) {
    let on = false, y = 0, x = 0, live = false, skip = false, axis = '', top0 = false;
    // жест внутри выпадающего списка (счета, категории) листает сам список и не тянет окно
    const ts = (e) => { skip = !!e.target.closest?.('[role="listbox"]'); if (skip) { live = false; on = false; return; } y = e.touches[0].clientY; x = e.touches[0].clientX; axis = ''; live = true; on = false; top0 = node.scrollTop <= 0; };
    const tm = (e) => {
      if (!live) return;
      const c = e.touches[0].clientY;
      // жест, начавшийся вбок (лента категорий, значки), листает ленту и не тянет окно
      if (!axis) { const ax = Math.abs(e.touches[0].clientX - x), ay = Math.abs(c - y); if (Math.max(ax, ay) > 6) axis = ax > ay ? 'h' : 'v'; }
      if (axis !== 'v' && !on) return;
      if (!on) {
        if (!full && !fit) { down({ clientY: y }); on = true; }
        else if (top0 && node.scrollTop <= 0 && c - y > 4) { down({ clientY: c }); on = true; }
        else return;
      }
      e.preventDefault(); move({ clientY: c });
    };
    const te = () => { live = false; if (on) { on = false; up(); } };
    node.addEventListener('touchstart', ts, { passive: true });
    node.addEventListener('touchmove', tm, { passive: false });
    node.addEventListener('touchend', te); node.addEventListener('touchcancel', te);
    return { destroy() { node.removeEventListener('touchstart', ts); node.removeEventListener('touchmove', tm); node.removeEventListener('touchend', te); node.removeEventListener('touchcancel', te); } };
  }
</script>

<div class="as" class:open style:z-index={z} aria-hidden={!open}>
  <button class="ov" aria-label="Закрыть" style:opacity={open ? (fit ? Math.max(0, 1 - pos / H) : Math.max(0, Math.min(1, 1 - (pos - half) / (H - half)))) : 0} onclick={() => onclose?.()}></button>
  <div class="sh" class:dragging class:fit class:tall={fit && minh} bind:this={shEl} role="dialog" aria-modal="true" aria-label={title} style:min-height={fit && minh ? minh : undefined} style:transform={open ? `translateY(${pos}px)` : undefined}>
    <div class="top" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
      <div class="gr"></div>
      {@render lead?.()}
      <h3>{title}</h3>
      {#if sub}<p class="st">{sub}</p>{/if}
    </div>
    <div class="sc" class:lock={!full && !fit} bind:this={scEl} use:grab>{@render children?.()}</div>
    {@render footer?.()}
  </div>
</div>

<style>
  .as { position: absolute; inset: 0; pointer-events: none; }
  .as.open { pointer-events: auto; }
  .as.open .ov { will-change: opacity; }
  .as.open .sh { will-change: transform; }
  .ov { position: absolute; inset: 0; width: 100%; background: rgba(0, 0, 0, .4); opacity: 0; transition: opacity .55s cubic-bezier(.3, .6, .25, 1); }
  .sh { position: absolute; left: 14px; right: 14px; bottom: 0; top: calc(env(safe-area-inset-top, 0px) + 24px); display: flex; flex-direction: column;
    background: var(--bg); border-radius: 26px 26px 0 0; overflow: hidden; transform: translateY(105%); transition: transform .62s cubic-bezier(.3, .6, .25, 1);
    box-shadow: inset 0 1px 0 rgba(255, 236, 170, .55), inset 0 0 0 .5px rgba(214, 164, 62, .28), 0 -3px 14px rgba(226, 172, 62, .1); }
  .as.open .sh { transition: transform .5s cubic-bezier(.32, .72, 0, 1); }
  .sh.dragging, .as.open .sh.dragging { transition: none; }
  .sh.fit { top: auto; max-height: calc(100% - env(safe-area-inset-top, 0px) - 24px); }
  .sh.fit .sc { flex: 0 1 auto; min-height: 0; }
  .sh.fit.tall .sc { flex: 1 1 auto; }
  .sh.fit .top { padding-bottom: 20px; }
  .sh.fit .gr { margin-top: 12px; }
  .sh.fit .sc { padding-bottom: 8px; }
  .sh::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 90px; pointer-events: none; background: radial-gradient(70% 100% at 50% 0, rgba(236, 190, 84, .06), transparent); }
  .top { position: relative; flex: none; touch-action: none; padding-bottom: 12px; }
  .gr { width: 36px; height: 5px; border-radius: 3px; background: #C9A24A; opacity: .8; margin: 8px auto; }
  h3 { margin: 0; text-align: center; font-size: 16px; font-weight: 700; }
  .st { margin: 1px 0 0; text-align: center; font-size: 11.5px; color: var(--muted); }
  .sc { position: relative; flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 4px 8px calc(30px + var(--safe-b)); }
  .sc.lock { overflow: hidden; touch-action: none; }
  @media (prefers-color-scheme: dark) {
    .sh { box-shadow: inset 0 1px 0 rgba(255, 232, 160, .3), inset 0 0 0 .5px rgba(232, 194, 119, .26), 0 -3px 14px rgba(240, 190, 90, .09); }
    .sh::before { background: radial-gradient(70% 100% at 50% 0, rgba(240, 200, 110, .05), transparent); }
  }
  @media (prefers-reduced-motion: reduce) { .ov, .sh { transition: none; } }
</style>
