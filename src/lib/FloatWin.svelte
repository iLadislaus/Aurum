<script>
  // Окно, которое выезжает из карточки баланса: отдельная плашка под ней, фон затемняется, закрывается тапом мимо
  let { open = false, onclose, title = '', top = 150, z = 56, children } = $props();
</script>

<div class="fw" class:open style:z-index={z} aria-hidden={!open}>
  <button class="ov" aria-label="Закрыть" onclick={() => onclose?.()}></button>
  <div class="win" style:top="{top}px" style:--top="{top}px" role="dialog" aria-modal="true" aria-label={title} inert={!open}>
    <h3>{title}</h3>
    <div class="bd">{@render children?.()}</div>
  </div>
</div>

<style>
  .fw { position: absolute; inset: 0; pointer-events: none; }
  .fw.open { pointer-events: auto; }
  .ov { position: absolute; inset: 0; width: 100%; background: rgba(0, 0, 0, .4); opacity: 0; transition: opacity .35s; }
  .open .ov { opacity: 1; }
  .win { position: absolute; left: 14px; right: 14px; max-height: calc(100% - var(--top, 0px) - 96px); display: flex; flex-direction: column; background: var(--bg); border-radius: 22px; overflow: hidden;
    box-shadow: inset 0 1px 0 rgba(255, 236, 170, .55), inset 0 0 0 .5px rgba(214, 164, 62, .28), 0 18px 50px rgba(0, 0, 0, .35);
    opacity: 0; transform: translateY(-14px) scale(.94); transform-origin: 50% 0; transition: opacity .28s, transform .42s cubic-bezier(.32, .72, 0, 1); }
  .open .win { opacity: 1; transform: none; }
  h3 { margin: 0; flex: none; padding: 14px 16px 10px; text-align: center; font-size: 16px; font-weight: 700; }
  .bd { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 0 8px 12px; }
  @media (prefers-color-scheme: dark) { .win { box-shadow: inset 0 1px 0 rgba(255, 232, 160, .3), inset 0 0 0 .5px rgba(232, 194, 119, .26), 0 18px 50px rgba(0, 0, 0, .7); } }
  @media (prefers-reduced-motion: reduce) { .ov, .win { transition: none; } }
</style>
