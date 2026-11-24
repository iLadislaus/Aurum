<script>
  import { da, closeDelete } from './delacct.svelte.js';
  import { countAccountOps, deleteAccount, loadAccounts } from './data.js';
  import { peek, refresh } from './cache.svelte.js';
  import { cash } from './format.js';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';

  let n = $state(null), cands = $state([]), to = $state(null), busy = $state(false), err = $state(''), done = $state('');
  const a = $derived(da.acc);
  const word = (k) => (k % 10 === 1 && k % 100 !== 11 ? 'операция' : [2, 3, 4].includes(k % 10) && ![12, 13, 14].includes(k % 100) ? 'операции' : 'операций');

  // куда можно перенести: тот же вид и та же валюта; карты Monobank в список не попадают
  function pool(acc) {
    const d = peek('accounts');
    if (!d || !acc) return [];
    let l = [];
    if (acc.kind === 'cash') l = d.cashes;
    else if (acc.kind === 'env') l = d.envs;
    else if (acc.kind === 'fx') l = (d.foreign.find((f) => f.currency === acc.currency)?.list ?? []);
    else if (acc.kind === 'debt') l = d.debts.filter((x) => x.currency === acc.currency);
    return l.filter((x) => x.id !== acc.id);
  }

  $effect(() => {
    if (!da.open || !da.acc) return;
    to = null; busy = false; err = ''; done = ''; n = null;
    cands = pool(da.acc);
    countAccountOps(da.acc.id).then((k) => (n = k)).catch((e) => (err = e.message || 'Не удалось получить операции'));
  });

  async function go() {
    if (busy || n == null) return;
    if (n > 0 && !to) { err = 'Выберите счёт для переноса'; return; }
    busy = true; err = '';
    try {
      await deleteAccount(a.id, n > 0 ? to : null);
      done = n > 0 ? `${n} ${word(n)} перенесено в ${cands.find((x) => x.id === to)?.name ?? ''}` : 'Счёт удалён';
      await refresh('accounts', loadAccounts);
      setTimeout(closeDelete, 1100);
    } catch (e) { err = e.message || 'Не удалось удалить счёт'; busy = false; }
  }
</script>

<Sheet open={da.open} onclose={closeDelete} fit title={a ? `Удалить «${a.name}»` : 'Удалить счёт'} z={57}>
  <div class="bd">
    {#if done}
      <div class="ok"><span class="ck"><Icon name="check" size={26} /></span><b>{done}</b></div>
    {:else if n == null}
      <p class="sb">Считаю операции…</p>
    {:else if n === 0}
      <p class="sb">Операций на этом счёте нет. Счёт будет удалён.</p>
    {:else if !cands.length}
      <p class="sb">На счёте {n} {word(n)}, а подходящего счёта для переноса нет. Сначала создайте другой счёт того же вида{a?.currency && a.currency !== 'UAH' ? ' и валюты' : ''}.</p>
    {:else}
      <p class="sb">На счёте {n} {word(n)}. Выберите, куда их перенести{a?.balance ? `: остаток ${cash(a.balance)} перейдёт вместе с ними` : ''}.</p>
      <div class="lb">Перенести на</div>
      {#each cands as x (x.id)}
        <button class="op" class:s={to === x.id} onclick={() => { to = x.id; err = ''; }}>
          <span class="ci"><Icon name={x.icon || 'wallet'} size={17} /></span>
          <span class="nm">{x.name}</span>
          <span class="rd"><Icon name="check" size={13} /></span>
        </button>
      {/each}
    {/if}
    {#if err}<p class="er">{err}</p>{/if}
  </div>
  {#snippet footer()}
    {#if !done && n != null && (n === 0 || cands.length)}
      <button class="go" class:r={n === 0 || to} disabled={busy} onclick={go}>{busy ? 'Удаляю…' : n === 0 ? 'Удалить' : 'Перенести и удалить'}</button>
    {/if}
  {/snippet}
</Sheet>

<style>
  .bd { padding: 0 2px; }
  .sb { margin: 2px 8px 10px; text-align: center; font-size: 13px; line-height: 1.45; color: var(--muted); }
  .lb { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 8px 4px 6px; }
  .op { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: var(--card); border-radius: 14px; padding: 8px 12px; margin-bottom: 6px; box-shadow: var(--shadow); transition: box-shadow .25s; }
  .op.s { box-shadow: 0 0 0 1.5px #C9A24A; }
  .ci { width: 32px; height: 32px; border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .nm { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; }
  .rd { width: 20px; height: 20px; border-radius: 50%; flex: none; display: grid; place-items: center; color: transparent; box-shadow: inset 0 0 0 1.5px var(--line); transition: all .25s; }
  .op.s .rd { color: #fff; background: #C9A24A; box-shadow: none; }
  .ok { display: grid; justify-items: center; gap: 10px; padding: 14px 0 6px; font-size: 14px; text-align: center; }
  .ck { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: #C9A24A; animation: pop .45s cubic-bezier(.2, .9, .25, 1.3); }
  @keyframes pop { from { transform: scale(.4); } to { transform: none; } }
  .er { margin: 8px 4px 0; text-align: center; font-size: 13px; color: var(--neg); }
  .go { flex: none; margin: 6px 12px calc(14px + var(--safe-b)); height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; color: var(--muted); background: var(--fill); transition: all .3s; }
  .go.r { color: #fff; background: #D6504F; }
  .go:disabled { opacity: .6; }
</style>
