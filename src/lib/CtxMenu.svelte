<script>
  import { ctx, closeCtx } from './ctxmenu.svelte.js';
  import Icon from './Icon.svelte';
  const pick = (it) => { closeCtx(); it.run?.(); };
</script>

<div class="cx" class:open={ctx.open} aria-hidden={!ctx.open}>
  <button class="bl" aria-label="Закрыть меню" onclick={closeCtx}></button>
  <div class="lift" style:top="{ctx.top}px" style:left="{ctx.left}px" style:width="{ctx.width}px" style:height="{ctx.height}px" inert>{@html ctx.html}</div>
  <div class="menu" class:up={ctx.up} style:left="{Math.min(Math.max(12, ctx.left), 9999)}px" style:top={ctx.up ? 'auto' : ctx.mtop + 'px'} style:bottom={ctx.up ? ctx.mbottom + 'px' : 'auto'} role="menu">
    {#each ctx.items as it, k}
      <button class="mi" class:dg={it.danger} class:sp={it.sep} style:--k={k} role="menuitem" onclick={() => pick(it)}>
        <span>{it.t}</span><Icon name={it.icon} size={19} />
      </button>
    {/each}
  </div>
</div>

<style>
  .cx { position: absolute; inset: 0; z-index: 60; pointer-events: none; }
  .cx.open { pointer-events: auto; }
  .bl { position: absolute; inset: 0; width: 100%; background: rgba(0, 0, 0, .28); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); opacity: 0; transition: opacity .3s cubic-bezier(.32, .72, 0, 1); }
  .open .bl { opacity: 1; }
  .lift { position: absolute; z-index: 2; border-radius: 14px; overflow: hidden; background: var(--card); opacity: 0; transform: scale(1); transition: transform .32s cubic-bezier(.2, .9, .3, 1.25), opacity .12s; box-shadow: 0 14px 40px rgba(0, 0, 0, .35); }
  .open .lift { opacity: 1; transform: scale(1.035); }
  .lift :global(.rw::before) { display: none; }
  .menu { position: absolute; z-index: 3; width: 236px; border-radius: 16px; overflow: hidden; transform-origin: 24px 0; transform: scale(.6); opacity: 0;
    background: rgba(250, 250, 252, .82); -webkit-backdrop-filter: blur(30px) saturate(1.8); backdrop-filter: blur(30px) saturate(1.8);
    box-shadow: 0 18px 50px rgba(0, 0, 0, .3), inset 0 0 0 .5px rgba(255, 255, 255, .7);
    transition: transform .36s cubic-bezier(.2, .9, .3, 1.2), opacity .18s; }
  .menu.up { transform-origin: 24px 100%; }
  .open .menu { transform: scale(1); opacity: 1; }
  .mi { display: flex; align-items: center; justify-content: space-between; width: 100%; height: 46px; padding: 0 14px; font-size: 15px; color: #000; text-align: left;
    border-top: .5px solid rgba(60, 60, 67, .18); opacity: 0; transform: translateY(-4px); transition: opacity .25s, transform .25s; }
  .mi:first-child { border-top: 0; }
  .open .mi { opacity: 1; transform: none; transition-delay: calc(var(--k) * 40ms + 110ms); }
  .mi :global(svg) { color: #6C6C70; }
  .mi.sp { border-top: 5px solid rgba(60, 60, 67, .12); }
  .mi.dg, .mi.dg :global(svg) { color: var(--neg); }
  .mi:active { background: rgba(60, 60, 67, .12); transition-delay: 0s; }
  @media (prefers-color-scheme: dark) {
    .bl { background: rgba(0, 0, 0, .5); }
    .menu { background: rgba(44, 44, 46, .78); box-shadow: 0 18px 50px rgba(0, 0, 0, .7), inset 0 0 0 .5px rgba(255, 255, 255, .14); }
    .mi { color: #fff; border-color: rgba(255, 255, 255, .12); }
    .mi :global(svg) { color: #98989F; }
    .mi.sp { border-top-color: rgba(255, 255, 255, .1); }
  }
  @media (prefers-reduced-motion: reduce) { .bl, .lift, .menu, .mi { transition: none; } }
</style>
