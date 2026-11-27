<script>
  // Подключение Monobank: токен → выбор карт. Токен живёт только пока открыто это окно
  import { untrack } from 'svelte';
  import { mw } from './monowin.svelte.js';
  import { callMono, loadMono, addedLabel } from './mono.js';
  import { refresh } from './cache.svelte.js';
  import { prefetchAll } from './prefetch.js';
  import { cash } from './format.js';
  import FloatWin from './FloatWin.svelte';
  import Icon from './Icon.svelte';

  const TYPE = { black: 'Black', white: 'White', platinum: 'Platinum', iron: 'Iron', fop: 'ФОП', yellow: 'Yellow', eAid: 'єПідтримка' };
  let token = $state(''), found = $state(null), picked = $state([]), label = $state(''), busy = $state(false), err = $state(''), done = $state('');

  $effect(() => {
    mw.connect;
    untrack(() => { token = ''; found = null; picked = []; label = ''; busy = false; err = ''; done = ''; });
  });
  const close = () => { mw.connect = false; };
  const toggle = (id) => { picked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]; err = ''; };

  async function look() {
    if (busy) return;
    if (!token.trim()) { err = 'Вставьте токен'; return; }
    busy = true; err = '';
    try {
      const r = await callMono('accounts', { token: token.trim() });
      found = r; label = r.label || r.clientName?.split(/\s+/)[1] || '';
      picked = r.accounts.filter((a) => a.accountId).map((a) => a.id);
    } catch (e) { err = e.message; }
    busy = false;
  }
  async function connect() {
    if (busy) return;
    if (!picked.length) { err = 'Выберите хотя бы одну карту'; return; }
    busy = true; err = '';
    try {
      const cards = found.accounts.filter((a) => picked.includes(a.id));
      const r = await callMono('connect', { token: token.trim(), label: label.trim(), clientName: found.clientName, cards });
      token = '';
      done = r.imported ? `Подключено. ${addedLabel(r.imported.created)} за 31 день` : `Подключено. Операции пока не загрузились: ${r.importNote}`;
      if (r.pending?.length) done += '. Остальные карты догрузите в окне Monobank через минуту';
      prefetchAll(true);
      await refresh('mono', loadMono, true).catch(() => {});
    } catch (e) { err = e.message; }
    busy = false;
  }
</script>

<FloatWin open={mw.connect} onclose={close} title={done ? 'Готово' : found ? 'Выберите карты' : 'Подключить Monobank'} top={150} z={57}>
  <div class="bd">
    {#if done}
      <p class="hint ok" role="status">{done}</p>
      <button class="go" onclick={close}>Закрыть</button>
    {:else if !found}
      <p class="hint">Токен берётся на api.monobank.ua</p>
      <div class="grp"><input class="tk" type="password" placeholder="Вставьте токен" autocomplete="off" autocapitalize="off" spellcheck="false" bind:value={token} oninput={() => (err = '')} /></div>
      {#if err}<p class="er">{err}</p>{/if}
      <button class="go" disabled={busy} onclick={look}>{busy ? 'Спрашиваю банк…' : 'Показать карты'}</button>
    {:else}
      <div class="grp"><label class="r"><span>Название</span><input maxlength="30" bind:value={label} /></label></div>
      {#each found.accounts as a (a.id)}
        <button class="pk" class:on={picked.includes(a.id)} aria-pressed={picked.includes(a.id)} onclick={() => toggle(a.id)}>
          <span class="m"><b>{a.name || (TYPE[a.type] ?? a.type)}</b><small>{a.maskedPan[0] ? '•• ' + a.maskedPan[0].slice(-4) + ' · ' : ''}{cash((a.balance - a.creditLimit) / 100, 2, a.currency)}</small></span>
          <i>{#if picked.includes(a.id)}<Icon name="check" size={13} />{/if}</i>
        </button>
      {/each}
      {#if err}<p class="er">{err}</p>{/if}
      <button class="go" disabled={busy} onclick={connect}>{busy ? 'Подключаю…' : 'Подключить'}</button>
    {/if}
  </div>
</FloatWin>

<style>
  .bd { padding: 0 6px 6px; }
  .grp { background: var(--card); border-radius: 16px; box-shadow: var(--shadow); padding: 0 14px; }
  .r { display: flex; align-items: center; gap: 10px; min-height: 46px; font-size: 15px; }
  .r span { color: var(--muted); flex: none; }
  input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--text); font: inherit; font-size: 16px; font-weight: 600; text-align: right; }
  .tk { width: 100%; height: 46px; text-align: left; }
  .pk { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; margin-top: 8px; padding: 8px 14px; border-radius: 16px; background: var(--card); text-align: left; }
  .m { flex: 1; min-width: 0; }
  .m b { display: block; font-size: 15px; font-weight: 600; }
  .m small { display: block; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  i { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 0 1.5px var(--ter); transition: background .25s; }
  .on i { box-shadow: none; color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); }
  .hint { margin: 0 4px 8px; font-size: 12.5px; color: var(--muted); }
  .hint.ok { text-align: center; font-size: 14px; color: var(--pos); }
  .er { margin: 10px 4px 0; font-size: 13px; color: var(--neg); }
  .go { display: block; width: 100%; margin: 14px 0 6px; height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); box-shadow: 0 6px 16px -6px rgba(226, 172, 62, .6); }
  .go:disabled { opacity: .6; }
</style>
