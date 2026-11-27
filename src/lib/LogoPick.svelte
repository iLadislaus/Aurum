<script>
  // Выбор логотипа из имеющихся: действует на все платежи с этим названием
  import { untrack } from 'svelte';
  import { lp, closeLogo } from './logopick.svelte.js';
  import { logoFile, logoList, logoSrc, setLogo, loadBrands, uploadLogo } from './brands.svelte.js';
  import LogoCrop from './LogoCrop.svelte';
  import FloatWin from './FloatWin.svelte';
  import Icon from './Icon.svelte';

  let q = $state(''), sel = $state(null), was = $state(null), busy = $state(false), err = $state('');
  // своя картинка: pick — выбранное фото (подгонка), up — идёт загрузка
  let pick = $state(null), up = $state(null), sec = $state(0), run = 0, timer;
  const STEPS = { send: [55, 'Загружаю на GitHub…'], check: [85, 'Проверяю, что выложен…'], done: [100, 'Логотип выложен'] };
  const clock = $derived(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
  const uploading = $derived(!!up && !up.err && up.step !== 'done');

  function forget() { if (pick) URL.revokeObjectURL(pick); pick = null; }
  function choosePhoto(e) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    forget(); pick = URL.createObjectURL(f); err = '';
  }
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const shows = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = src; });

  async function send(preview) {
    const my = ++run;
    forget(); up = { step: 'send', preview, err: '' }; sec = 0;
    const from = Date.now();
    clearInterval(timer); timer = setInterval(() => (sec = Math.floor((Date.now() - from) / 1000)), 250);
    try {
      const url = await uploadLogo(lp.name, preview.split(',')[1]);
      if (my !== run) return;
      up = { ...up, step: 'check' };
      let ok = false;
      for (let n = 0; n < 20 && !ok && my === run; n++) { ok = await shows(url + (n ? '?t=' + n : '')); if (!ok) await pause(2000); }
      if (my !== run) return;
      up = { ...up, step: 'done' };
      clearInterval(timer);
      await pause(1200);
      if (my !== run) return;
      up = null; q = '';
    } catch (e) {
      if (my !== run) return;
      clearInterval(timer);
      up = { ...up, err: e.message };
    }
  }
  // пока идёт загрузка, окно не закрывается
  const close = () => { if (!uploading) closeLogo(); };
  const all = $derived(logoList());
  const list = $derived.by(() => { const s = q.trim().toLowerCase(); return s ? all.filter((x) => x.words.includes(s)) : all; });

  $effect(() => {
    if (!lp.open) return;
    untrack(() => { run++; clearInterval(timer); forget(); up = null; q = ''; err = ''; busy = false; loadBrands().catch(() => {}); was = sel = logoFile(lp.name); });
  });

  async function save(file) {
    if (busy) return;
    busy = true; err = '';
    try { await setLogo(lp.name, file); closeLogo(); }
    catch { err = 'Не удалось сохранить'; }
    busy = false;
  }
</script>

