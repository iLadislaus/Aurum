<script>
  import { na, closeNew } from './newacct.svelte.js';
  import { createAccount, loadAccounts } from './data.js';
  import { refresh } from './cache.svelte.js';
  import Icon from './Icon.svelte';

  const TYPES = [
    { k: 'cash', t: 'Наличные', s: 'Кошелёк, касса, заначка', icon: 'wallet' },
    { k: 'env', t: 'Конверт', s: 'Деньги под цель или категорию', icon: 'mail' },
    { k: 'fx', t: 'Валютный счёт', s: 'USD, EUR, вне общего баланса', icon: 'dollar' }
  ];
  const PICK = ['wallet', 'cash', 'coin', 'bank', 'gift', 'car', 'home', 'health', 'study', 'sofa', 'family', 'sport', 'film', 'digital', 'cart', 'basket', 'care', 'cloth', 'card'];
  const CURS = [{ c: 'USD', s: '$' }, { c: 'EUR', s: '€' }];
  const KIND = { cash: 'Наличные', env: 'Конверт', fx: 'Валютный счёт · вне общего баланса' };

  let type = $state(null);
  let name = $state(''), icon = $state('wallet'), bal = $state(''), cur = $state('USD'), src = $state(false);
  let busy = $state(false), err = $state('');

  $effect(() => {
    if (na.open) { type = null; name = ''; icon = 'wallet'; bal = ''; cur = 'USD'; src = false; busy = false; err = ''; }
  });

  const sym = $derived(type === 'fx' ? CURS.find((x) => x.c === cur).s : '₴');
  const pick = (t) => { type = t.k; icon = t.icon === 'mail' ? 'mail' : t.k === 'fx' ? 'coin' : t.icon; };
  const amount = $derived(Number(String(bal).replace(/\s/g, '').replace(',', '.')) || 0);

  async function create() {
    if (busy) return;
    if (!name.trim()) { err = 'Введите название'; return; }
    busy = true; err = '';
    try {
      await createAccount({ type, name: name.trim(), icon, currency: type === 'fx' ? cur : 'UAH', budgetSource: type !== 'fx' && src, balance: amount });
      await refresh('accounts', loadAccounts);
      closeNew();
    } catch (e) { err = e.message || 'Не удалось создать счёт'; busy = false; }
  }
</script>

