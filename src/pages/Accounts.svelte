<script>
  import { onMount } from 'svelte';
  import { loadAccounts } from '../lib/data.js';
  import { loadRates, cachedRates } from '../lib/rate.js';
  import { peek, refresh } from '../lib/cache.svelte.js';
  import { cash, fmt } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';
  import BalanceDetail from '../home/BalanceDetail.svelte';
  import AccRow from '../accounts/AccRow.svelte';
  import { openCtx } from '../lib/ctxmenu.svelte.js';
  import { openAcct } from '../lib/acctsheet.svelte.js';
  import { openNew } from '../lib/newacct.svelte.js';
  import { envIcon } from '../lib/icons.js';

  // Меню по долгому нажатию. Сами действия подключим вместе с их экранами, пока меню просто закрывается
  const op = { t: 'Новая операция', icon: 'plus' }, tr = { t: 'Перевод', icon: 'swap' }, ed = { t: 'Изменить', icon: 'pen' };
  const del = { t: 'Удалить', icon: 'trash', danger: true, sep: true };
  const menuCard = (el) => openCtx(el, [op, tr, ed, { t: 'Скрыть счёт', icon: 'eyeoff', sep: true }]);
  const menuCash = (el) => openCtx(el, [op, tr, ed, del]);
  const menuEnv = (el) => openCtx(el, [op, { t: 'Перевод', icon: 'swap' }, ed, del]);

  let d = $derived(peek('accounts'));
  let rates = $state(cachedRates());
  let err = $state('');
  let shown = $state(false);
  let monoOpen = $state(false);
  const toggleMono = () => (monoOpen = !monoOpen);

  onMount(async () => {
    if (d) requestAnimationFrame(() => requestAnimationFrame(() => (shown = true)));
    try {
      const [, r] = await Promise.all([refresh('accounts', loadAccounts), loadRates()]);
      if (r) rates = r;
    } catch (e) { if (!d) { err = e.message || 'Не удалось загрузить данные'; return; } }
    requestAnimationFrame(() => requestAnimationFrame(() => (shown = true)));
  });

  const CUR = { USD: '$', EUR: '€' };
  const uniq = (l) => [...new Set(l)];
  let envList = $derived(d ? d.envs : []);
  // пустые конверты прячутся под стрелкой, как в iOS
  const isEmpty = (e) => Math.abs(e.balance) < 0.005;
  let envFull = $derived(envList.filter((e) => !isEmpty(e)));
  let envEmpty = $derived(envList.filter(isEmpty));
  let emptyOpen = $state(false);

  // долг в гривнах по курсу Monobank; если курса нет, остаётся в исходной валюте
  let debts = $derived.by(() => {
    if (!d) return [];
    return d.debts.map((x) => {
      const rate = x.currency === 'UAH' ? 1 : rates?.[x.currency];
      const own = fmt(x.amount, 0) + ' ' + (CUR[x.currency] ?? '₴');
      return rate
        ? { ...x, uah: x.amount * rate, amount: x.currency === 'UAH' ? '−' + own : '≈ −' + fmt(x.amount * rate, 0) + ' ₴', small: x.currency === 'UAH' ? '' : own }
        : { ...x, uah: null, amount: '−' + own, small: '' };
    });
  });
  // долги в гривнах по курсу; без курса учитываем только гривневые
  let debtSum = $derived(debts.reduce((t, x) => t + (x.uah ?? 0), 0));
  const date = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
</script>

