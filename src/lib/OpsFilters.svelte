<script>
  // Панель «Добавить фильтры»: секции свёрнуты, раскрываются по одной. Магазины появляются после выбора вида, счёта или категории.
  import { slide } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import { fl, toggle, applyFilters, TYPES, SUMR, SRC, FLAGS, clearFilters, filterCount } from './opsfilter.svelte.js';

  let { ops = [], accs = [], cats = [] } = $props();
  let openSec = $state('');

  const catName = (id) => (id === 'none' ? 'Без категории' : cats.find((c) => c.id === id)?.name ?? '…');
  const accName = (id) => accs.find((a) => a.id === id)?.name ?? '…';

  // категории, которые есть в периоде, по числу операций
  const catOpts = $derived.by(() => {
    const m = new Map();
    for (const t of ops) { if (t.action === 'TRANSFER') continue; const id = t.uncat ? 'none' : t.category_id; if (id == null) continue; m.set(id, (m.get(id) ?? 0) + 1); }
    for (const id of fl.cats) if (!m.has(id)) m.set(id, 0);
    return [...m].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, name: catName(id), n }));
  });
  // магазины: только из того, что осталось после остальных фильтров
  const showMers = $derived(fl.types.length + fl.accs.length + fl.cats.length > 0);
  const merOpts = $derived.by(() => {
    const m = new Map();
    for (const t of applyFilters(ops, 'mers')) { if (t.action === 'TRANSFER' && !fl.types.includes('TRANSFER')) continue; m.set(t.name, (m.get(t.name) ?? 0) + 1); }
    for (const v of fl.mers) if (!m.has(v)) m.set(v, 0);
    return [...m].sort((a, b) => b[1] - a[1]);
  });

  const sumText = (id) => {
    if (id === 'types') return fl.types.map((v) => TYPES.find((x) => x[0] === v)[1]).join(', ');
    if (id === 'accs') return fl.accs.map(accName).join(', ');
    if (id === 'cats') return fl.cats.map(catName).join(', ');
    if (id === 'mers') return fl.mers.join(', ');
    if (id === 'sum') return fl.sum >= 0 ? SUMR[fl.sum][0] + ' ₴' : '';
    if (id === 'src') return fl.src.map((v) => SRC.find((x) => x[0] === v)[1]).join(', ');
    return fl.flags.map((v) => FLAGS.find((x) => x[0] === v)[1]).join(', ');
  };
  const secs = [['types', 'Вид трат', 'swap'], ['accs', 'Счета', 'wallet'], ['cats', 'Категории', 'tag'], ['mers', 'Магазины', 'cart'], ['sum', 'Сумма', 'coin'], ['src', 'Источник', 'bank'], ['flags', 'Особые', 'split']];
  const flip = (id) => (openSec = openSec === id ? '' : id);
</script>

{#snippet sec(id, title, icon)}
  {@const t = sumText(id)}
  <div class="sec">
    <button class="sh" onclick={() => flip(id)}>
      <span class="ic"><Icon name={icon} size={16} /></span>
      <span class="tt">{title}</span>
      <span class="sm" class:g={!!t}>{t || (id === 'sum' ? 'Любая' : 'Все')}</span>
      <span class="cv" class:up={openSec === id}><Icon name="chevron" size={16} /></span>
    </button>
    {#if openSec === id}
      <div class="cps" transition:slide={{ duration: 280 }}>
        {#if id === 'types'}
          {#each TYPES as x}<button class:a={fl.types.includes(x[0])} onclick={() => toggle('types', x[0])}>{x[1]}</button>{/each}
        {:else if id === 'accs'}
          {#each accs as a}<button class:a={fl.accs.includes(a.id)} onclick={() => toggle('accs', a.id)}>{a.name}{a.foreign ? ' · ' + a.cur : ''}</button>{/each}
        {:else if id === 'cats'}
          {#each catOpts as c (c.id)}<button class:a={fl.cats.includes(c.id)} onclick={() => toggle('cats', c.id)}>{c.name}{#if c.n}<small>{c.n}</small>{/if}</button>{/each}
        {:else if id === 'mers'}
          {#each merOpts as [n, c] (n)}<button class:a={fl.mers.includes(n)} onclick={() => toggle('mers', n)}>{n}{#if c}<small>{c}</small>{/if}</button>{/each}
        {:else if id === 'sum'}
          {#each SUMR as r, i}<button class:a={fl.sum === i} onclick={() => (fl.sum = fl.sum === i ? -1 : i)}>{r[0]} ₴</button>{/each}
        {:else if id === 'src'}
          {#each SRC as x}<button class:a={fl.src.includes(x[0])} onclick={() => toggle('src', x[0])}>{x[1]}</button>{/each}
        {:else}
          {#each FLAGS as x}<button class:a={fl.flags.includes(x[0])} onclick={() => toggle('flags', x[0])}>{x[1]}</button>{/each}
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

<div class="fpan">
  {#each secs as s (s[0])}
    {#if s[0] !== 'mers'}{@render sec(s[0], s[1], s[2])}
    {:else if showMers}<div transition:slide={{ duration: 300 }}>{@render sec(s[0], s[1], s[2])}</div>{/if}
  {/each}
  {#if filterCount() > 0}<button class="rs" transition:slide={{ duration: 200 }} onclick={clearFilters}>Сбросить фильтры</button>{/if}
</div>

<style>
  .fpan { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); padding: 2px 14px; margin-bottom: 12px; overflow: hidden; }
  .sec + .sec, .sec + div, div + .sec { border-top: .5px solid var(--line); }
  .sh { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 50px; text-align: left; }
  .ic { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--gold-soft); color: var(--gold); flex: none; }
  .tt { flex: 1; font-size: 15px; font-weight: 500; }
  .sm { max-width: 46%; font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sm.g { color: var(--gold); font-weight: 600; }
  .cv { color: var(--ter); display: grid; transition: transform .3s; }
  .cv.up { transform: rotate(180deg); }
  .cps { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 0 14px; }
  .cps button { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 17px; background: var(--fill); font-size: 14px; font-weight: 600; transition: background .2s, transform .15s; }
  .cps button:active { transform: scale(.95); }
  .cps small { font-size: 12px; font-weight: 500; color: var(--muted); }
  .cps .a { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
  .cps .a small { color: #5a4510; }
  .rs { display: block; width: 100%; padding: 12px 0 14px; text-align: center; font-size: 14px; font-weight: 600; color: var(--gold); border-top: .5px solid var(--line); }
</style>
