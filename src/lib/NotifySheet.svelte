<script>
  // Окно «Уведомления»: включить на этом устройстве, проверить пробным сообщением, выключить
  import { untrack } from 'svelte';
  import { nw, closeNotify } from './notifywin.svelte.js';
  import { supported, prepare, enable, disable, sendTest, prefs } from './push.js';
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';

  const PLAN = [['payments', 'calendar', 'Платежи', 'накануне в 09:00'], ['advice', 'chart', 'Советы', 'анализ по воскресеньям']];
  const KEY = 'aurum.pushprefs';
  // что присылать; до ответа базы показываем запомненное
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* пусто */ }
  let p = $state({ ops: 'all', budget: true, payments: true, advice: true, ...saved });
  const keep = (v) => { p = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* хранилище недоступно */ } };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);

  // view: wait | none (нельзя) | denied | off | on
  let view = $state('wait'), busy = $state(false), msg = $state(''), bad = $state(false);
  let reg = null, key = null, sub = null;
  const label = $derived({ wait: '', none: 'недоступны', denied: 'запрещены', off: 'выключены', on: 'включены' }[view]);

  const say = (text, isBad = false) => { msg = text; bad = isBad; };

  async function load() {
    say('');
    if (!supported()) { view = 'none'; return; }
    view = 'wait';
    try {
      ({ reg, sub, key } = await prepare());
      view = sub ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off';
      if (sub) keep(await prefs());
    } catch (e) { say(e.message || 'Не получилось, попробуйте ещё раз', true); }
  }
  $effect(() => { if (nw.open) untrack(() => { busy = false; load(); }); });

  async function run(job, done) {
    if (busy) return;
    busy = true; say('');
    try { await job(); done(); }
    catch (e) {
      if (Notification.permission === 'denied') view = 'denied';
      else if (e.gone) { await load(); say(e.message, true); }
      else say(e.name === 'NotAllowedError' ? 'Разрешение не дано, нажмите ещё раз' : e.message, true);
    }
    busy = false;
  }
  // сначала меняем на экране, потом в базе; при ошибке возвращаем как было
  async function change(next) {
    const was = p;
    keep({ ...p, ...next }); say('');
    try { await prefs(next); } catch (e) { keep(was); say(e.message, true); }
  }
  const on = () => run(async () => { sub = await enable(reg, key); keep(await prefs()); }, () => { view = 'on'; say('Нажмите «Отправить пробное»'); });
  const off = () => run(() => disable(sub), () => load());
  const test = () => run(() => sendTest(sub), () => say('Отправлено, должно прийти через несколько секунд'));
</script>

