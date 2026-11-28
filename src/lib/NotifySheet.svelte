<script>
  // Окно «Уведомления»: включить на этом устройстве, проверить пробным сообщением, выключить
  import { untrack } from 'svelte';
  import { nw, closeNotify } from './notifywin.svelte.js';
  import { supported, prepare, enable, disable, sendTest } from './push.js';
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';

  const TYPES = [['calendar', 'Платежи', 'накануне платежа'], ['coin', 'Бюджет', '80% и превышение'], ['swap', 'Операции', 'только без категории'], ['chart', 'Советы', 'сводка за неделю'], ['plus', 'Новости', 'что нового в приложении']];
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
  const on = () => run(async () => { sub = await enable(reg, key); }, () => { view = 'on'; say('Нажмите «Отправить пробное»'); });
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
  <div class="grp">
    {#each TYPES as [icon, name, hint], i (name)}
      <div class="it rise" style="--i:{i}">
        <span class="ic"><Icon name={icon} size={17} /></span>
        <span class="m"><b>{name}</b><small>{hint}</small></span>
        <span class="pill">скоро</span>
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
  .note { margin: 0; padding: 14px 16px; border-radius: 18px; background: var(--card); box-shadow: var(--shadow); font-size: 14px; line-height: 1.4; }
  .msg { margin: 10px 4px 0; text-align: center; font-size: 13px; color: var(--muted); }
  .msg.bad { color: var(--neg); }
  .grp { margin-top: 12px; border-radius: 18px; background: var(--card); box-shadow: var(--shadow); overflow: hidden; }
  .it { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 11px 14px; position: relative; }
  .it + .it::before { content: ""; position: absolute; top: 0; left: 58px; right: 0; height: .5px; background: var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--gold-soft); color: var(--gold); flex: none; }
  .m { flex: 1; min-width: 0; }
  .m b { display: block; font-weight: 500; font-size: 15px; }
  .m small { display: block; color: var(--muted); font-size: 12px; }
  .pill { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 99px; background: var(--gold-soft); color: var(--gold); }
</style>
