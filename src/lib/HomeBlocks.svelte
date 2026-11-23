<script>
  import Icon from './Icon.svelte';
  import { hb, meta, toggle, move, closeBlocks, endLesson } from './homeblocks.svelte.js';

  const RH = 64;
  let drag = $state(null); // { id, y }
  let dy0 = 0, from = 0;
  let sy = $state(0), sdrag = false, sY0 = 0, shift = 0;

  function lift(e, id) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    from = hb.list.findIndex((x) => x.id === id);
    dy0 = e.clientY;
    drag = { id, y: from * RH };
  }
  function pull(e) {
    if (!drag) return;
    const y = Math.max(0, Math.min((hb.list.length - 1) * RH, from * RH + e.clientY - dy0));
    drag.y = y;
    move(drag.id, Math.round(y / RH));
  }
  const drop = () => { drag = null; };
  const top = (id, i) => (drag?.id === id ? drag.y : i * RH);

  // закрытие свайпом вниз за верхнюю часть окна
  function sdown(e) { sdrag = true; sY0 = e.clientY; shift = 0; e.currentTarget.setPointerCapture(e.pointerId); }
  function smove(e) { if (sdrag) { shift = Math.max(0, e.clientY - sY0); sy = shift; } }
  function sup() { if (!sdrag) return; sdrag = false; const c = sy > 90; sy = 0; if (c) closeBlocks(); }
</script>

