<script>
  import { ea, closeEdit } from './editacct.svelte.js';
  import { updateAccount, loadAccounts } from './data.js';
  import { refresh } from './cache.svelte.js';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';

  const PICK = ['wallet', 'cash', 'coin', 'bank', 'gift', 'car', 'home', 'health', 'study', 'sofa', 'family', 'sport', 'film', 'digital', 'cart', 'basket', 'care', 'cloth', 'card', 'dollar', 'euro'];
  let name = $state(''), icon = $state('wallet'), src = $state(false), busy = $state(false), err = $state('');
  const kind = $derived(ea.acc?.kind);

  $effect(() => {
    if (ea.open && ea.acc) { name = ea.acc.name; icon = ea.acc.icon; src = !!ea.acc.src; busy = false; err = ''; }
  });

  async function save() {
    if (busy) return;
    if (!name.trim()) { err = kind === 'debt' ? 'Укажите, кому вы должны' : 'Введите название'; return; }
    busy = true; err = '';
    try {
      await updateAccount(ea.acc.id, { name: name.trim(), icon: kind === 'debt' ? 'user' : icon, budgetSource: src, withSource: kind === 'cash' || kind === 'env' });
      await refresh('accounts', loadAccounts);
      closeEdit();
    } catch (e) { err = e.message || 'Не удалось сохранить'; busy = false; }
  }
</script>

<Sheet open={ea.open} onclose={closeEdit} fit title="Изменить счёт" z={57}>
  <div class="bd">
    <div class="pv">
      <span class="ci"><Icon name={kind === 'debt' ? 'user' : icon} size={20} /></span>
      <span class="pm">{name.trim() || 'Без названия'}</span>
    </div>
    <div class="lb">{kind === 'debt' ? 'Кому должны' : 'Название'}</div>
    <input class="in" maxlength="24" bind:value={name} oninput={() => (err = '')} />
    {#if kind !== 'debt'}
      <div class="lb">Значок</div>
      <div class="strip">
        {#each PICK as k (k)}<button class:s={icon === k} aria-label={k} onclick={() => (icon = k)}><Icon name={k} size={19} /></button>{/each}
      </div>
    {/if}
    {#if kind === 'cash' || kind === 'env'}
      <button class="tg" class:on={src} onclick={() => (src = !src)}><span>Источник бюджета</span><i></i></button>
    {/if}
    {#if err}<p class="er">{err}</p>{/if}
  </div>
  {#snippet footer()}
    <button class="go" disabled={busy} onclick={save}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
  {/snippet}
</Sheet>

<style>
  .bd { padding: 0 2px; }
  .ci { width: 38px; height: 38px; border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 1px 2px rgba(120, 80, 10, .25); }
  .pv { display: flex; align-items: center; gap: 11px; background: var(--card); border-radius: 16px; padding: 11px 13px; box-shadow: 0 0 0 .5px rgba(214, 164, 62, .4), 0 10px 24px -14px rgba(214, 164, 62, .5); }
  .pm { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lb { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 14px 4px 6px; }
  .in { width: 100%; box-sizing: border-box; border: 0; outline: 0; border-radius: 13px; padding: 11px 13px; background: var(--fill); color: var(--text); font-size: 16px; -webkit-user-select: text; user-select: text; }
  .strip { display: flex; gap: 8px; overflow-x: auto; padding: 3px 3px 8px; scrollbar-width: none; }
  .strip::-webkit-scrollbar { display: none; }
  .strip button { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--fill); color: var(--muted); transition: background .2s, color .2s; }
  .strip button.s { color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px rgba(214, 164, 62, .7); }
  .tg { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 12px; padding: 11px 13px; border-radius: 13px; background: var(--card); box-shadow: var(--shadow); font-size: 15px; }
  .tg i { width: 44px; height: 26px; border-radius: 13px; background: var(--fill); position: relative; transition: background .25s; }
  .tg i::after { content: ""; position: absolute; left: 2px; top: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform .25s cubic-bezier(.3, .7, .4, 1); }
  .tg.on i { background: #C9A24A; }
  .tg.on i::after { transform: translateX(18px); }
  .er { margin: 10px 4px 0; font-size: 13px; color: var(--neg); }
  .go { flex: none; margin: 6px 12px calc(14px + var(--safe-b)); height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); box-shadow: 0 6px 16px -6px rgba(226, 172, 62, .6); }
  .go:disabled { opacity: .6; }
</style>
