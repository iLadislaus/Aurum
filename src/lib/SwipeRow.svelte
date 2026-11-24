<script>
  // Строка со свайпом как в iOS: влево — «Удалить», вправо — «Повторить». Первое нажатие на кнопку просит подтверждения
  import { sw } from './swipe.svelte.js';
  let { id, ondelete, onrepeat, nodelete = false, norepeat = false, rlabel = 'Повторить', dlabel = 'Удалить', dgold = false, full = false, rconfirm = true, dconfirm = true, children } = $props();
  const W = 92;
  let x = $state(0), drag = $state(false), armed = $state(''), timer, wd = 320;
  const FT = () => Math.round(wd * 0.42);
  let hot = $derived(full && x > FT() ? 1 : full && x < -FT() ? -1 : 0);
  let open = $derived(sw.id === id);
  $effect(() => { if (!open && x !== 0 && !drag) { x = 0; arm(''); } });

  function arm(k) { armed = k; clearTimeout(timer); if (k) timer = setTimeout(() => (armed = ''), 3000); }
  function swipe(node) {
    let sx = 0, sy = 0, base = 0, lock = '';
    const ts = (e) => { wd = node.offsetWidth || wd; sx = e.touches[0].clientX; sy = e.touches[0].clientY; base = x; lock = ''; if (sw.id !== id) sw.id = ''; };
    const tm = (e) => {
      const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (!lock) { if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return; lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'; if (lock === 'h') { drag = true; sw.id = id; } }
      if (lock !== 'h') return;
      e.preventDefault();
      const lim = full ? wd : W;
      x = Math.max(nodelete ? 0 : -lim, Math.min(norepeat ? 0 : lim, base + dx));
    };
    const te = () => {
      if (lock === 'h' && hot !== 0) { commit(hot); drag = false; lock = ''; return; }
      if (lock === 'h') { x = x < -W / 2 ? -W : x > W / 2 ? W : 0; if (x === 0) { sw.id = ''; arm(''); } }
      drag = false; lock = '';
    };
    node.addEventListener('touchstart', ts, { passive: true });
    node.addEventListener('touchmove', tm, { passive: false });
    node.addEventListener('touchend', te); node.addEventListener('touchcancel', te);
    return { destroy() { node.removeEventListener('touchstart', ts); node.removeEventListener('touchmove', tm); node.removeEventListener('touchend', te); node.removeEventListener('touchcancel', te); } };
  }
  // длинная оттяжка: строка уезжает до конца, действие запускается сразу, без нажатия на кнопку
  function commit(dir) {
    drag = false; x = dir * wd;
    setTimeout(() => { if (dir > 0) onrepeat?.(); else ondelete?.(); }, 180);
    setTimeout(close, 650);
  }
  function close() { x = 0; sw.id = ''; arm(''); }
  function del() { if (nodelete) return; if (!dconfirm || armed === 'd') { close(); ondelete?.(); } else arm('d'); }
  function rep() { if (norepeat) return; if (!rconfirm) { close(); onrepeat?.(); return; } if (armed === 'r') { close(); onrepeat?.(); } else arm('r'); }
</script>

<div class="sr" use:swipe>
  {#if !norepeat}<button class="a l" class:armed={armed === 'r'} class:hot={hot > 0} style:width="{Math.max(W, x)}px" onclick={rep} tabindex={x > 0 ? 0 : -1}>{armed === 'r' ? 'Точно?' : rlabel}</button>{/if}
  {#if !nodelete}<button class="a r" class:armed={armed === 'd'} class:gold={dgold} class:hot={hot < 0} style:width="{Math.max(W, -x)}px" onclick={del} tabindex={x < 0 ? 0 : -1}>{armed === 'd' ? 'Точно?' : dlabel}</button>{/if}
  <div class="c" class:drag style:transform="translateX({x}px)" onclick={() => x !== 0 && close()} role="presentation">{@render children()}</div>
</div>

<style>
  .sr { position: relative; overflow: hidden; touch-action: pan-y; }
  .c { position: relative; background: var(--card); transition: transform .32s cubic-bezier(.32, .72, 0, 1); }
  .c.drag { transition: none; }
  .a { position: absolute; top: 0; bottom: 0; display: grid; place-items: center; font-size: 14px; font-weight: 600; color: #fff; }
  .a.l { left: 0; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .a.r { right: 0; background: #E5484D; }
  .a.r.gold { background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .a.hot { filter: brightness(1.12); font-size: 15px; }
  .a.armed { filter: brightness(1.12); }
</style>
