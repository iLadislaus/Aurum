<script>
  import { tabs, nav } from './nav.svelte.js';

  // Линейные иконки 24×24
  const paths = {
    home: ['M3 11l9-8 9 8', 'M5 10v10h14V10'],
    accounts: ['M3 7a2 2 0 0 1 2-2h13v4', 'M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z', 'M16.5 14.5h.01'],
    ops: ['M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01M3 18h.01'],
    budget: ['M21 12A9 9 0 1 1 12 3v9z', 'M15 3.5A9 9 0 0 1 20.5 9H15z'],
    more: ['M5 12h.01M12 12h.01M19 12h.01']
  };

  let inner;
  let pressed = $state(false);
  const index = $derived(Math.max(0, tabs.findIndex((t) => t.id === nav.tab)));

  function pick(id) {
    if (nav.tab !== id) nav.tab = id;
  }
  // Переключаем сразу при касании и пока палец скользит по панели
  function at(e) {
    const r = inner.getBoundingClientRect();
    const i = Math.min(tabs.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * tabs.length)));
    pick(tabs[i].id);
  }
  function down(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pressed = true;
    at(e);
  }
  function move(e) {
    if (pressed) at(e);
  }
  function up() {
    pressed = false;
  }
</script>

<nav class:press={pressed} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} aria-label="Основное меню">
  <div class="in" bind:this={inner} style:--i={index}>
    <div class="pill"></div>
    {#each tabs as t}
      <button class:on={nav.tab === t.id} onclick={() => pick(t.id)} aria-current={nav.tab === t.id ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" aria-hidden="true">{#each paths[t.id] as d}<path {d} />{/each}</svg>
        <span>{t.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  nav {
    position: fixed; left: 14px; right: 14px; z-index: 10;
    bottom: max(12px, calc(var(--safe-b) - 12px));
    height: 66px; padding: 4px; border-radius: 33px;
    background: var(--glass);
    -webkit-backdrop-filter: blur(14px) saturate(2.2) brightness(1.08);
    backdrop-filter: blur(14px) saturate(2.2) brightness(1.08);
    box-shadow: 0 12px 32px var(--glass-shadow), inset 0 1px 1px var(--spec1), inset 0 -1px 1px var(--spec2);
    touch-action: none; user-select: none; -webkit-user-select: none;
  }
  /* Блик по краю стекла */
  nav::before {
    content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
    background: linear-gradient(135deg, var(--spec1), transparent 38%, transparent 62%, var(--spec2));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  }
  .in { position: relative; height: 100%; display: grid; grid-template-columns: repeat(5, 1fr); }
  /* Стеклянная «линза» под активным пунктом */
  .pill {
    position: absolute; top: 0; bottom: 0; left: 0; width: 20%; border-radius: 29px;
    background: var(--glass-sel);
    -webkit-backdrop-filter: blur(6px) brightness(1.15);
    backdrop-filter: blur(6px) brightness(1.15);
    box-shadow: inset 0 1px 1px var(--spec1), inset 0 -1px 1px var(--spec2), 0 2px 10px rgba(0,0,0,.18);
    transform: translateX(calc(var(--i) * 100%));
    transition: transform .55s cubic-bezier(.3,1.35,.5,1), scale .3s cubic-bezier(.3,1.5,.5,1);
  }
  nav.press .pill { scale: 1.14 1.1; }
  button {
    position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px; min-height: 44px; color: var(--tab-muted); transition: color .25s; outline: none;
  }
  svg { width: 25px; height: 25px; stroke: currentColor; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; transition: fill .25s; }
  span { font-size: 10px; font-weight: 600; white-space: nowrap; }
  .on { color: var(--gold); }
  .on svg { fill: var(--gold-soft); animation: spr .55s cubic-bezier(.3,1.6,.5,1); }
  @keyframes spr { 0% { transform: scale(.8); } 55% { transform: scale(1.14); } 100% { transform: scale(1); } }
</style>
