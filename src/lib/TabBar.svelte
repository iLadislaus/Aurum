<script>
  import { tabs, nav } from './nav.svelte.js';

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

<!-- Золотой градиент для активных иконок -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F6E2A0" />
      <stop offset=".55" stop-color="#D9A542" />
      <stop offset="1" stop-color="#A9792A" />
    </linearGradient>
  </defs>
</svg>

<nav class:press={pressed} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} aria-label="Основное меню">
  <div class="in" bind:this={inner} style:--i={index}>
    <div class="pill"></div>

    <button class:on={nav.tab === 'home'} onclick={() => pick('home')} aria-current={nav.tab === 'home' ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M12 3.4 3.6 10.6a.8.8 0 0 0-.3.6V19a1.5 1.5 0 0 0 1.5 1.5h4.2v-5.8h5.6v5.8h4.2A1.5 1.5 0 0 0 20.2 19v-7.8a.8.8 0 0 0-.3-.6z" /></svg>
      <span>Главная</span>
    </button>

    <button class:on={nav.tab === 'accounts'} onclick={() => pick('accounts')} aria-current={nav.tab === 'accounts' ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path class="f" d="M4.5 6.5h13A2.5 2.5 0 0 1 20 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3 18.5V8a1.5 1.5 0 0 1 1.5-1.5z" />
        <path d="M6 6.5l9-2.8a1.4 1.4 0 0 1 1.8 1.3v1.5" />
        <path class="h" d="M14.5 14h5.5" />
      </svg>
      <span>Счета</span>
    </button>

    <button class:on={nav.tab === 'ops'} onclick={() => pick('ops')} aria-current={nav.tab === 'ops' ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></svg>
      <span>Операции</span>
    </button>

    <button class:on={nav.tab === 'budget'} onclick={() => pick('budget')} aria-current={nav.tab === 'budget' ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path class="f" d="M11 3.6A8.6 8.6 0 1 0 20.4 13H11z" />
        <path class="f" d="M13.6 3.2a8.6 8.6 0 0 1 7.2 7.2h-7.2z" />
      </svg>
      <span>Бюджет</span>
    </button>

    <button class:on={nav.tab === 'more'} onclick={() => pick('more')} aria-current={nav.tab === 'more' ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true" class="dots"><g class="d"><circle cx="5.5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18.5" cy="12" r="1.7" /></g></svg>
      <span>Ещё</span>
    </button>
  </div>
</nav>

<style>
  nav {
    position: fixed; left: 14px; right: 14px; z-index: 10;
    bottom: var(--nav-b);
    height: var(--nav-h); padding: 4px; border-radius: 32px;
    background: var(--glass);
    -webkit-backdrop-filter: blur(22px) saturate(1.9);
    backdrop-filter: blur(22px) saturate(1.9);
    box-shadow: inset 0 0 0 .5px var(--rim), inset 0 1.5px 0 var(--hi), 0 10px 30px var(--glass-shadow);
    touch-action: none; user-select: none; -webkit-user-select: none;
  }
  @media (display-mode: standalone) {
    @supports (height: 100lvh) {
      nav { position: absolute; bottom: auto; top: calc(100lvh - var(--nav-h) - var(--nav-b)); }
    }
  }
  .in { position: relative; height: 100%; display: grid; grid-template-columns: repeat(5, 1fr); }
  /* Золотая «линза» под активным пунктом */
  .pill {
    position: absolute; top: 0; bottom: 0; left: 0; width: 20%; border-radius: 28px;
    background: var(--glass-sel);
    box-shadow: inset 0 0 0 .5px var(--glass-ring), inset 0 1px 0 var(--hi), 0 0 18px var(--glow);
    transform: translateX(calc(var(--i) * 100%));
    transition: transform .5s cubic-bezier(.3,1.4,.5,1), scale .25s;
  }
  nav.press .pill { scale: 1.1; }
  button {
    position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px; min-height: 44px; color: var(--tab-muted); transition: color .25s; outline: none;
  }
  svg { width: 26px; height: 26px; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  svg.dots { stroke: none; }
  svg.dots .d { fill: currentColor; }
  .f { fill: none; }
  .h { stroke: var(--hole); fill: none; }
  span { font-size: 10px; font-weight: 500; white-space: nowrap; }
  /* Активный пункт: иконка заливается золотым градиентом и светится */
  .on { color: var(--gold); }
  .on svg { stroke: url(#gg); animation: spr .55s cubic-bezier(.3,1.6,.5,1); filter: drop-shadow(0 0 5px var(--glow)); }
  .on .f, .on svg.dots .d { fill: url(#gg); }
  @keyframes spr { 0% { transform: scale(.78); } 55% { transform: scale(1.15); } 100% { transform: scale(1); } }
</style>
