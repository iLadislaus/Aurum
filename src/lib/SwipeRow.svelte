<script>
  // Строка со свайпом как в iOS: влево — «Удалить», вправо — «Повторить». Первое нажатие на кнопку просит подтверждения
  import { sw } from './swipe.svelte.js';
  let { id, ondelete, onrepeat, children } = $props();
  const W = 92;
  let x = $state(0), drag = $state(false), armed = $state(''), timer;
  let open = $derived(sw.id === id);
  $effect(() => { if (!open && x !== 0 && !drag) { x = 0; arm(''); } });

  function arm(k) { armed = k; clearTimeout(timer); if (k) timer = setTimeout(() => (armed = ''), 3000); }
  function swipe(node) {
    let sx = 0, sy = 0, base = 0, lock = '';
    const ts = (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; base = x; lock = ''; if (sw.id !== id) sw.id = ''; };
    const tm = (e) => {
      const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (!lock) { if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return; lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'; if (lock === 'h') { drag = true; sw.id = id; } }
      if (lock !== 'h') return;
      e.preventDefault();
      x = Math.max(-W, Math.min(W, base + dx));
    };
    const te = () => {
      if (lock === 'h') { x = x < -W / 2 ? -W : x > W / 2 ? W : 0; if (x === 0) { sw.id = ''; arm(''); } }
      drag = false; lock = '';
    };
    node.addEventListener('touchstart', ts, { passive: true });
    node.addEventListener('touchmove', tm, { passive: false });
    node.addEventListener('touchend', te); node.addEventListener('touchcancel', te);
    return { destroy() { node.removeEventListener('touchstart', ts); node.removeEventListener('touchmove', tm); node.removeEventListener('touchend', te); node.removeEventListener('touchcancel', te); } };
  }
  function close() { x = 0; sw.id = ''; arm(''); }
  function del() { if (armed === 'd') { close(); ondelete?.(); } else arm('d'); }
  function rep() { if (armed === 'r') { close(); onrepeat?.(); } else arm('r'); }
</script>

<div class="sr" use:swipe>
  <button class="a l" class:armed={armed === 'r'} style:width="{W}px" onclick={rep} tabindex={x > 0 ? 0 : -1}>{armed === 'r' ? 'Точно?' : 'Повторить'}</button>
  <button class="a r" class:armed={armed === 'd'} style:width="{W}px" onclick={del} tabindex={x < 0 ? 0 : -1}>{armed === 'd' ? 'Точно?' : 'Удалить'}</button>
  <div class="c" class:drag style:transform="translateX({x}px)" onclick={() => x !== 0 && close()} role="presentation">{@render children()}</div>
</div>

<style>
  .sr { position: relative; overflow: hidden; touch-action: pan-y; }
  .c { position: relative; background: var(--card); transition: transform .32s cubic-bezier(.32, .72, 0, 1); }
  .c.drag { transition: none; }
  .a { position: absolute; top: 0; bottom: 0; display: grid; place-items: center; font-size: 14px; font-weight: 600; color: #fff; }
  .a.l { left: 0; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .a.r { right: 0; background: #E5484D; }
  .a.armed { filter: brightness(1.12); }
</style>
