<script>
  import { auth, signInGoogle } from '../lib/auth.svelte.js';
</script>

<section>
  <img src="./icon-192.png" alt="" width="96" height="96" />
  <h1>Aurum</h1>
  <p>Войдите, чтобы увидеть свои счета и операции</p>
  <button class="go" onclick={signInGoogle}>Войти через Google</button>
  {#if auth.error}<div class="err">{auth.error}</div>{/if}
</section>

<style>
  section { min-height: 100lvh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; gap: 8px; }
  img { border-radius: 22px; box-shadow: 0 10px 30px -10px rgba(232,194,119,.5); }
  h1 { margin: 12px 0 0; font-size: 34px; font-weight: 700; letter-spacing: .4px; }
  p { margin: 0 0 20px; color: var(--muted); font-size: 15px; }
  .go { min-height: 50px; padding: 0 28px; border-radius: 14px; font-size: 17px; font-weight: 600; color: #2A1D05; background: linear-gradient(160deg, #EBC77A, #B8862C); }
  .go:active { opacity: .85; }
  .err { color: var(--neg); font-size: 13px; max-width: 300px; }
</style>