<FloatWin open={lp.open} onclose={close} title={up ? 'Загрузка' : pick ? 'Подгоните фото' : 'Логотип'} top={110} z={58}>
  <div class="bd">
    {#if up}
      <div class="up" role="status">
        <span class="ring" class:ok={up.step === 'done'} class:bad={up.err}>
          <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.9155" /><circle class="fg" cx="18" cy="18" r="15.9155" style:stroke-dashoffset={100 - STEPS[up.step][0]} /></svg>
          <img src={up.preview} alt="" />
          {#if up.step === 'done'}<i><Icon name="check" size={20} /></i>{/if}
        </span>
        <b>{up.err || STEPS[up.step][1]}</b>
        <em>{clock}</em>
        {#if up.err}
          <button class="go" onclick={() => send(up.preview)}>Повторить</button>
          <button class="rm plain" onclick={() => (up = null)}>К списку</button>
        {:else}<small>{up.step === 'done' ? 'Добавлен в список' : 'Не закрывайте окно'}</small>{/if}
      </div>
    {:else if pick}
      <LogoCrop src={pick} ondone={send} onback={forget} />
    {:else}
    <div class="pv">
      {#key sel}<span class="big">{#if sel}<img src={logoSrc(sel)} alt="" />{:else}<Icon name={lp.icon} size={30} />{/if}</span>{/key}
      <small>Для всех платежей «{lp.name}»</small>
    </div>
    <label class="srch"><Icon name="search" size={16} /><input type="search" placeholder="Название магазина" autocomplete="off" bind:value={q} /></label>
    {#if lp.open}
      <div class="gridl">
        {#each list as x (x.file)}
          <button class:on={sel === x.file} aria-label={x.file.replace(/^.*\//, '').replace(/\.\w+$/, '')} aria-pressed={sel === x.file} onclick={() => (sel = x.file)}><img src={logoSrc(x.file)} alt="" loading="lazy" /></button>
        {:else}<p>Ничего не найдено</p>{/each}
      </div>
    {/if}
    {#if err}<p class="er">{err}</p>{/if}
    <label class="own">Загрузить своё<input type="file" accept="image/*" onchange={choosePhoto} /></label>
    <button class="go" disabled={busy || sel === was} onclick={() => save(sel)}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
    {#if was}<button class="rm" disabled={busy} onclick={() => save(null)}>Убрать логотип</button>{/if}
    {/if}
  </div>
</FloatWin>

<style>
  .bd { padding: 0 6px 6px; }
  .pv { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 10px; text-align: center; }
  .pv small { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
  .big { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); animation: pick .5s cubic-bezier(.2, 1.4, .4, 1); }
  .big img { width: 100%; height: 100%; object-fit: cover; background: #fff; }
  @keyframes pick { from { transform: scale(.6); } }
  .srch { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border-radius: 12px; background: var(--card); box-shadow: var(--shadow); color: var(--muted); }
  .srch input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--text); font: inherit; font-size: 16px; }
  .gridl { display: grid; grid-template-columns: repeat(5, 1fr); grid-auto-rows: 54px; justify-items: center; align-content: start; height: 22vh; min-height: 120px; margin: 8px 0 0; overflow-y: auto; overscroll-behavior: contain; }
  .gridl button { width: 48px; height: 48px; margin: 3px 0; border-radius: 50%; transition: transform .25s, box-shadow .25s; }
  .gridl img { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: #fff; }
  .gridl button.on { transform: scale(1.1); box-shadow: 0 0 0 2.5px var(--gold); }
  .gridl p { grid-column: 1 / -1; margin: 20px 0; font-size: 14px; color: var(--muted); }
  .er { margin: 8px 4px 0; font-size: 13px; color: var(--neg); }
  .go, .rm { display: block; width: 100%; min-height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; }
  .go { margin-top: 10px; color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); }
  .rm { margin-top: 8px; min-height: 44px; font-size: 14px; color: var(--neg); background: var(--fill); }
  button:disabled { opacity: .5; }
  .own { position: relative; display: grid; place-items: center; min-height: 44px; margin-top: 10px; border-radius: 22px; font-size: 14px; font-weight: 600; color: var(--gold); background: var(--fill); overflow: hidden; }
  .own input { position: absolute; inset: 0; opacity: 0; font-size: 16px; }
  .rm.plain { color: var(--gold); }
  .up { display: flex; flex-direction: column; align-items: center; padding: 6px 0 4px; text-align: center; }
  .ring { position: relative; width: 132px; height: 132px; margin: 4px 0 14px; }
  .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
  .ring circle { fill: none; stroke-width: 3.5; stroke: var(--fill); }
  .ring .fg { stroke: var(--gold); stroke-dasharray: 100; stroke-linecap: round; transition: stroke-dashoffset 1.2s cubic-bezier(.3, .6, .25, 1); animation: fill 1.2s cubic-bezier(.3, .6, .25, 1); }
  @keyframes fill { from { stroke-dashoffset: 100; } }
  .ring.ok .fg { stroke: var(--pos); }
  .ring.bad .fg { stroke: var(--neg); }
  .ring img { position: absolute; inset: 14px; width: 104px; height: 104px; border-radius: 50%; }
  .ring i { position: absolute; right: 4px; bottom: 4px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #04210D; background: var(--pos); animation: pick .45s cubic-bezier(.2, 1.5, .4, 1); }
  .up b { font-size: 15px; }
  .up em { margin-top: 6px; font-style: normal; font-size: 26px; font-weight: 700; color: var(--gold); font-variant-numeric: tabular-nums; }
  .up small { margin-top: 4px; font-size: 12px; color: var(--muted); }
  @media (prefers-reduced-motion: reduce) { .big, .ring .fg, .ring i { animation: none; transition: none; } }
</style>
