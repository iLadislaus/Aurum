<script>
  // Настройки подключения: название, уведомления банка, отключение
  import { untrack } from 'svelte';
  import { mw } from './monowin.svelte.js';
  import { callMono, loadMono, connTitle } from './mono.js';
  import { refresh, peek } from './cache.svelte.js';
  import { prefetchAll } from './prefetch.js';
  import FloatWin from './FloatWin.svelte';

  const conn = $derived(peek('mono')?.connections.find((c) => c.id === mw.conn) ?? null);
  let name = $state(''), start = $state(''), busy = $state(''), armed = $state(false), msg = $state(''), bad = $state(false);

  $effect(() => {
    if (mw.conn == null) return;
    untrack(() => { start = name = conn ? connTitle(conn) : ''; busy = ''; armed = false; msg = ''; });
  });
  const close = () => { mw.conn = null; };

  async function run(key, send, ok, after) {
    if (busy) return;
    busy = key; msg = ''; bad = false;
    try { await send(); await refresh('mono', loadMono, true).catch(() => {}); msg = ok; after?.(); }
    catch (e) { msg = e.message; bad = true; }
    busy = '';
  }
  const connectionId = () => mw.conn;
  const rename = () => run('name', () => callMono('label', { connectionId: connectionId(), label: name.trim() }), 'Название сохранено', () => (start = name));
  const hook = () => run('hook', () => callMono('webhook', { connectionId: connectionId() }), 'Уведомления подключены');
  const drop = () => (armed ? run('drop', () => callMono('disconnect', { connectionId: connectionId() }), '', () => { prefetchAll(true); close(); }) : (armed = true));
</script>

<FloatWin open={mw.conn != null} onclose={close} title="Подключение" top={150} z={57}>
  <div class="bd">
    <div class="grp"><label class="r"><span>Название</span><input maxlength="30" bind:value={name} /></label></div>
    {#if name.trim() && name !== start}<button class="go" disabled={!!busy} onclick={rename}>{busy === 'name' ? 'Сохраняю…' : 'Сохранить название'}</button>{/if}
    <button class="btn" disabled={!!busy} onclick={hook}>{busy === 'hook' ? 'Подключаю…' : 'Переподключить уведомления банка'}</button>
    <button class="btn red" disabled={!!busy} onclick={drop}>{busy === 'drop' ? 'Отключаю…' : armed ? 'Точно отключить?' : 'Отключить Monobank'}</button>
    {#if armed}<p class="hint">Счета и операции останутся, новые перестанут приходить</p>{/if}
    {#if msg}<p class="hint" class:bad role="status">{msg}</p>{/if}
  </div>
</FloatWin>

<style>
  .bd { padding: 0 6px 6px; }
  .grp { background: var(--card); border-radius: 16px; box-shadow: var(--shadow); padding: 0 14px; }
  .r { display: flex; align-items: center; gap: 10px; min-height: 46px; font-size: 15px; }
  .r span { color: var(--muted); flex: none; }
  .r input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--text); font: inherit; font-size: 16px; font-weight: 600; text-align: right; }
  .btn, .go { display: block; width: 100%; min-height: 44px; margin-top: 8px; border-radius: 22px; font-size: 14px; font-weight: 600; color: var(--gold); background: var(--fill); }
  .go { color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); }
  .btn.red { color: var(--neg); }
  button:disabled { opacity: .6; }
  .hint { margin: 10px 4px 0; text-align: center; font-size: 12.5px; color: var(--muted); }
  .hint.bad { color: var(--neg); }
</style>
