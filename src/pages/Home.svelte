<script>
  import Screen from '../lib/Screen.svelte';
  import Skeleton from '../lib/Skeleton.svelte';
</script>

<Screen title="Главная">
  <div class="gold rise" style:--i="1">
    <small>Общий баланс</small>
    <b class="num">0,00 ₴</b>
  </div>
  <Skeleton count={9} />
</Screen>

<style>
  .gold { height: 84px; border-radius: 18px; background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; padding: 14px 16px; box-shadow: 0 1px 2px rgba(120,80,10,.25); }
  small { display: block; font-size: 12px; opacity: .85; }
  b { font-size: 26px; font-weight: 700; letter-spacing: -.3px; }
</style>