<Sheet open={nw.open} onclose={closeNotify} title="Уведомления" sub={label} z={50}>
  {#if view === 'none'}
    <p class="note">{ios ? 'Откройте Aurum значком с экрана «Домой»: в обычной вкладке Safari уведомления не работают.' : 'Этот браузер не умеет получать уведомления.'}</p>
  {:else if view === 'denied'}
    <p class="note">{ios ? 'Разрешите их в «Настройках» iPhone: Уведомления → Aurum. Затем откройте это окно снова.' : 'Разрешите уведомления для этого сайта в настройках браузера.'}</p>
  {:else if view === 'on'}
    <button class="go" disabled={busy} onclick={test}>Отправить пробное</button>
  {:else}
    <button class="go" disabled={busy || view !== 'off'} onclick={on}>{view === 'wait' ? 'Готовлю…' : ios ? 'Включить на этом iPhone' : 'Включить на этом устройстве'}</button>
  {/if}
  {#if msg}<p class="msg" class:bad role="status">{msg}</p>{/if}
  {#if view === 'wait' && bad}<button class="rm gold" onclick={load}>Повторить</button>{/if}
  <div class="grp" class:dim={view !== 'on'}>
    <div class="it rise" style="--i:0">
      <span class="ic"><Icon name="swap" size={17} /></span>
      <span class="m"><b>Операции</b><small>новые из Monobank</small></span>
      <button class="sw" class:y={p.ops !== 'off'} role="switch" aria-checked={p.ops !== 'off'} aria-label="Операции" disabled={view !== 'on'} onclick={() => change({ ops: p.ops === 'off' ? 'all' : 'off' })}><i></i></button>
    </div>
    <div class="x" class:o={p.ops !== 'off'} inert={p.ops === 'off' || view !== 'on'}><div>
      <div class="seg" style:--p={p.ops === 'uncat' ? 1 : 0}><i></i>
        <button class:on={p.ops !== 'uncat'} onclick={() => change({ ops: 'all' })}>Все</button>
        <button class:on={p.ops === 'uncat'} onclick={() => change({ ops: 'uncat' })}>Без категории</button>
      </div>
    </div></div>
    <div class="it rise" style="--i:1">
      <span class="ic"><Icon name="coin" size={17} /></span>
      <span class="m"><b>Бюджет</b><small>80% и превышение</small></span>
      <button class="sw" class:y={p.budget} role="switch" aria-checked={p.budget} aria-label="Бюджет" disabled={view !== 'on'} onclick={() => change({ budget: !p.budget })}><i></i></button>
    </div>
    {#each PLAN as [k, icon, name, hint], i (k)}
      <div class="it rise" style="--i:{i + 2}">
        <span class="ic"><Icon name={icon} size={17} /></span>
        <span class="m"><b>{name}</b><small>{hint}</small></span>
        <button class="sw" class:y={p[k]} role="switch" aria-checked={p[k]} aria-label={name} disabled={view !== 'on'} onclick={() => change({ [k]: !p[k] })}><i></i></button>
      </div>
    {/each}
  </div>
  {#if view === 'on'}<button class="rm" disabled={busy} onclick={off}>Выключить на этом устройстве</button>{/if}
</Sheet>

<style>
  .go, .rm { display: block; width: 100%; min-height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; }
  .go { color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); }
  .rm { margin-top: 12px; font-size: 14px; color: var(--neg); background: var(--fill); }
  .rm.gold { color: var(--gold); }
  button:disabled { opacity: .5; }
  .grp.dim { opacity: .5; }
  .sw { width: 52px; height: 44px; flex: none; position: relative; }
  .sw::before { content: ""; position: absolute; left: 0; right: 0; top: 6px; height: 32px; border-radius: 16px; background: var(--fill); transition: background .3s; }
  .sw i { position: absolute; top: 8px; left: 2px; width: 28px; height: 28px; border-radius: 50%; background: #fff; box-shadow: 0 2px 5px rgba(0, 0, 0, .25); transition: transform .35s cubic-bezier(.3, 1.4, .5, 1); }
  .sw.y::before { background: linear-gradient(#EBC77A, #B8862C); }
  .sw.y i { transform: translateX(20px); }
  .sw:disabled { opacity: 1; }
  .x { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s cubic-bezier(.32, .72, 0, 1); }
  .x.o { grid-template-rows: 1fr; }
  .x > div { overflow: hidden; min-height: 0; }
  .seg { display: grid; grid-template-columns: 1fr 1fr; margin: 0 14px 12px 58px; padding: 2px; border-radius: 11px; background: var(--fill); position: relative; }
  .seg i { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / 2); border-radius: 9px; background: linear-gradient(#F6E3A1, #D9B24C 60%, #B8892B); transform: translateX(calc(var(--p) * 100%)); transition: transform .4s cubic-bezier(.32, .72, 0, 1); }
  .seg button { position: relative; min-height: 40px; font-size: 13px; font-weight: 600; color: var(--muted); transition: color .3s; }
  .seg button.on { color: #1A1204; }
  @media (prefers-reduced-motion: reduce) { .sw i, .x, .seg i { transition: none; } }
  .note { margin: 0; padding: 14px 16px; border-radius: 18px; background: var(--card); box-shadow: var(--shadow); font-size: 14px; line-height: 1.4; }
  .msg { margin: 10px 4px 0; text-align: center; font-size: 13px; color: var(--muted); }
  .msg.bad { color: var(--neg); }
  .grp { margin-top: 12px; border-radius: 18px; background: var(--card); box-shadow: var(--shadow); overflow: hidden; }
  .it { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 11px 14px; position: relative; }
  .it + .it::before, .x + .it::before { content: ""; position: absolute; top: 0; left: 58px; right: 0; height: .5px; background: var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--gold-soft); color: var(--gold); flex: none; }
  .m { flex: 1; min-width: 0; }
  .m b { display: block; font-weight: 500; font-size: 15px; }
  .m small { display: block; color: var(--muted); font-size: 12px; }
</style>