<section>
  <div class="head rise">
    <div>
      <div class="d">Счета и конверты</div>
      <h1 class="large-title">Счета</h1>
    </div>
    <button class="plus" aria-label="Новый счёт" onclick={openNew}><Icon name="plus" size={20} /></button>
  </div>

  {#if err}
    <p class="msg">{err}</p>
  {:else if !d}
    <p class="msg">Загружаю…</p>
  {:else}
    <div class="rise" style="--i:1"><BalanceDetail total={d.total} delta={d.delta} pct={d.pct} cardCash={d.cardCashTotal} envs={d.envsTotal} debt={debtSum} /></div>

    <div class="sh rise" style="--i:2"><h2>Карта и наличные</h2><span>{cash(d.cardCashTotal)}</span></div>
    <div class="cd rise" style="--i:2">
      {#if d.cards.length}
        <AccRow icon="card" name="Monobank" sub="на всех картах" amount={cash(d.cardsTotal)} neg={d.cardsTotal < 0} top={false} onclick={toggleMono}>
          <span class="cp">{d.cards.length} {d.cards.length === 1 ? 'card' : 'cards'}<span class="ch" class:o={monoOpen}><Icon name="chevron" size={13} /></span></span>
        </AccRow>
        {#if monoOpen}
          <div class="sub">
            {#each d.cards as c, i (c.id)}
              <AccRow icon="card" indent name={c.name} sub={c.limit > 0 ? 'кредитный лимит ' + cash(c.limit, 0) : ''} amount={cash(c.balance)} neg={c.balance < 0} top={true} onclick={() => openAcct({ id: c.id, name: c.name, kind: 'Карта Monobank', balance: c.balance, limit: c.limit })} onlong={menuCard} />
            {/each}
          </div>
        {/if}
      {/if}
      {#each d.cashes as c, i (c.id)}
        <AccRow icon={/cash/i.test(c.name) ? 'cash' : 'wallet'} name={c.name} amount={cash(c.balance)} neg={c.balance < 0} top={d.cards.length > 0 || i > 0} onclick={() => openAcct({ id: c.id, name: c.name, kind: /cash/i.test(c.name) ? 'Наличные' : 'Кошелёк', balance: c.balance })} onlong={menuCash} />
      {/each}
    </div>

    {#if debts.length}
      <div class="sh rise" style="--i:3"><h2>Долги</h2></div>
      <div class="cd rise" style="--i:3">
        {#each debts as x, i (x.id)}
          <AccRow icon="user" name={x.name} amount={x.amount} small={x.small} neg top={i > 0} />
        {/each}
      </div>
    {/if}

    <div class="sh rise" style="--i:4"><h2>Конверты</h2><span>{cash(d.envsTotal, 0)}</span></div>
    <div class="cd rise" style="--i:4">
      {#each envFull as e, i (e.id)}
        <AccRow icon={envIcon(e.name)} name={e.name} amount={cash(e.balance, 0)} top={i > 0} onclick={() => openAcct({ id: e.id, name: e.name, kind: 'Конверт', balance: e.balance })} onlong={menuEnv} />
      {/each}
      {#if envEmpty.length}
        <div class="ex" class:o={emptyOpen}>
          <div>
            {#each envEmpty as e, i (e.id)}
              <div class="exr" style="--d:{i * 35}ms"><AccRow icon={envIcon(e.name)} name={e.name} amount={cash(e.balance, 0)} dim top={envFull.length > 0 || i > 0} onclick={() => openAcct({ id: e.id, name: e.name, kind: 'Конверт', balance: e.balance })} onlong={menuEnv} /></div>
            {/each}
          </div>
        </div>
        <button class="tg" class:t={envFull.length > 0 || emptyOpen} class:o={emptyOpen} onclick={() => (emptyOpen = !emptyOpen)}>
          <span>{emptyOpen ? 'Скрыть пустые' : 'Показать пустые · ' + envEmpty.length}</span><span class="tc"><Icon name="chevron" size={16} /></span>
        </button>
      {:else if !envFull.length}
        <p class="empty">Конвертов пока нет</p>
      {/if}
    </div>

    {#if d.foreign.length}
      {@const fxSum = d.foreign.reduce((t, f) => t + (rates?.[f.currency] ? f.balance * rates[f.currency] : 0), 0)}
      <div class="sh rise" style="--i:5"><h2>Валютные счета</h2><span>{fxSum ? '≈ ' + cash(Math.round(fxSum), 0) : ''}</span></div>
      <div class="cd rise" style="--i:5">
        {#each d.foreign as f, gi (f.currency)}
          <div class="cap" class:t={gi > 0}><span>{f.currency === 'USD' ? 'Доллары' : f.currency === 'EUR' ? 'Евро' : f.currency}</span>{#if rates?.[f.currency]}<small>≈ {cash(Math.round(f.balance * rates[f.currency]), 0)}</small>{/if}</div>
          {#each [...(f.list ?? [])].sort((x, y) => y.balance - x.balance || x.name.localeCompare(y.name)) as a, i (a.id)}
            <AccRow icon={f.currency === 'EUR' ? 'euro' : 'dollar'} name={a.name} amount={cash(a.balance, 2, f.currency)} dim={Math.abs(a.balance) < 0.005} top={i > 0} onclick={() => openAcct({ id: a.id, name: a.name, kind: 'Валютный счёт · ' + (f.currency === 'USD' ? 'доллары' : f.currency === 'EUR' ? 'евро' : f.currency), balance: a.balance, currency: f.currency })} onlong={menuCash} />
          {/each}
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  section { padding: 0 16px calc(110px + var(--safe-b)); }
  .head { display: flex; justify-content: space-between; align-items: flex-end; padding: calc(env(safe-area-inset-top, 0px) + 33px) 4px 14px; }
  .d { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .plus { width: 44px; height: 44px; display: grid; place-items: center; }
  .plus :global(svg) { width: 36px !important; height: 36px !important; padding: 8px; box-sizing: border-box; border-radius: 50%; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .sh { display: flex; justify-content: space-between; align-items: baseline; margin: 24px 4px 8px; }
  .sh h2 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: .35px; }
  .sh span { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .cd { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
  .msg { text-align: center; color: var(--muted); padding: 40px 0; }
  .empty { margin: 0; padding: 16px; text-align: center; color: var(--muted); }
  .cp { display: inline-flex; align-items: center; gap: 3px; margin-left: 8px; padding: 1px 6px 1px 9px; border-radius: 99px; font-size: 11.5px; font-weight: 600; color: var(--gold); background: var(--gold-soft); vertical-align: 1px; }
  .ch { display: inline-grid; transition: transform .2s ease; }
  .ch.o { transform: rotate(180deg); }
  .cap { position: relative; display: flex; justify-content: space-between; align-items: baseline; padding: 12px 14px 2px; font-size: 13px; color: var(--muted); }
  .cap.t::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: .5px; background: var(--line); }
  .sub { background: var(--fill); }
  .ex { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .45s cubic-bezier(.32, .72, 0, 1); }
  .ex.o { grid-template-rows: 1fr; }
  .ex > div { overflow: hidden; min-height: 0; }
  .exr { opacity: 0; transform: translateY(-6px); transition: opacity .3s, transform .4s cubic-bezier(.32, .72, 0, 1); }
  .ex.o .exr { opacity: 1; transform: none; transition-delay: var(--d); }
  .tg { position: relative; display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 44px; font-size: 14px; font-weight: 500; color: var(--gold); -webkit-tap-highlight-color: transparent; }
  .tg.t::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: .5px; background: var(--line); }
  .tc { display: inline-grid; transition: transform .35s cubic-bezier(.32, .72, 0, 1); }
  .tg.o .tc { transform: rotate(180deg); }
  @media (prefers-reduced-motion: reduce) { .ex, .exr, .tc { transition: none; } }
</style>
