<script>
  import { update, applyUpdate } from './update.svelte.js';
</script>

{#if update.available}
  <button class="upd" onclick={applyUpdate}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg>
    Доступна новая версия · Обновить
  </button>
{/if}

<style>
  .upd {
    position: fixed; z-index: 11; left: 0; right: 0; margin: 0 auto; width: max-content; max-width: calc(100% - 28px);
    bottom: calc(max(12px, calc(var(--safe-b) - 12px)) + 64px + 10px);
    display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px;
    background: var(--glass); color: var(--gold); font-size: 13px; font-weight: 600;
    -webkit-backdrop-filter: blur(22px) saturate(1.9); backdrop-filter: blur(22px) saturate(1.9);
    box-shadow: inset 0 0 0 .5px var(--glass-ring), inset 0 1px 0 var(--hi), 0 8px 24px var(--glass-shadow), 0 0 16px var(--glow);
    animation: rise .35s cubic-bezier(.2,.8,.2,1) both;
  }
  .upd:active { scale: .96; }
  svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
</style>
