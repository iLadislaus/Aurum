<script>
  import { untrack } from 'svelte';
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import ReportBars from './ReportBars.svelte';
  import { an, closeAnalytics } from './analytics.svelte.js';
  import { loadReportData } from './analytics.js';
  import { buildReport, periodOf, dayKey, ymOf, ruDate, FULL } from './report.js';
  import { reportFile, reportName } from './reportXlsx.js';
  import { put, peek } from './cache.svelte.js';
  import { oc, openOp } from './opcard.svelte.js';
  import { fmt, cash } from './format.js';

  const KINDS = [['m', 'Месяц'], ['q', 'Квартал'], ['y', 'Год'], ['r', 'Период']];
  const TABS = ['Сводка', 'Расходы', 'Доходы', 'Динамика', 'План и факт', 'Счета'];
  const COL = ['#E3B85C', '#F7DC9A', '#A87C2D', '#FF8A65', '#4FCF8A', '#8E8E93'];
  const OPS_KEY = 'rep.ops';
  const today = dayKey(new Date());
  const nowYm = ymOf(today);

  let raw = $state.raw(null), err = $state('');
  let kind = $state('m'), tab = $state(0), pick = $state({ m: nowYm, q: 0, y: 0 });
  let from = $state(today.slice(0, 8) + '01'), to = $state(today);
  let openCat = $state(null), help = $state(false), savOpen = $state(false), xl = $state('');
  const CUR = { USD: 'доллары', EUR: 'евро' };

  async function load() {
    err = '';
    try { raw = await loadReportData(); }
    catch (e) { if (!raw) err = e.message || 'Не удалось загрузить'; }
  }
  // при каждом открытии: выбранный на «Бюджете» месяц и свежие данные
  $effect(() => {
    if (!an.open) return;
    untrack(() => {
      const v = Math.min(an.ym, nowYm);
      kind = 'm'; tab = 0; openCat = null; savOpen = false; xl = '';
      pick = { m: v, q: Math.floor(v / 12) * 4 + Math.floor((v % 12) / 3), y: Math.floor(v / 12) };
      load();
    });
  });
  // закрыли карточку операции — в ней могли поменять категорию, считаем заново
  let wasCard = false;
  $effect(() => {
    const o = oc.open;
    untrack(() => { if (wasCard && !o && an.open) setTimeout(load, 600); wasCard = o && oc.key === OPS_KEY; });
  });

  const firstYm = $derived(raw ? raw.ops.reduce((m, o) => Math.min(m, ymOf(dayKey(o.date))), nowYm) : nowYm);
  const choices = $derived.by(() => {
    const list = [];
    if (kind === 'm') for (let v = nowYm; v >= firstYm; v--) list.push([v, `${FULL[v % 12]} ${Math.floor(v / 12)}`]);
    const q = (ym) => Math.floor(ym / 12) * 4 + Math.floor((ym % 12) / 3);
    if (kind === 'q') for (let v = q(nowYm); v >= q(firstYm); v--) list.push([v, `${(v % 4) + 1} квартал ${Math.floor(v / 4)}`]);
    if (kind === 'y') for (let v = Math.floor(nowYm / 12); v >= Math.floor(firstYm / 12); v--) list.push([v, `${v} год`]);
    return list;
  });
  const period = $derived(periodOf(kind, pick[kind], from || today, to || today));
  const r = $derived(raw ? buildReport(raw, period) : null);

  const money = (v) => fmt(v, 0) + ' ₴';
  const signed = (v) => (v >= 0 ? '+' : '−') + money(Math.abs(v));
  const share = (v, max) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);

  const ring = $derived.by(() => {
    if (!r?.cats.length || r.exp <= 0) return [];
    const l = r.cats.slice(0, 5).map((c) => ({ name: c.name, value: c.value }));
    const rest = r.cats.slice(5).reduce((s, c) => s + c.value, 0);
    if (rest > 0) l.push({ name: 'Остальное', value: rest });
    const sum = l.reduce((s, x) => s + x.value, 0);
    let o = 0;
    return l.map((x, i) => { const p = (x.value / sum) * 100; const a = { ...x, p, o, c: COL[i] }; o += p; return a; });
  });

  function showOp(o) {
    const list = [...r.cats.flatMap((c) => c.ops), ...r.big];
    const unique = [...new Map(list.map((x) => [x.id, x])).values()];
    put(OPS_KEY, { ops: unique });
    openOp(peek(OPS_KEY).ops.find((x) => x.id === o.id), OPS_KEY);
  }
  const opDate = (o) => ruDate(dayKey(o.date)).slice(0, 5);

  async function download() {
    if (!r || xl === 'busy') return;
    xl = 'busy';
    try {
      await new Promise((ok) => setTimeout(ok, 450));
      const name = reportName(r);
      const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const file = new File([reportFile(r)], name, { type });
      // на телефоне файл отдаётся через «Поделиться», на компьютере скачивается
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); }
        catch (e) { if (e.name === 'AbortError') { xl = ''; return; } save(file, name); }
      } else save(file, name);
      xl = 'done';
    } catch { xl = 'fail'; }
    setTimeout(() => (xl = ''), 2400);
  }
  function save(file, name) {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
</script>

{#snippet meter(name, value, w, i, tone)}
  <div class="mt" style="--i:{i}"><div class="ln"><span>{name}</span><b>{value}</b></div><div class="b"><i class={tone} style="--w:{w}%"></i></div></div>
{/snippet}
{#snippet line(name, value, tone)}
  <div class="ln pad"><span>{name}</span><b class={tone}>{value}</b></div>
{/snippet}
{#snippet opRow(o)}
  <button class="op" onclick={() => showOp(o)}>
    <span class="d">{opDate(o)}</span><span class="n">{o.note || o.cat}{#if o.returned}<small>возвращено {cash(o.returned, 0)}</small>{/if}</span><b>{cash(-o.part, 0)}</b>
  </button>
{/snippet}

<Sheet open={an.open} onclose={closeAnalytics} title="Аналитика" sub={period.label} z={50}>
  <div class="wrap">
    <div class="seg" style:--p={KINDS.findIndex((k) => k[0] === kind)}><i></i>
      {#each KINDS as [k, t]}<button class:on={kind === k} onclick={() => { kind = k; openCat = null; }}>{t}</button>{/each}
    </div>
    <div class="when">
      {#if kind === 'r'}
        <input type="date" bind:value={from} max={today} aria-label="С даты" /><span>—</span><input type="date" bind:value={to} max={today} aria-label="По дату" />
      {:else}
        <label><span>{period.label}</span><Icon name="chevron" size={13} />
          <select value={pick[kind]} onchange={(e) => { pick[kind] = Number(e.currentTarget.value); openCat = null; }} aria-label="Выбрать период">
            {#each choices as [v, t]}<option value={v}>{t}</option>{/each}
          </select>
        </label>
      {/if}
    </div>
    <div class="tabs">{#each TABS as t, i}<button class:on={tab === i} onclick={() => (tab = i)}>{t}</button>{/each}</div>

    {#if !r}
      <p class="msg">{err || 'Считаю…'}</p>
      {#if err}<button class="again" onclick={load}>Повторить</button>{/if}
    {:else}
      {#key tab + period.label}
        <div class="body">
          {#if tab === 0}
            <div class="card hero">
              <small>Остаток за период</small>
              <div class="big" class:neg={r.saldo < 0}>{signed(r.saldo)}</div>
              {@render line('Доходы', money(r.inc), 'pos')}
              {@render line('Расходы', money(r.exp), 'neg')}
              {#if r.rate != null}{@render line('Откладываешь', r.rate + '%')}{/if}
              {#if r.paid}{@render line('Погашено долгов', money(r.paid))}{/if}
              {#if r.taken}{@render line('Взято в долг', money(r.taken))}{/if}
              {#if r.expChange != null}<small>Расходы {r.expChange === 0 ? 'как' : `на ${Math.abs(r.expChange)}% ${r.expChange > 0 ? 'выше' : 'ниже'}, чем`} {r.prevLabel}</small>{:else}<small>Сравнить не с чем: учёт ведётся с {ruDate(r.first)}</small>{/if}
            </div>
            {#if r.savings}
              {@const s = r.savings}
              <div class="card sav">
                <button class="sv" onclick={() => (savOpen = !savOpen)} aria-expanded={savOpen}>
                  <span class="ln mid"><span class="lbl"><Icon name="lock" size={16} />Сбережения в валюте</span><span class="ar" class:up={savOpen}><Icon name="chevron" size={14} /></span></span>
                  <span class="ln mid sum">
                    {#if s.uah != null}<strong>≈ {money(s.uah)}</strong>{/if}
                    <span class="chips">{#each s.byCurrency as c}<em>{cash(c.balance, 0, c.currency)}</em>{/each}</span>
                  </span>
                </button>
                <div class="more" class:o={savOpen} inert={!savOpen}><div>
                  {#each s.list as a}
                    <div class="ln acc"><span>{a.name}<small>{CUR[a.currency] ?? a.currency}</small></span><b>{cash(a.balance, 0, a.currency)}<small>{a.uah != null ? '≈ ' + money(a.uah) : 'нет курса'}</small></b></div>
                  {/each}
                  <p>По курсу Monobank на сегодня. В доходы и расходы не входит</p>
                </div></div>
              </div>
              {#if s.all != null}
                <div class="card all">
                  <div class="info">
                    <small>Всего с валютой</small>
                    <strong>≈ {money(s.all)}</strong>
                    <span><i></i>Валюта <b>{money(s.uah)}</b></span>
                    <span><i class="uah"></i>Гривна <b>{money(r.accounts.homeTotal)}</b></span>
                  </div>
                  {#if s.share != null}
                    <svg viewBox="0 0 36 36" role="img" aria-label="Валюта {s.share}%">
                      <circle class="base" cx="18" cy="18" r="15" />
                      {#if s.share}<circle class="arc" cx="18" cy="18" r="15" pathLength="100" style="--d:{s.share}" transform="rotate(-90 18 18)" />{/if}
                      <text x="18" y="20.7">{s.share}%</text>
                    </svg>
                  {/if}
                </div>
              {/if}
            {/if}
            {#if r.health.score != null}
              <div class="card">
                <button class="h tap" onclick={() => (help = !help)}><span>Финансовое здоровье</span><b class="gold">{r.health.score} из 100</b></button>
                {#each r.health.parts as p, i}
                  {@render meter(p.name, p.text, share(p.got, p.max), i, p.got / p.max >= 0.6 ? 'good' : p.got / p.max >= 0.3 ? '' : 'bad')}
                  {#if help}<small class="rule">{p.got} из {p.max}: {p.rule}</small>{/if}
                {/each}
                <small>{help ? 'Запас и долги считаются по сегодняшним остаткам' : 'Нажми на заголовок, чтобы увидеть, как считается'}</small>
              </div>
            {/if}
            {#if r.forecast}
              <div class="card">
                <div class="h">Прогноз до конца периода</div>
                {@render line('Расходы составят', '≈ ' + money(r.forecast.total))}
                {@render line('Останется', '≈ ' + signed(r.forecast.rest), r.forecast.rest >= 0 ? 'pos' : 'neg')}
                {#if r.forecast.perDay != null}{@render line('Можно тратить в день', money(r.forecast.perDay), 'gold')}{/if}
                <small>По обычным тратам {money(r.forecast.usual)} в день и уже полученным доходам</small>
              </div>
            {/if}
            {#if r.notes.length}
              <div class="card">
                <div class="h">Выводы</div>
                {#each r.notes as n}<div class="note"><i class={n.tone}></i><span>{n.text}</span></div>{/each}
              </div>
            {/if}
            {#if r.upcoming.length}
              <div class="card">
                <div class="h">Платежи на 30 дней</div>
                {#each r.upcoming as p}{@render line(`${ruDate(p.date).slice(0, 5)} · ${p.name}`, money(p.amount))}{/each}
              </div>
            {/if}
          {:else if tab === 1}
            {#if !r.cats.length}<p class="msg">Расходов за период нет</p>{:else}
              <div class="card">
                <div class="h">Куда уходят деньги</div>
                <svg class="donut" viewBox="0 0 42 42">
                  {#each ring as a, i}<circle cx="21" cy="21" r="15.9155" pathLength="100" stroke={a.c} style="--d:{Math.max(0.1, a.p - 0.6)};--i:{i};stroke-dashoffset:{25 - a.o}" />{/each}
                  <text x="21" y="21" class="t1">{money(r.exp)}</text><text x="21" y="26" class="t2">расходы</text>
                </svg>
                <div class="lg">{#each ring as a}<span><i style="background:{a.c}"></i>{a.name}<b>{Math.round(a.p)}%</b></span>{/each}</div>
              </div>
              <div class="card">
                <div class="h">Все категории</div>
                {#if r.prevLabel}<small class="rule">Стрелки показывают изменение: сравнение {r.prevLabel.replace(/^за /, 'с тратами за ')}</small>{/if}
                {#each r.cats as c (c.id)}
                  <button class="cat" onclick={() => (openCat = openCat === c.id ? null : c.id)} aria-expanded={openCat === c.id}>
                    <OpAvatar icon={c.icon} size={30} />
                    <span class="m"><span class="ln"><span>{c.name}</span><b>{money(c.value)}</b></span>
                      <span class="b"><i style="--w:{share(c.value, r.cats[0].value)}%"></i></span>
                      <small>{c.share}% · {c.ops.length} оп.{#if c.change != null} · <em class={c.change > 0 ? 'neg' : 'pos'}>{c.change > 0 ? '▲' : '▼'} {Math.abs(c.change)}%</em>{/if}</small>
                    </span>
                  </button>
                  {#if openCat === c.id}<div class="ops">{#each c.ops as o (o.id)}{@render opRow(o)}{/each}</div>{/if}
                {/each}
              </div>
              {#if r.merchants.length}
                <div class="card">
                  <div class="h">Топ магазинов</div>
                  {#each r.merchants as m, i}{@render meter(`${m.name} · ${m.count}`, money(m.value), share(m.value, r.merchants[0].value), i, '')}{/each}
                </div>
              {/if}
              <div class="card">
                <div class="h">Характер трат</div>
                {@render meter('Обязательные', money(r.mand), share(r.mand, r.mand + r.opt), 0, '')}
                {@render meter('Необязательные', money(r.opt), share(r.opt, r.mand + r.opt), 1, 'warm')}
              </div>
              <div class="card">
                <div class="h">Самые крупные траты</div>
                {#each r.big as o (o.id)}{@render opRow(o)}{/each}
              </div>
            {/if}
          {:else if tab === 2}
            <div class="card">
              <div class="h">Источники</div>
              {#each r.sources as s, i}{@render meter(s.name, money(s.value), share(s.value, r.inc), i, 'good')}{:else}<p class="msg">Доходов за период нет</p>{/each}
            </div>
            {#if r.incCats.length}
              <div class="card">
                <div class="h">По категориям</div>
                {#each r.incCats as c}{@render line(`${c.name} · ${c.share}%`, money(c.value))}{/each}
              </div>
            {/if}
            <div class="card">
              <div class="h">Доход по месяцам</div>
              <ReportBars items={r.months.map((m) => ({ label: m.label, a: m.inc }))} colors={['#4FCF8A']} />
            </div>
          {:else if tab === 3}
            <div class="card">
              <div class="h">Доходы и расходы</div>
              <ReportBars items={r.months.map((m) => ({ label: m.label, a: m.inc, b: m.exp }))} colors={['#4FCF8A', '#D9A93F']} names={['Доходы', 'Расходы']} />
            </div>
            {#if r.days.length}
              <div class="card">
                <div class="h">Расходы по дням</div>
                <ReportBars items={r.days.map((d) => ({ label: ruDate(d.day).slice(0, 5), a: d.value }))} colors={['#D9A93F']} dense />
                {@render line('Средний расход в день', money(r.avgDay))}
                {#if r.topDay}{@render line(`Самый дорогой, ${ruDate(r.topDay.day)}`, money(r.topDay.value))}{/if}
              </div>
              <div class="card">
                <div class="h">По дням недели, в среднем</div>
                <ReportBars items={r.weekdays.map((w) => ({ label: w.name, a: w.value }))} colors={['#A87C2D']} />
              </div>
            {/if}
          {:else if tab === 4}
            {#if !r.plan.any}<p class="msg">На этот период план не заполнен</p>{:else}
              {@const rest = r.plan.total - r.plan.fact}
              <div class="card hero">
                <small>{rest < 0 ? 'Перерасход' : 'Осталось'}</small>
                <div class="left"><span class="big" class:neg={rest < 0}>{money(Math.abs(rest))}</span><em>из {money(r.plan.total)}</em></div>
                <div class="b"><i class={rest < 0 ? 'bad' : ''} style="--w:{share(r.plan.fact, r.plan.total)}%"></i></div>
                {#if period.kind === 'r'}<small>План берётся за целые месяцы, которые задевает период</small>{/if}
              </div>
              <div class="card">
                <div class="h">По категориям</div>
                {#each r.plan.rows as p, i (p.id)}
                  {@render meter(p.name, p.plan ? `${fmt(p.fact, 0)} / ${money(p.plan)}` : `${money(p.fact)} · вне плана`, p.plan ? share(p.fact, p.plan) : 100, i, !p.plan || p.left < 0 ? 'bad' : '')}
                {/each}
              </div>
            {/if}
          {:else}
            <div class="card hero">
              <small>Гривневые счета сегодня</small>
              <div class="big">{money(r.accounts.homeTotal)}</div>
              {@render line('Карты и наличные', money(r.accounts.cardsCash))}
              {@render line('Конверты', money(r.accounts.envs))}
              {#if r.accounts.debts.length}{@render line('Долги', (r.accounts.debtKnown ? '≈ ' + money(r.accounts.debtUah) : 'нет курса'), 'neg')}{/if}
            </div>
            <div class="card">
              <div class="h">Деньги на конец месяца</div>
              <ReportBars items={r.capital.map((c) => ({ label: c.label, a: c.value }))} colors={['#D9A93F']} />
              <small>Только гривневые счета; прошлые месяцы восстановлены по операциям</small>
            </div>
            <div class="card">
              <div class="h">Где лежат деньги</div>
              {#each r.accounts.list as a, i}{@render meter(a.name, money(a.balance), share(a.balance, r.accounts.list[0].balance), i, a.balance < 0 ? 'bad' : '')}{/each}
            </div>
            {#if r.accounts.foreign.length || r.accounts.debts.length}
              <div class="card">
                <div class="h">Валюта и долги</div>
                {#each r.accounts.foreign as a}{@render line(a.name, cash(a.balance, 0, a.currency))}{/each}
                {#each r.accounts.debts as d}{@render line(d.name, cash(-d.amount, 0, d.currency), 'neg')}{/each}
              </div>
            {/if}
          {/if}
        </div>
      {/key}
    {/if}
  </div>
  {#snippet footer()}
    <div class="ft">
      <button class="xl" class:busy={xl === 'busy'} disabled={!r} onclick={download}>
        <i></i><span>{#if xl === 'busy'}Собираю отчёт…{:else if xl === 'done'}<Icon name="check" size={17} /> Отчёт готов{:else if xl === 'fail'}Не получилось, нажми ещё раз{:else}<Icon name="down" size={17} /> Скачать отчёт в Excel{/if}</span>
      </button>
    </div>
  {/snippet}
</Sheet>

<style>
  .wrap { padding: 0 6px; min-height: 60vh; }
  .seg { display: grid; grid-template-columns: repeat(4, 1fr); background: var(--fill); border-radius: 11px; padding: 2px; position: relative; }
  .seg i { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / 4); background: var(--seg-on); border-radius: 9px; box-shadow: 0 1px 4px rgba(0,0,0,.15); transform: translateX(calc(var(--p) * 100%)); transition: transform .3s cubic-bezier(.2,.8,.2,1); }
  .seg button { position: relative; z-index: 1; height: 32px; font-size: 13px; font-weight: 600; color: var(--muted); }
  .seg button.on { color: var(--text); }
  .when { display: flex; justify-content: center; align-items: center; gap: 8px; margin: 10px 0; min-height: 44px; color: var(--muted); }
  .when label { position: relative; display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 16px; border-radius: 99px; background: var(--gold-soft); color: var(--gold); font-weight: 600; }
  .when select { position: absolute; inset: 0; width: 100%; opacity: 0; font-size: 16px; }
  .when input { flex: 1; min-width: 0; height: 44px; font: inherit; font-size: 16px; color: var(--text); background: var(--card); border: .5px solid var(--line); border-radius: 12px; padding: 0 10px; }
  .tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .tabs button { min-height: 32px; padding: 0 12px; border-radius: 99px; font-size: 13px; color: var(--muted); box-shadow: inset 0 0 0 .5px var(--line); transition: color .25s, box-shadow .25s; }
  .tabs button.on { color: var(--gold); box-shadow: inset 0 0 0 1px var(--gline); font-weight: 600; }
  .card { background: var(--card); border-radius: 18px; box-shadow: var(--shadow); padding: 14px; margin-bottom: 10px; display: flex; flex-direction: column; animation: rise .45s cubic-bezier(.2,.8,.2,1) both; }
  .card:nth-child(2) { animation-delay: 70ms; } .card:nth-child(3) { animation-delay: 140ms; } .card:nth-child(n+4) { animation-delay: 210ms; }
  .card > small { color: var(--muted); font-size: 12px; margin-top: 6px; }
  .hero > small:first-child { margin-top: 0; }
  .big { font-size: 32px; font-weight: 700; letter-spacing: -.02em; color: var(--gold); font-variant-numeric: tabular-nums; margin-bottom: 4px; }
  .left { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px; } .left em { color: var(--muted); font-size: 14px; }
  .h { font-weight: 700; margin-bottom: 8px; display: flex; justify-content: space-between; gap: 8px; width: 100%; }
  .tap { text-align: left; }
  .ln { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .ln b { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .pad { padding: 5px 0; }
  .pos { color: var(--pos); } .neg { color: var(--neg); } .gold { color: var(--gold); }
  em { font-style: normal; }
  .mt { padding: 5px 0; }
  .b { display: block; height: 6px; border-radius: 99px; background: var(--fill); margin-top: 5px; overflow: hidden; }
  .b i { display: block; height: 100%; width: var(--w); border-radius: 99px; background: linear-gradient(90deg, #9C7420, #EBC77A); transform-origin: left; animation: grow .9s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(min(var(--i, 0), 12) * 50ms + .15s); }
  .b i.good { background: #3FBF75; } .b i.bad { background: #FF6B5E; } .b i.warm { background: #FF8A65; }
  @keyframes grow { from { transform: scaleX(0); } }
  .rule { color: var(--muted); font-size: 12px; margin-bottom: 4px; }
  .note { display: flex; gap: 10px; padding: 6px 0; }
  .note i { flex: none; width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; background: var(--ter); }
  .note i.good { background: var(--pos); } .note i.bad { background: var(--neg); } .note i.warn { background: #E3A63C; }
  .donut { width: 180px; align-self: center; }
  .donut circle { fill: none; stroke-width: 5.5; stroke-dasharray: var(--d) 100; animation: ds 1.1s cubic-bezier(.3,.7,.2,1) both; animation-delay: calc(var(--i) * 90ms); }
  @keyframes ds { from { stroke-dasharray: 0 100; } }
  .donut text { text-anchor: middle; fill: var(--text); } .t1 { font-size: 4.4px; font-weight: 700; } .donut .t2 { font-size: 3px; fill: var(--muted); }
  .lg { display: flex; flex-direction: column; gap: 7px; margin-top: 12px; font-size: 14px; }
  .lg span { display: flex; align-items: center; gap: 8px; } .lg i { width: 9px; height: 9px; border-radius: 3px; flex: none; } .lg b { margin-left: auto; }
  .cat { display: flex; align-items: flex-start; gap: 11px; padding: 9px 0; width: 100%; text-align: left; }
  .cat .m { flex: 1; min-width: 0; display: block; } .cat small { display: block; color: var(--muted); font-size: 12px; margin-top: 4px; }
  .ops { padding-left: 41px; animation: rise .3s both; }
  .op { display: flex; align-items: baseline; gap: 10px; width: 100%; min-height: 44px; padding: 8px 0; text-align: left; border-top: .5px solid var(--line); }
  .op .d { color: var(--muted); font-size: 12px; flex: none; } .op .n { flex: 1; min-width: 0; overflow-wrap: anywhere; } .op small { display: block; color: var(--muted); font-size: 12px; } .op b { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .msg { text-align: center; color: var(--muted); padding: 28px 0; font-size: 14px; }
  .again { display: block; margin: 0 auto; color: var(--gold); font-weight: 600; min-height: 44px; }
  .ft { flex: none; padding: 10px 14px calc(12px + var(--safe-b)); border-top: .5px solid var(--line); }
  .xl { position: relative; overflow: hidden; width: 100%; height: 50px; border-radius: 99px; background: linear-gradient(160deg, #F0CF85, #C99A3C); color: #1A1305; font-weight: 700; transition: transform .15s; }
  .xl:active { transform: scale(.98); }
  .xl:disabled { opacity: .5; }
  .xl span { position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .xl i { position: absolute; inset: 0; background: rgba(255,255,255,.45); transform: scaleX(0); transform-origin: left; }
  .xl.busy i { animation: fillx .5s ease-in-out forwards; }
  .sav { position: relative; overflow: hidden; box-shadow: inset 0 0 0 1px var(--gold-soft), var(--shadow); }
  .sav::after { content: ""; position: absolute; top: 0; bottom: 0; left: -90px; width: 70px; pointer-events: none; background: var(--gold-soft); opacity: .35; transform: skewX(-20deg); animation: sheen 4.5s ease-in-out infinite; }
  @keyframes sheen { 0%, 40% { left: -90px; } 100% { left: 130%; } }
  .sv { display: block; width: 100%; text-align: left; }
  .sv > span { display: flex; } .mid { align-items: center; }
  .lbl { display: flex; align-items: center; gap: 8px; color: var(--gold); }
  .ar { display: grid; color: var(--gold); transition: transform .35s; } .ar.up { transform: rotate(180deg); }
  .sum { margin-top: 8px; flex-wrap: wrap; } .sum strong { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; } .chips em { font-size: 12px; font-weight: 600; color: var(--gold); background: var(--gold-soft); border-radius: 99px; padding: 3px 10px; white-space: nowrap; }
  .more { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .45s cubic-bezier(.32,.72,0,1); } .more.o { grid-template-rows: 1fr; } .more > div { overflow: hidden; min-height: 0; }
  .acc { align-items: center; padding: 9px 0; border-top: .5px solid var(--line); } .acc:first-child { margin-top: 10px; } .acc b { text-align: right; } .acc small { display: block; color: var(--muted); font-size: 12px; font-weight: 400; }
  .more p { margin: 0; padding-top: 9px; border-top: .5px solid var(--line); color: var(--muted); font-size: 12px; }
  .all { flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; }
  .info { display: flex; flex-direction: column; min-width: 0; font-variant-numeric: tabular-nums; }
  .info small { color: var(--muted); font-size: 12px; } .info strong { font-size: 28px; font-weight: 700; letter-spacing: -.02em; margin-bottom: 8px; white-space: nowrap; }
  .info span { display: flex; align-items: center; gap: 7px; padding: 1px 0; } .info b { font-weight: 600; }
  .info i { width: 8px; height: 8px; border-radius: 3px; background: #E0B552; flex: none; } .info i.uah { background: #7A560C; }
  .all svg { width: 86px; flex: none; }
  .all circle { fill: none; stroke-width: 4; } .all .base { stroke: #7A560C; }
  .all .arc { stroke: #E8C36A; stroke-width: 4.4; stroke-dasharray: var(--d) 100; animation: ds 1.3s cubic-bezier(.3,.7,.2,1) .2s both; }
  .all text { text-anchor: middle; font-size: 7.5px; font-weight: 700; fill: var(--text); }
  @keyframes fillx { to { transform: scaleX(1); } }
  @media (prefers-reduced-motion: reduce) { .card, .b i, .donut circle, .ops, .sav::after, .all .arc { animation: none; } .more { transition: none; } }
</style>
