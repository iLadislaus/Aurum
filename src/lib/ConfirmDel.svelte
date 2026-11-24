<script>
  // Окно «Удалить операцию?»: возврата нет
  let { open = false, onyes, onno } = $props();
</script>

{#if open}
  <div class="dbg" role="presentation" onclick={() => onno?.()}>
    <div class="dlg" role="alertdialog" aria-label="Удалить операцию" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <p><b>Удалить операцию?</b>Вернуть её будет нельзя.</p>
      <div><button onclick={() => onno?.()}>Отмена</button><button class="x" onclick={() => onyes?.()}>Удалить</button></div>
    </div>
  </div>
{/if}

<style>
  .dbg { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .55); animation: dfade .2s both; }
  .dlg { width: 270px; border-radius: 18px; overflow: hidden; text-align: center; background: var(--card); box-shadow: 0 20px 60px rgba(0, 0, 0, .5); animation: dpop .28s cubic-bezier(.2, .9, .3, 1.2) both; }
  .dlg p { margin: 0; padding: 20px 18px 16px; font-size: 14px; line-height: 1.4; color: var(--muted); }
  .dlg p b { display: block; font-size: 17px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .dlg div { display: flex; border-top: .5px solid var(--line); }
  .dlg button { flex: 1; height: 48px; font-size: 16px; color: #C9A24A; }
  .dlg button + button { border-left: .5px solid var(--line); }
  .dlg button.x { color: #E5484D; font-weight: 600; }
  @keyframes dfade { from { opacity: 0; } }
  @keyframes dpop { from { opacity: 0; transform: scale(.9); } }
</style>
