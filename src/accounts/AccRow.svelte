<script>
  import Icon from '../lib/Icon.svelte';
  // Строка счёта: при нажатии двигается только значок
  let { icon = 'card', name, sub = '', amount, small = '', neg = false, dim = false, top = true, indent = false, onclick, children } = $props();
  let on = $state(false);
  function tap() {
    on = false;
    requestAnimationFrame(() => { on = true; setTimeout(() => (on = false), 350); });
    onclick?.();
  }
</script>

<button class="rw" class:top class:indent onclick={tap}>
  <span class="av" class:on class:sm={indent} class:dim><Icon name={icon} size={indent ? 16 : 19} /></span>
  <span class="m">
    <span class="t">{name}{@render children?.()}</span>
    {#if sub}<span class="s">{sub}</span>{/if}
  </span>
  <span class="a" class:neg class:dim>{amount}{#if small}<small>{small}</small>{/if}</span>
</button>

<style>
  .rw { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 9px 14px; min-height: 58px; -webkit-tap-highlight-color: transparent; }
  .rw.indent { padding-left: 26px; min-height: 50px; }
  .rw.top::before { content: ""; position: absolute; top: 0; left: 62px; right: 0; height: .5px; background: var(--line); }
  .rw.indent.top::before { left: 74px; }
  .av { width: 36px; height: 36px; border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 1px 2px rgba(120,80,10,.25); }
  .av.sm { width: 30px; height: 30px; }
  .av.dim { opacity: .55; }
  .av.on { animation: act .3s cubic-bezier(.3, 1.6, .5, 1); }
  @keyframes act { 0% { transform: scale(.82); } 55% { transform: scale(1.14); } 100% { transform: scale(1); } }
  .m { flex: 1; min-width: 0; display: block; }
  .t { display: block; font-size: 15px; line-height: 20px; overflow-wrap: anywhere; }
  .s { display: block; font-size: 12px; line-height: 16px; color: var(--muted); }
  .a { flex: none; text-align: right; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .a small { display: block; font-size: 11.5px; font-weight: 400; color: var(--muted); }
  .a.neg { color: var(--neg); }
  .a.dim { color: var(--muted); font-weight: 500; }
  @media (prefers-reduced-motion: reduce) { .av.on { animation: none; } }
</style>
