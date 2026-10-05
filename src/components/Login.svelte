<script lang="ts">
  import { startLogin } from '../lib/api/oauth';
  import { REPO_URL } from '../lib/app';
  import { t } from '../lib/stores/i18n.svelte';

  let { error = '', onCancel }: { error?: string; onCancel?: () => void } = $props();

  let instance = $state('');
  let busy = $state(false);
  let localError = $state('');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    localError = '';
    try {
      await startLogin(instance);
    } catch (err) {
      localError = err instanceof Error ? err.message : String(err);
      busy = false;
    }
  }
</script>

<div class="login">
  <div class="hero">
    <img src="/icon-512.png" alt="" width="132" height="132" />
    <h1>Ronsu</h1>
    <p class="tagline">{t('login.tagline')}</p>
  </div>

  <form onsubmit={submit}>
    <label for="instance">{t('login.server')}</label>
    <input
      id="instance"
      type="text"
      inputmode="url"
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
      placeholder="mastodon.social"
      bind:value={instance}
      required
    />

    {#if error || localError}
      <p class="error" role="alert">{error || localError}</p>
    {/if}

    <button type="submit" class="primary" disabled={busy || !instance.trim()}>{busy ? t('login.redirecting') : t('login.submit')}</button>
    {#if onCancel}
      <button type="button" class="secondary" onclick={onCancel}>{t('common.cancel')}</button>
    {/if}
    <p class="muted">{t('login.help')}</p>
    <p class="about">Ronsu {__APP_VERSION__} · <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a></p>
  </form>
</div>

<style>
  .login { max-width: 28rem; margin: 0 auto; min-height: 100dvh; padding: 0 1.5rem; box-sizing: border-box; display: flex; flex-direction: column; }
  .hero { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.9rem; text-align: center; padding-top: 1.5rem; }
  .hero img { width: 8.25rem; height: 8.25rem; border-radius: 30px; box-shadow: 0 14px 34px rgb(0 0 0 / 0.3); }
  h1 { margin: 0.5rem 0 0; font-size: 2.4rem; letter-spacing: -0.02em; }
  .tagline { text-wrap: balance; margin: 0; max-width: 17rem; font-size: 1.05rem; line-height: 1.5; color: var(--muted); }
  form { display: grid; gap: 0.65rem; padding-bottom: calc(2.2rem + env(safe-area-inset-bottom)); }
  label { font-weight: 600; font-size: 0.9rem; }
  input {
    font: inherit; font-size: 1.05rem; height: 3.25rem; padding: 0 1rem; border-radius: 0.9rem;
    border: 1px solid var(--border); background: var(--surface); color: var(--text);
  }
  button { height: 3.25rem; border: 0; border-radius: 0.9rem; font: inherit; font-size: 1.05rem; font-weight: 700; }
  .primary { margin-top: 0.25rem; background: var(--accent); color: var(--on-accent); }
  .secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
  button:disabled { opacity: 0.6; cursor: default; }
  .muted { margin: 0.3rem 0 0; font-size: 0.9rem; line-height: 1.5; color: var(--muted); }
  .about { margin: 0.6rem 0 0; text-align: center; font-size: 0.85rem; color: var(--muted); }
  .about a { color: inherit; }
  .error { color: var(--danger); margin: 0; }
</style>
