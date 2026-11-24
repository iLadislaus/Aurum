<script>
  // Окно «Свой период»: сверху быстрые (Сегодня, Вчера, 7, 14, 30 дней), ниже календарь с выбором начала и конца
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import { per, cal, quick, QUICK, isoDay, rangeLabel } from './opsfilter.svelte.js';

  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const today = isoDay(new Date());
  const t0 = new Date();

  let vy = $state(t0.getFullYear()), vm = $state(t0.getMonth());
  let a = $state(''), b = $state('');

  $effect(() => {
    if (!cal.open) return;
    if (per.mode === 'custom' && per.from) { a = per.from; b = per.to; const [y, m] = per.from.split('-').map(Number); vy = y; vm = m - 1; }
    else { a = ''; b = ''; vy = t0.getFullYear(); vm = t0.getMonth(); }
  });

  const cells = $derived.by(() => {
    const lead = (new Date(vy, vm, 1).getDay() + 6) % 7;
    const days = new Date(vy, vm + 1, 0).getDate();
    const out = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(`${vy}-${String(vm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return out;
  });
  const canNext = $derived(vy * 12 + vm < t0.getFullYear() * 12 + t0.getMonth());
  const prev = () => { if (vm === 0) { vm = 11; vy--; } else vm--; };
  const next = () => { if (!canNext) return; if (vm === 11) { vm = 0; vy++; } else vm++; };

  function tap(d) {
    if (d > today) return;
    if (!a || (a && b)) { a = d; b = ''; }
    else if (d < a) { b = a; a = d; }
    else b = d;
  }
  const cls = (d) => {
    if (!a) return '';
    const e = b || a;
    if (d === a || d === e) return 'e' + (d === a ? ' l' : '') + (d === e ? ' r' : '');
    return d > a && d < e ? 'in' : '';
  };
  function setQuick(name) {
    const [f, t] = quick(name);
    a = f; b = t;
    per.mode = 'custom'; per.from = f; per.to = t; per.name = name;
    setTimeout(() => { cal.open = false; }, 220);
  }
  function apply() {
    if (!a) return;
    per.mode = 'custom'; per.from = a; per.to = b || a; per.name = '';
    cal.open = false;
  }
</script>

<Sheet open={cal.open} onclose={() => (cal.open = false)} fit title="Свой период" z={56}>
  <div class="q">
    {#each QUICK as n}<button class:on={per.mode === 'custom' && per.name === n} onclick={() => setQuick(n)}>{n}</button>{/each}
  </div>
  <div class="nav">
    <button class="ar" aria-label="Назад" onclick={prev}><span style="display:inline-block;transform:rotate(90deg)"><Icon name="chevron" size={18} /></span></button>
    <b>{MONTHS[vm]} {vy}</b>
    <button class="ar" class:off={!canNext} aria-label="Вперёд" onclick={next}><span style="display:inline-block;transform:rotate(-90deg)"><Icon name="chevron" size={18} /></span></button>
  </div>
  <div class="g wd">{#each WD as w}<span>{w}</span>{/each}</div>
  <div class="g">
    {#each cells as d}
      {#if d}
        <button class="d {cls(d)}" class:off={d > today} class:now={d === today} onclick={() => tap(d)}>{Number(d.slice(8))}</button>
      {:else}<span></span>{/if}
    {/each}
  </div>
  <p class="rg">{a ? rangeLabel(a, b || a) : 'Выберите начало и конец периода'}</p>
  <button class="ok" class:dis={!a} onclick={apply}>Применить</button>
</Sheet>

<style>
  .q { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px 8px 10px; }
  .q::-webkit-scrollbar { display: none; }
  .q button { white-space: nowrap; padding: 7px 14px; border-radius: 99px; background: var(--fill); font-size: 14px; font-weight: 600; min-height: 36px; flex: none; transition: background .25s, color .25s, transform .15s; }
  .q button:active { transform: scale(.95); }
  .q .on { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
  .nav { display: flex; align-items: center; justify-content: space-between; padding: 4px 12px 8px; }
  .nav b { font-size: 17px; font-weight: 700; }
  .ar { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; background: var(--fill); color: var(--gold); }
  .ar.off { opacity: .35; pointer-events: none; }
  .g { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 4px; padding: 0 8px; }
  .wd span { text-align: center; font-size: 12px; font-weight: 600; color: var(--muted); padding: 4px 0; }
  .d { height: 42px; font-size: 16px; font-weight: 500; font-variant-numeric: tabular-nums; position: relative; }
  .d.now { color: var(--gold); font-weight: 700; }
  .d.off { color: var(--ter); pointer-events: none; }
  .d.in { background: var(--gold-soft); }
  .d.e { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; font-weight: 700; border-radius: 21px; }
  .d.e.l:not(.r) { border-radius: 21px 0 0 21px; }
  .d.e.r:not(.l) { border-radius: 0 21px 21px 0; }
  .rg { text-align: center; margin: 12px 0 0; font-size: 14px; color: var(--muted); min-height: 18px; }
  .ok { display: block; width: calc(100% - 16px); margin: 12px 8px 0; height: 50px; border-radius: 25px; font-size: 16px; font-weight: 600; color: #1a1206; background: linear-gradient(180deg, #F0D18A, #C9963A); transition: opacity .2s, transform .15s; }
  .ok:active { transform: scale(.98); }
  .ok.dis { opacity: .45; }
</style>