<div class="hb" class:open={hb.open}>
  <button class="ov" aria-label="Закрыть" onclick={closeBlocks}></button>
  <div class="sh" class:dragging={sdrag} role="dialog" aria-modal="true" aria-label="Блоки главной" style:transform={hb.open ? `translateY(${sy}px)` : undefined}>
    <div class="top" onpointerdown={sdown} onpointermove={smove} onpointerup={sup} onpointercancel={sup}>
      <div class="gr"></div>
      <div class="tt"><b>Блоки главной</b><button class="ok" onpointerdown={(e) => e.stopPropagation()} onclick={closeBlocks}>Готово</button></div>
    </div>
    <div class="ls" style:height="{hb.list.length * RH}px">
      {#each hb.list as b, i (b.id)}
        {@const m = meta(b.id)}
        <div class="r" class:off={!b.on} class:lift={drag?.id === b.id} style:transform="translateY({top(b.id, i)}px)">
          <span class="hd" role="presentation" onpointerdown={(e) => lift(e, b.id)} onpointermove={pull} onpointerup={drop} onpointercancel={drop}>≡</span>
          <span class="ic"><Icon name={m.i} size={18} /></span>
          <span class="t">{m.n}</span>
          <button class="sw" class:on={b.on} role="switch" aria-checked={b.on} aria-label={m.n} onclick={() => toggle(b.id)}></button>
        </div>
      {/each}
    </div>
    <p class="note">Потяните за ≡, чтобы поменять порядок. Выключенные блоки скрываются с главной.</p>

    {#if hb.lesson}
      <div class="les" role="presentation" onclick={endLesson}>
        <div class="lt">Тяни за ≡, чтобы поменять блоки местами</div>
        <div class="dl">
          <div class="dr d0"><span class="hd">≡</span><span class="ic"><Icon name="wallet" size={18} /></span><span class="t">Общий баланс</span></div>
          <div class="dr d1"><span class="hd">≡</span><span class="ic"><Icon name="chart" size={18} /></span><span class="t">Бюджет</span></div>
          <div class="dr"><span class="hd">≡</span><span class="ic"><Icon name="swap" size={18} /></span><span class="t">Денежный поток</span></div>
          <div class="fg"><i></i></div>
        </div>
        <div class="lb">Главная перестраивается сразу. Нажми, чтобы закрыть</div>
      </div>
    {/if}
  </div>
</div>

<style>
  .hb { position: absolute; inset: 0; z-index: 55; pointer-events: none; }
  .hb.open { pointer-events: auto; }
  .ov { position: absolute; inset: 0; width: 100%; background: rgba(0, 0, 0, .4); opacity: 0; transition: opacity .45s cubic-bezier(.32, .72, 0, 1); }
  .open .ov { opacity: 1; }
  .sh { position: absolute; left: 14px; right: 14px; bottom: 0; top: calc(env(safe-area-inset-top, 0px) + 14px); display: flex; flex-direction: column;
    background: var(--bg); border-radius: 26px 26px 0 0; overflow: hidden; transform: translateY(105%); transition: transform .5s cubic-bezier(.32, .72, 0, 1);
    box-shadow: inset 0 1px 0 rgba(255, 236, 170, .9), inset 0 0 0 .5px rgba(214, 164, 62, .4), 0 -3px 16px rgba(226, 172, 62, .26); }
  .sh.dragging { transition: none; }
  .top { flex: none; touch-action: none; padding: 0 12px 8px; }
  .gr { width: 36px; height: 5px; border-radius: 3px; background: #C9A24A; opacity: .8; margin: 8px auto; }
  .tt { display: flex; justify-content: space-between; align-items: center; }
  .tt b { font-size: 17px; font-weight: 700; }
  .ok { border-radius: 99px; padding: 7px 15px; background: var(--gold-soft); color: var(--gold); font-size: 14px; font-weight: 600; }
  .ls { position: relative; margin: 4px 8px 0; flex: none; }
  .r { position: absolute; left: 0; right: 0; height: 56px; display: flex; align-items: center; gap: 4px; padding: 0 10px 0 2px; border-radius: 99px; background: var(--card); box-shadow: var(--shadow, none), inset 0 0 0 .5px var(--line); transition: transform .28s cubic-bezier(.32, .72, 0, 1), box-shadow .2s; }
  .r.lift { z-index: 3; transition: box-shadow .2s; box-shadow: 0 10px 24px -6px rgba(0, 0, 0, .55), inset 0 0 0 .5px rgba(232, 194, 119, .6); }
  .hd { width: 30px; height: 44px; display: grid; place-items: center; color: var(--muted); font-size: 19px; touch-action: none; flex: none; }
  .lift .hd { color: var(--gold); }
  .ic { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); flex: none; transition: background .2s, color .2s; }
  .t { flex: 1; min-width: 0; margin-left: 4px; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .2s; }
  .off .t { color: var(--muted); }
  .off .ic { background: var(--fill); color: var(--muted); }
  .sw { position: relative; width: 51px; height: 31px; border-radius: 99px; background: rgba(120, 120, 128, .32); flex: none; transition: background .25s; }
  .sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0, 0, 0, .3); transition: transform .25s cubic-bezier(.3, .7, .4, 1); }
  .sw.on { background: #D9A93F; }
  .sw.on::after { transform: translateX(20px); }
  .note { margin: 14px 18px 0; font-size: 12.5px; color: var(--muted); text-align: center; }

  .les { position: absolute; inset: 0; z-index: 20; background: rgba(0, 0, 0, .88); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 18px; text-align: center; animation: fi .4s both; }
  @keyframes fi { from { opacity: 0; } }
  .lt { color: #F4DDA6; font-size: 16px; font-weight: 700; max-width: 240px; }
  .lb { color: rgba(255, 255, 255, .6); font-size: 12.5px; }
  .dl { position: relative; width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: 30px; background: #0e0e0f; box-shadow: 0 0 0 2px rgba(232, 194, 119, .8), 0 0 36px rgba(232, 194, 119, .3); }
  .dr { display: flex; align-items: center; gap: 4px; height: 52px; padding: 0 10px 0 2px; background: #1b1b1c; border-radius: 99px; color: #F1ECDD; }
  .dr .hd { color: #E8C277; }
  .d0 { z-index: 2; animation: m0 6s ease-in-out forwards; }
  .d1 { animation: m1 6s ease-in-out forwards; }
  @keyframes m0 { 0%, 22% { transform: none; box-shadow: none; } 30% { box-shadow: 0 8px 20px rgba(0, 0, 0, .6); background: #2a2417; } 50%, 74% { transform: translateY(60px); box-shadow: 0 8px 20px rgba(0, 0, 0, .6); background: #2a2417; } 90%, 100% { transform: none; box-shadow: none; } }
  @keyframes m1 { 0%, 28% { transform: none; } 50%, 74% { transform: translateY(-60px); } 90%, 100% { transform: none; } }
  .fg { position: absolute; left: 12px; top: 10px; width: 30px; height: 52px; display: grid; place-items: center; pointer-events: none; z-index: 5; animation: fg 6s ease-in-out forwards; }
  .fg i { width: 30px; height: 30px; border-radius: 50%; background: rgba(255, 255, 255, .85); border: 2px solid #B8862C; box-shadow: 0 2px 10px rgba(0, 0, 0, .4); }
  @keyframes fg { 0% { transform: none; opacity: 0; } 12%, 22% { transform: none; opacity: 1; } 50%, 74% { transform: translateY(60px); opacity: 1; } 90% { transform: none; opacity: 1; } 100% { transform: none; opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .ov, .sh, .r, .d0, .d1, .fg { transition: none; animation: none; } }
</style>
