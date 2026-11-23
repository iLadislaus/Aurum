<script>
  import { money, signed } from '../lib/format.js';
  let { months, shown } = $props();

  const W = 330, H = 168, TOP = 26, PLOT = 96, PAD = 24;
  let sel = $state(months.length - 1);
  let cur = $derived(months[sel]);
  let nets = $derived(months.map((m) => m.income - m.expense));
  let net = $derived(nets[sel]);

  let go = $state(false);
  $effect(() => {
    if (shown) { const t = setTimeout(() => (go = true), 200); return () => clearTimeout(t); }
    go = false;
  });

  let geo = $derived.by(() => {
    const n = months.length;
    const lo = Math.min(0, ...nets), hi = Math.max(0, ...nets), span = hi - lo || 1;
    const x = (i) => (n < 2 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1));
    const y = (v) => TOP + ((hi - v) / span) * PLOT;
    const pts = nets.map((v, i) => [x(i), y(v)]);
    let d = '';
    pts.forEach((p, i) => {
      if (!i) d = `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      else { const a = pts[i - 1], m = (a[0] + p[0]) / 2; d += `C${m.toFixed(1)} ${a[1].toFixed(1)} ${m.toFixed(1)} ${p[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`; }
    });
    return { pts, d, z: y(0), step: n < 2 ? W : (W - PAD * 2) / (n - 1) };
  });

  const k = (v) => (v >= 0 ? '+' : '−') + (Math.abs(v) / 1000).toFixed(1).replace('.', ',') + 'k';
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
  let sub = $derived.by(() => {
    if (net < 0) return 'расходы больше доходов';
    if (net === Math.max(...nets) && months.length > 1) return `лучший результат за ${months.length} мес.`;
    const p = months[sel - 1];
    if (!p) return 'накоплено за месяц';
    const dd = net - (p.income - p.expense);
    return `${dd >= 0 ? '+' : '−'}${Math.abs(dd).toLocaleString('ru-RU')} к ${p.label.toLowerCase()}`;
  });
</script>

<div class="grp">
  <div class="top">
    <div class="l">{cap(cur.name)} · накоплено</div>
    <div class="big" class:neg={net < 0} class:in={go}>{signed(net)}</div>
    <div class="sub">{sub}</div>
  </div>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Накопление по месяцам">
    <defs>
      <linearGradient id="fcN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E5584A" stop-opacity=".1" /><stop offset="1" stop-color="#E5584A" stop-opacity=".62" /></linearGradient>
      <clipPath id="fcUp"><rect x="0" y="0" width={W} height={geo.z} /></clipPath>
      <clipPath id="fcDn"><rect x="0" y={geo.z} width={W} height={H} /></clipPath>
      <linearGradient id="fcP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8C277" stop-opacity=".5" /><stop offset="1" stop-color="#E8C277" stop-opacity="0" /></linearGradient>
      <filter id="fcG" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <line x1="4" x2={W - 4} y1={geo.z} y2={geo.z} class="zero" />
    {#if months.length > 1}
      <g class="area" class:in={go}>
        <path d="{geo.d}L{geo.pts.at(-1)[0]} {geo.z}L{geo.pts[0][0]} {geo.z}Z" fill="url(#fcP)" clip-path="url(#fcUp)" />
        <path d="{geo.d}L{geo.pts.at(-1)[0]} {geo.z}L{geo.pts[0][0]} {geo.z}Z" fill="url(#fcN)" clip-path="url(#fcDn)" />
      </g>
      <path d={geo.d} pathLength="1" class="ln" class:in={go} filter="url(#fcG)" />
    {/if}
    {#each geo.pts as p, i}
      <g class="pt" class:in={go} style:transition-delay="{go ? 500 + i * 120 : 0}ms">
        <circle cx={p[0]} cy={p[1]} r={i === sel ? 5.5 : 3.4} class="dot" class:on={i === sel} />
        <text x={p[0]} y={nets[i] >= 0 ? p[1] - 12 : p[1] + 19} text-anchor="middle" class="v" class:on={i === sel}>{k(nets[i])}</text>
      </g>
    {/each}
    <circle class="pls" cx={geo.pts[sel][0]} cy={geo.pts[sel][1]} r="5" />
    {#each months as m, i}
      <text x={geo.pts[i][0]} y={H - 8} text-anchor="middle" class="m" class:on={i === sel}>{m.label}</text>
      <rect x={geo.pts[i][0] - Math.max(geo.step / 2, 16)} y="0" width={Math.max(geo.step, 32)} height={H} class="hit" role="button" tabindex="0" aria-label={cap(m.name)} onclick={() => (sel = i)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (sel = i))} />
    {/each}
  </svg>
  <div class="tri" class:in={go}>
    <div><div class="a">Доходы</div><div class="b pos">{signed(cur.income, 0)}&nbsp;₴</div></div>
    <div><div class="a">Расходы</div><div class="b neg">{money(cur.expense)}</div></div>
    <div><div class="a">Накоплено</div><div class="b">{money(net)}</div></div>
  </div>
</div>

<style>
  .grp { background: linear-gradient(170deg, #16130B 0%, #0B0B0C 58%, #070708 100%); border-radius: 28px; box-shadow: 0 0 0 .5px rgba(232,194,119,.24) inset, 0 18px 40px rgba(184,134,44,.07); color: #F4EEDD; overflow: hidden; user-select: none; -webkit-user-select: none; }
  .top { padding: 16px 16px 0; }
  .l { font-size: 12px; color: #9A917B; }
  .big { font-size: 34px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; margin-top: 2px; font-variant-numeric: tabular-nums;
    background: linear-gradient(100deg, #B8892B 0%, #F6E3A1 45%, #FFF6D6 60%, #E8C277 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
    opacity: 0; transform: translateY(8px); transition: opacity .7s, transform .7s; }
  .big.in { opacity: 1; transform: none; }
  .big.neg { background: none; color: #FF8A7E; }
  .sub { font-size: 12.5px; color: #9A917B; margin-top: 3px; }
  svg { display: block; width: 100%; height: auto; touch-action: pan-y; margin-top: 4px; }
  .zero { stroke: rgba(255,255,255,.14); stroke-dasharray: 3 4; stroke-width: .8; }
  .ln { fill: none; stroke: #E8C277; stroke-width: 2.6; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1.5s cubic-bezier(.3,.7,.2,1); }
  .ln.in { stroke-dashoffset: 0; }
  .area { opacity: 0; transition: opacity 1s .5s; } .area.in { opacity: 1; }
  .pt { opacity: 0; transition: opacity .5s; } .pt.in { opacity: 1; }
  .dot { fill: #16130B; stroke: #E8C277; stroke-width: 1.7; transition: r .25s; }
  .dot.on { fill: #F6E3A1; }
  .v { fill: #9A917B; font-size: 10.5px; font-weight: 500; font-variant-numeric: tabular-nums; }
  .v.on { fill: #F6E3A1; font-weight: 700; font-size: 11.5px; }
  .m { fill: #7D7560; font-size: 11px; font-weight: 500; }
  .m.on { fill: #F6E3A1; font-weight: 700; }
  @keyframes pl { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(3.2); opacity: 0; } }
  .pls { fill: #E8C277; transform-box: fill-box; transform-origin: center; animation: pl 2s ease-out infinite; pointer-events: none; }
  .hit { fill: transparent; cursor: pointer; outline: none; }
  .tri { display: flex; border-top: .5px solid rgba(255,255,255,.08); }
  .tri > div { flex: 1; padding: 11px 12px; min-width: 0; }
  .tri > div + div { border-left: .5px solid rgba(255,255,255,.08); }
  .a { font-size: 12px; color: #9A917B; }
  .b { font-size: 14px; font-weight: 600; margin-top: 2px; font-variant-numeric: tabular-nums; white-space: nowrap; opacity: 0; transform: translateY(8px); transition: opacity .7s, transform .7s; }
  .tri.in .b { opacity: 1; transform: none; }
  .pos { color: #7ED08A; } .neg { color: #FF8A7E; }
</style>