<div class="nw" class:open={na.open} aria-hidden={!na.open}>
  <button class="ov" aria-label="Закрыть" onclick={closeNew}></button>
  <div class="blob" class:go={na.open}></div>
  <div class="sh" class:st2={type} role="dialog" aria-modal="true" aria-label="Новый счёт">
    <div class="gr"></div>
    <div class="hd">
      <button class="bk" aria-label="Назад" onclick={() => (type = null)}><Icon name="chevron" size={20} /></button>
      <span>{type ? TYPES.find((x) => x.k === type).t : 'Новый счёт'}</span>
    </div>
    <div class="stg">
      <div class="s1">
        {#each TYPES as t (t.k)}
          <button class="tl" onclick={() => pick(t)}>
            <span class="ci"><Icon name={t.icon} size={20} /></span>
            <span><b>{t.t}</b><small>{t.s}</small></span>
          </button>
        {/each}
      </div>
      <div class="s2">
        <div class="pv">
          <span class="ci"><Icon name={icon} size={20} /></span>
          <span class="pm"><b>{name.trim() || 'Новый счёт'}</b><small>{type ? KIND[type] : ''}</small></span>
          <em>{amount ? amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} {sym}</em>
        </div>
        <div class="lb">Название</div>
        <input class="in" placeholder="Например, Заначка" maxlength="24" bind:value={name} oninput={() => (err = '')} />
        <div class="lb">Значок</div>
        <div class="strip">
          {#each PICK as k (k)}<button class:s={icon === k} aria-label={k} onclick={() => (icon = k)}><Icon name={k} size={19} /></button>{/each}
        </div>
        {#if type === 'fx'}
          <div class="lb">Валюта</div>
          <div class="cur">{#each CURS as x (x.c)}<button class:s={cur === x.c} onclick={() => (cur = x.c)}>{x.c} {x.s}</button>{/each}</div>
        {/if}
        <div class="lb">Начальный остаток</div>
        <input class="in big" inputmode="decimal" placeholder="0,00" bind:value={bal} />
        {#if type !== 'fx'}
          <button class="tg" class:on={src} onclick={() => (src = !src)}><span>Источник бюджета</span><i></i></button>
        {/if}
        {#if err}<p class="er">{err}</p>{/if}
      </div>
    </div>
    {#if type}<button class="go" disabled={busy} onclick={create}>{busy ? 'Создаю…' : 'Создать счёт'}</button>{/if}
  </div>
</div>

<style>
  .nw { position: absolute; inset: 0; z-index: 56; pointer-events: none; }
  .nw.open { pointer-events: auto; }
  .ov { position: absolute; inset: 0; width: 100%; background: rgba(0, 0, 0, .4); opacity: 0; transition: opacity .35s cubic-bezier(.32, .72, 0, 1); }
  .open .ov { opacity: 1; }
  /* золотой «выстрел» снизу, как в старом приложении */
  .blob { position: absolute; left: 50%; bottom: 0; width: 36px; height: 36px; margin-left: -18px; border-radius: 50%; z-index: 2; pointer-events: none; opacity: 0; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .blob.go { animation: bl .42s cubic-bezier(.2, .8, .2, 1) .06s backwards; }
  @keyframes bl { 0% { transform: translateY(70px); opacity: 1; } 35% { transform: translateY(-4px) scale(1.1); opacity: 1; } 100% { transform: translateY(-30px) scale(10, 1.2); opacity: 0; } }
  .sh { position: absolute; left: 14px; right: 14px; bottom: 0; top: calc(env(safe-area-inset-top, 0px) + 40px); z-index: 3; display: flex; flex-direction: column; background: var(--bg); border-radius: 26px 26px 0 0; overflow: hidden;
    transform: translateY(105%); transition: transform .3s cubic-bezier(.5, 0, .75, 0);
    box-shadow: inset 0 1px 0 rgba(255, 236, 170, .9), inset 0 0 0 .5px rgba(214, 164, 62, .4), 0 -3px 16px rgba(226, 172, 62, .26); }
  .open .sh { transform: none; transition: transform .45s cubic-bezier(.2, .9, .3, 1) .1s; }
  .gr { width: 36px; height: 5px; border-radius: 3px; background: #C9A24A; opacity: .8; margin: 8px auto; flex: none; }
  .hd { position: relative; flex: none; text-align: center; font-size: 16px; font-weight: 700; padding-bottom: 10px; }
  .bk { position: absolute; left: 12px; top: -2px; width: 32px; height: 28px; color: #C9A24A; opacity: 0; pointer-events: none; transition: opacity .25s; transform: rotate(90deg); }
  .st2 .bk { opacity: 1; pointer-events: auto; }
  .stg { position: relative; flex: 1; min-height: 0; }
  .s1, .s2 { position: absolute; inset: 0; padding: 4px 10px calc(70px + var(--safe-b)); overflow-y: auto; transition: transform .45s cubic-bezier(.32, .72, 0, 1), opacity .35s; }
  .s2 { transform: translateX(40px); opacity: 0; pointer-events: none; }
  .st2 .s1 { transform: translateX(-40px); opacity: 0; pointer-events: none; }
  .st2 .s2 { transform: none; opacity: 1; pointer-events: auto; }
  .tl { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: var(--card); border-radius: 16px; padding: 13px; margin-bottom: 8px; box-shadow: var(--shadow); transition: transform .15s; }
  .tl:active { transform: scale(.97); }
  .tl b { display: block; font-size: 15px; font-weight: 600; }
  .tl small, .pm small { display: block; font-size: 12px; color: var(--muted); }
  .ci { width: 38px; height: 38px; border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 1px 2px rgba(120, 80, 10, .25); }
  .pv { display: flex; align-items: center; gap: 11px; background: var(--card); border-radius: 16px; padding: 11px 13px; box-shadow: 0 0 0 .5px rgba(214, 164, 62, .4), 0 10px 24px -14px rgba(214, 164, 62, .5); }
  .pm { flex: 1; min-width: 0; }
  .pm b { display: block; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pv em { font-style: normal; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .lb { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 14px 4px 6px; }
  .in { width: 100%; box-sizing: border-box; border: 0; outline: 0; border-radius: 13px; padding: 11px 13px; background: var(--fill); color: var(--text); font-size: 16px; -webkit-user-select: text; user-select: text; }
  .in.big { font-size: 24px; font-weight: 600; text-align: center; letter-spacing: -.02em; }
  .strip { display: flex; gap: 8px; overflow-x: auto; padding: 3px 3px 8px; scrollbar-width: none; }
  .strip::-webkit-scrollbar { display: none; }
  .strip button { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--fill); color: var(--muted); transition: background .2s, color .2s; }
  .strip button.s { color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px rgba(214, 164, 62, .7); }
  .cur { display: flex; gap: 8px; }
  .cur button { flex: 1; padding: 9px 0; border-radius: 12px; background: var(--fill); color: var(--muted); font-size: 14px; font-weight: 500; }
  .cur button.s { background: var(--gold-soft); color: var(--gold); }
  .tg { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 12px; padding: 11px 13px; border-radius: 13px; background: var(--card); box-shadow: var(--shadow); font-size: 15px; }
  .tg i { width: 44px; height: 26px; border-radius: 13px; background: var(--fill); position: relative; transition: background .25s; }
  .tg i::after { content: ""; position: absolute; left: 2px; top: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform .25s cubic-bezier(.3, .7, .4, 1); }
  .tg.on i { background: #C9A24A; }
  .tg.on i::after { transform: translateX(18px); }
  .er { margin: 10px 4px 0; font-size: 13px; color: var(--neg); }
  .go { position: absolute; left: 12px; right: 12px; bottom: calc(14px + var(--safe-b)); height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); box-shadow: 0 6px 16px -6px rgba(226, 172, 62, .6); }
  .go:disabled { opacity: .6; }
  @media (prefers-reduced-motion: reduce) { .sh, .ov, .s1, .s2 { transition: none; } .blob.go { animation: none; } }
</style>
