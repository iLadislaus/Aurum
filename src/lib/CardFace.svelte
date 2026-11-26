<script>
  // Лицо карты для окон операции. theme: 'black' | 'white' — карта Monobank (картинка), иначе карта Aurum с золотыми нитями.
  let { theme = null, kind = '', amount, chip, acct } = $props();
  const mono = $derived(theme === 'black' || theme === 'white');
  const THREADS = Array.from({ length: 14 }, (_, k) => ({ d: `M120 ${250 - k * 2.8} C 210 ${200 - k * 7}, 250 ${120 + k * 4.2}, 380 ${40 + k * 8.4}`, o: +(0.5 - k * 0.025).toFixed(3) }));
</script>

<div class="cf" class:mono class:white={theme === 'white'}>
  {#if mono}
    <img class="bgi" src="{import.meta.env.BASE_URL}cards/mono-{theme}.jpg" alt="" draggable="false" />
    <span class="kd">{kind}</span>
    <div class="ab">{@render amount()}</div>
    <div class="mac">{@render acct()}</div>
  {:else}
    <div class="art" aria-hidden="true">
      <svg viewBox="0 0 360 236" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="nfl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E8C277" stop-opacity="0" /><stop offset=".55" stop-color="#F4DDA6" stop-opacity=".55" /><stop offset="1" stop-color="#E8C277" stop-opacity="0" /></linearGradient>
          <radialGradient id="ngl" cx=".9" cy=".1" r=".7"><stop offset="0" stop-color="#E8C277" stop-opacity=".14" /><stop offset="1" stop-color="#E8C277" stop-opacity="0" /></radialGradient>
        </defs>
        <rect width="360" height="236" fill="url(#ngl)" />
        <g class="th">{#each THREADS as t, k (k)}<path d={t.d} fill="none" stroke="url(#nfl)" stroke-width=".7" opacity={t.o} />{/each}</g>
      </svg>
    </div>
    <div class="c1"><span class="lg">A</span><b>AURUM</b><em>{kind}</em></div>
    <div class="ab">{@render amount()}</div>
    <div class="c3">{@render chip?.()}{@render acct()}</div>
  {/if}
</div>

<style>
  .cf { --fg: #F4DDA6; --sub: #8a7857; --pill: rgba(232, 194, 119, .11); position: relative; z-index: 3; border-radius: 24px; padding: 18px 20px; color: #F4EEDD; background: linear-gradient(135deg, #25201a 0%, #14110d 55%, #0a0807 100%); box-shadow: inset 0 0 0 .6px rgba(232, 194, 119, .32), 0 12px 24px -16px rgba(0, 0, 0, .8); }
  .cf.mono { --fg: #fff; --sub: rgba(255, 255, 255, .62); --pill: rgba(255, 255, 255, .12); padding: 0; aspect-ratio: 16 / 9; border-radius: 22px; background: #1a1a1a; box-shadow: 0 0 0 .6px rgba(255, 255, 255, .14), 0 14px 28px -16px rgba(0, 0, 0, .9); }
  .cf.mono.white { --fg: #0d0d10; --sub: rgba(0, 0, 0, .5); --pill: rgba(0, 0, 0, .07); background: #f2f2f5; box-shadow: 0 0 0 .6px rgba(255, 255, 255, .5), 0 14px 28px -16px rgba(0, 0, 0, .9); }
  .bgi { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; pointer-events: none; -webkit-user-drag: none; }
  .art { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; }
  .art svg { width: 100%; height: 100%; display: block; }
  .th { transform-origin: 120px 240px; animation: sway 7s ease-in-out infinite alternate; }
  @keyframes sway { from { transform: rotate(-1.2deg); opacity: .75; } to { transform: rotate(1.6deg); opacity: 1; } }
  .c1, .ab, .c3 { position: relative; z-index: 1; }
  .c1 { display: flex; align-items: center; gap: 9px; }
  .lg { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 800; color: #3a2806; background: linear-gradient(160deg, #F2D58F, #B8862C); box-shadow: 0 0 0 1.5px rgba(246, 219, 156, .25); }
  .c1 b { font-size: 15px; font-weight: 800; letter-spacing: .2em; color: #F4DDA6; }
  .c1 em { margin-left: auto; font-style: normal; font-size: 12px; letter-spacing: .16em; font-weight: 600; color: #a99366; }
  .c3 { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 22px; }
  .kd { position: absolute; top: 22px; right: 22px; font-size: 12px; letter-spacing: .16em; font-weight: 700; color: var(--sub); }
  .cf.mono .ab { position: absolute; left: 22px; top: 31%; }
  .mch { position: absolute; left: 22px; right: 22px; top: 53%; }
  .mac { position: absolute; left: 20px; bottom: 16px; }
  /* общие части содержимого (разметку дают окна) */
  .cf :global(.big) { display: flex; align-items: baseline; gap: 8px; margin-top: 26px; }
  .cf :global(.big input), .cf :global(.big .v) { flex: none; min-width: 1ch; padding: 0; margin: 0; text-align: left; border: 0; outline: 0; background: none; font: inherit; font-size: 52px; font-weight: 700; letter-spacing: -1.6px; line-height: 1.15; color: var(--fg); font-variant-numeric: tabular-nums; -webkit-user-select: text; user-select: text; }
  .cf :global(.big input::placeholder) { color: #6f6150; }
  .cf :global(.big input) { max-width: calc(100% - 44px); }
  .cf :global(.big .v) { white-space: nowrap; }
  .cf :global(.big u) { text-decoration: none; font-size: 30px; color: var(--sub); font-weight: 600; }
  .cf.mono :global(.big) { margin-top: 0; }
  .cf.mono :global(.big input), .cf.mono :global(.big .v) { font-size: 38px; letter-spacing: -1.2px; }
  .cf.mono :global(.big u) { font-size: 22px; }
  .cf.mono .ab { white-space: nowrap; }
  .cf :global(.ct) { display: flex; align-items: center; gap: 10px; min-width: 0; font-size: 16px; font-weight: 600; color: var(--fg); }
  .cf.mono :global(.ct) { font-size: 14px; gap: 8px; }
  .cf :global(.ct span) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cf :global(.cn) { display: flex; flex-direction: column; line-height: 1.15; }
  .cf :global(.cn small) { font-size: 12px; color: var(--sub); font-weight: 500; margin-top: 2px; }
  .cf :global(.dw) { position: relative; min-width: 0; }
  .cf :global(.dd) { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; max-width: 100%; padding: 6px 12px 7px 14px; border-radius: 16px; background: var(--pill); color: var(--fg); transition: background .2s, box-shadow .2s; }
  .cf:not(.mono) :global(.dd) { color: #E8C277; }
  .cf :global(.dd small) { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--sub); font-weight: 600; }
  .cf:not(.mono) :global(.dd small) { color: #a99366; }
  .cf :global(.dd span) { display: flex; align-items: center; gap: 5px; max-width: 100%; font-size: 15px; font-weight: 600; }
  .cf :global(.dd span b) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; max-width: 150px; }
  .cf :global(.dd.o) { box-shadow: 0 0 0 1px rgba(240, 203, 130, .45); }
  .cf :global(.dd.ro) { padding-right: 14px; }
  .cf :global(.sw) { flex: none; color: #cfae6a; padding: 4px; }
  @media (prefers-reduced-motion: reduce) { .th { animation: none; } }
</style>
