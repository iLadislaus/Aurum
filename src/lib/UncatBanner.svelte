<script>
  // Красная плашка: есть нераспределённые операции. Нажатие открывает первую из них.
  let { n, onopen } = $props();
  const word = $derived(n % 10 === 1 && n % 100 !== 11 ? ['Есть', 'нераспределённая операция'] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? ['Есть', 'нераспределённые операции'] : ['Есть', 'нераспределённых операций']);
</script>

{#if n > 0}
  <button class="ub" onclick={onopen}>
    <span class="bd"></span>
    <span class="bt">{word[0]} {n} {word[1]}<small>Нажми, чтобы выбрать категорию</small></span>
    <span class="ch">›</span>
  </button>
{/if}

<style>
  .ub { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; margin: 0 0 12px; padding: 11px 14px; border-radius: 16px; background: rgba(229, 88, 77, .12); color: #D43D32; box-shadow: inset 0 0 0 .5px rgba(212, 61, 50, .38); animation: ubIn .5s cubic-bezier(.2, .9, .3, 1) both; -webkit-tap-highlight-color: transparent; }
  .ub:active { background: rgba(229, 88, 77, .2); }
  @keyframes ubIn { from { opacity: 0; transform: translateY(-6px); } }
  .bd { position: relative; width: 9px; height: 9px; border-radius: 50%; background: #E5584D; flex: none; }
  .bd::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: #E5584D; animation: ubPl 2s ease-out infinite; }
  @keyframes ubPl { 0% { transform: scale(1); opacity: .6; } 100% { transform: scale(3); opacity: 0; } }
  .bt { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; line-height: 1.25; }
  .bt small { display: block; margin-top: 1px; font-size: 12px; font-weight: 400; opacity: .85; }
  .ch { font-size: 20px; line-height: 1; }
  @media (prefers-reduced-motion: reduce) { .ub, .bd::after { animation: none; } }
</style>
