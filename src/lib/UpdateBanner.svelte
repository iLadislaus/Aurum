<script>
  import { update, applyUpdate } from './update.svelte.js';
</script>

{#if update.available}
  <button class="upd" onclick={applyUpdate}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg>
    Обновить до версии {update.version}
  </button>
{/if}

<style>
  /* Овальная чипса из золотого стекла (Liquid Glass): золото внутри всегда, на светлой и тёмной теме */
  .upd {
    position: fixed; z-index: 11; left: 0; right: 0; margin: 0 auto; width: max-content; max-width: calc(100% - 28px);
    bottom: calc(var(--nav-b) + var(--nav-h) + 10px);
    display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 20px 0 15px; border-radius: 999px;
    overflow: hidden; isolation: isolate; color: #2A1D05; font-size: 14.5px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap;
    background: linear-gradient(180deg, rgba(246, 208, 110, .86), rgba(204, 150, 44, .84));
    -webkit-backdrop-filter: blur(20px) saturate(2); backdrop-filter: blur(20px) saturate(2);
    text-shadow: 0 .5px 0 rgba(255, 244, 205, .6);
    box-shadow: inset 0 0 0 .8px rgba(255, 240, 190, .85), inset 0 2px 1px rgba(255, 255, 255, .8), inset 0 -3px 5px rgba(140, 92, 8, .36), 0 12px 26px -8px rgba(130, 86, 8, .65), 0 0 22px rgba(240, 190, 90, .35);
    animation: rise .45s cubic-bezier(.2, .9, .25, 1.2) both;
    transition: transform .15s;
  }
  /* переливающееся золото по стеклу */
  .upd::before {
    content: ""; position: absolute; inset: 0; border-radius: inherit; z-index: -1;
    background: linear-gradient(105deg, rgba(196, 142, 46, .0) 0%, rgba(255, 241, 190, .55) 24%, rgba(255, 250, 220, .25) 38%, rgba(201, 149, 50, 0) 56%, rgba(255, 236, 170, .5) 80%, rgba(196, 142, 46, 0) 100%);
    background-size: 260% 100%; animation: flow 4.5s ease-in-out infinite;
  }
  /* блик, проходящий по кнопке */
  .upd::after {
    content: ""; position: absolute; top: 0; bottom: 0; width: 34%; left: -50%; z-index: -1;
    background: linear-gradient(100deg, transparent, rgba(255, 255, 255, .6), transparent); transform: skewX(-20deg);
    animation: sh 4.5s ease-in-out 1.2s infinite;
  }
  @media (display-mode: standalone) {
    @supports (height: 100lvh) {
      .upd { position: absolute; bottom: auto; top: calc(100lvh - var(--nav-b) - var(--nav-h) - 10px - 42px); }
    }
  }
  .upd:active { transform: scale(.95); }
  svg { width: 17px; height: 17px; stroke: currentColor; fill: none; stroke-width: 2.3; stroke-linecap: round; stroke-linejoin: round; animation: sp 2.6s cubic-bezier(.5, 0, .2, 1) 1.2s infinite; }
  @keyframes flow { 0%, 100% { background-position: 100% 0; } 50% { background-position: 0 0; } }
  @keyframes sh { 0%, 55% { left: -50%; } 100% { left: 130%; } }
  @keyframes sp { 0%, 60% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .upd, .upd::before, .upd::after, svg { animation: none; } }
</style>
