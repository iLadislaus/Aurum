<script>
  import { untrack } from 'svelte';
  import OpAvatar from '../lib/OpAvatar.svelte';
  import { fmt } from '../lib/format.js';
  import { put, peek } from '../lib/cache.svelte.js';
  import SwipeRow from '../lib/SwipeRow.svelte';
  import { sw } from '../lib/swipe.svelte.js';
  import { longpress } from '../lib/longpress.js';
  import { openCtx } from '../lib/ctxmenu.svelte.js';
  import { deleteOp, repeatOp } from '../lib/data.js';
  import { prefetchAll } from '../lib/prefetch.js';
  import { openOp } from '../lib/opcard.svelte.js';
  let { rows, shown } = $props();
  const KEY = 'ops.recent';
  // карточка операции берёт свежую версию из кэша — кладём туда пятёрку с Главной
  $effect(() => { const r = rows; untrack(() => put(KEY, { ops: r })); });
  let err = $state('');
  // удаление и повтор: список правим сразу, потом синхронизируем счета и остальные экраны
  async function remove(t) {
    if (t.mono) return;
    const old = peek('home');
    if (old) put('home', { ...old, recent: old.recent.filter((x) => x.id !== t.id) });
    try { await deleteOp(t.id); prefetchAll(true); }
    catch (e) { if (old) put('home', old); err = e.message || 'Не удалось удалить'; }
  }
  async function repeat(t) {
    if (t.mono) return;
    try { await repeatOp(t); prefetchAll(true); }
    catch (e) { err = e.message || 'Не удалось повторить'; }
  }
  const menu = (el, t) => openCtx(el, [
    ...(t.mono ? [] : [{ t: 'Повторить', icon: 'swap', run: () => repeat(t) }]),
    ...(t.mono ? [] : [{ t: 'Удалить', icon: 'trash', danger: true, run: () => remove(t) }])
  ]);
  const sgn = (t) => (t.action === 'TRANSFER' ? '' : t.v > 0 ? '+' : '−');
  const amt = (t) => sgn(t) + fmt(Math.abs(t.action === 'TRANSFER' ? t.amount : t.v), t.foreign ? 2 : Math.abs(t.amount) % 1 ? 2 : 0) + ' ' + t.sym;
  const when = (iso) => {
    const k = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
    const diff = Math.round((new Date(k(new Date())) - new Date(k(new Date(iso)))) / 86400000);
    return diff <= 0 ? 'сегодня' : diff === 1 ? 'вчера' : new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' });
  };
</script>

<div class="grp" class:in={shown}>
  {#each rows as t, i (t.id)}
    <SwipeRow id={t.id} nodelete={t.mono} norepeat={t.mono} ondelete={() => remove(t)} onrepeat={() => repeat(t)}>
    <div class="op" class:un={t.uncat} class:top={i > 0} role="button" tabindex="0" use:longpress={(el) => menu(el, t)} onclick={() => !sw.id && openOp(t, KEY)} onkeydown={(e) => e.key === 'Enter' && openOp(t, KEY)}>
      {#if t.uncat}<span class="q">?</span>{:else}<OpAvatar icon={t.icon} size={38} name={t.name} />{/if}
      <div class="nm"><b>{t.name}</b><small>{t.cat}{t.acc ? ' · ' + t.acc : ''} · {when(t.date)}</small></div>
      <span class="am" class:pos={t.v > 0 && t.action !== 'TRANSFER'}>{amt(t)}</span>
    </div>
    </SwipeRow>
  {:else}
    <div class="empty">Операций пока нет</div>
  {/each}
</div>
{#if err}<p class="er">{err}</p>{/if}

<style>
  .op.un { background: rgba(229, 88, 77, .07); }
  .op.un .nm small { color: #D43D32; font-weight: 600; }
  .grp { background: var(--card); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; opacity: 0; transform: translateY(10px); transition: opacity .6s, transform .6s; }
  .grp.in { opacity: 1; transform: none; }
  .op { position: relative; display: flex; align-items: center; gap: 11px; padding: 10px 14px; min-height: 56px; cursor: pointer; }
  .op.top::before { content: ""; position: absolute; top: 0; left: 63px; right: 0; height: .5px; background: var(--line); }
  .q { width: 38px; height: 38px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--fill); color: #E5584D; font-weight: 700; }
  .nm { flex: 1; min-width: 0; }
  .nm b { display: block; font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm small { display: block; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .am { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .am.pos { color: var(--pos); }
  .er { margin: 8px 4px 0; font-size: 13px; color: #E5584D; text-align: center; }
  .empty { padding: 18px 16px; color: var(--muted); text-align: center; }
</style>
