<script lang="ts">
  import { onMount } from 'svelte';
  import { missingScopes, startLogin } from '../lib/api/oauth';
  import { type MessageKey } from '../lib/i18n';
  import { PUSH_POLICIES, PUSH_TYPES, type PushPolicy } from '../lib/pushLogic';
  import { accountStore } from '../lib/stores/accounts.svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import { push } from '../lib/stores/push.svelte';
  import { toast } from '../lib/stores/toast.svelte';
  import Toggle from './Toggle.svelte';

  const account = $derived(accountStore.active);
  const needsScope = $derived(!!account && missingScopes(account.scopes).includes('push'));
  /** The mark on the app icon is not available everywhere (not on desktop Firefox, for one) */
  const hasBadge = typeof navigator !== 'undefined' && 'setAppBadge' in navigator;

  onMount(() => {
    const client = accountStore.client();
    if (client && !needsScope) void push.load(client);
  });

  function toggleMain(on: boolean) {
    const client = accountStore.client();
    if (!client || !account) return;
    if (on) void push.enable(client, account.key);
    else void push.disable(client);
  }
  const setAlert = (type: (typeof PUSH_TYPES)[number], on: boolean) => {
    const client = accountStore.client();
    if (client && account) void push.setAlert(client, account.key, type, on);
  };
  const setPolicy = (policy: PushPolicy) => {
    const client = accountStore.client();
    if (client && account) void push.setPolicy(client, account.key, policy);
  };
  const reauth = () => account && startLogin(account.instance).catch((e) => toast.show(e instanceof Error ? e.message : String(e)));
  const typeLabel = (type: string) => t(`push.type.${type}` as MessageKey);
</script>

<section>
  <h2>{t('push.title')}</h2>

  {#if !push.supported}
    <p class="hint">{t('push.unsupported')}</p>
  {:else if needsScope}
    <p class="hint">{t('push.reauth')}</p>
    <button class="action" onclick={reauth}>{t('profile.reauthButton')}</button>
  {:else if push.status === 'unavailable'}
    <p class="hint">{t('push.unavailable')}</p>
  {:else}
    <div class="row main">
      <span class="grow">{t('push.enable')}</span>
      <Toggle checked={push.status === 'on'} label={t('push.enable')} disabled={push.busy || push.status === 'unknown'} onchange={toggleMain} />
    </div>
    <p class="hint">{t('push.hint')}</p>
    {#if push.permission === 'denied'}
      <p class="hint warn">{t('push.denied')}</p>
    {/if}

    {#if push.status === 'on'}
      <label class="row">
        <span class="grow">{t('push.policy')}</span>
        <select value={account ? push.policy(account.key) : 'all'} onchange={(e) => setPolicy(e.currentTarget.value as PushPolicy)}>
          {#each PUSH_POLICIES as policy (policy)}
            <option value={policy}>{t(`push.policy.${policy}` as MessageKey)}</option>
          {/each}
        </select>
      </label>

      <div class="types" role="group" aria-label={t('push.types')}>
        <div class="row head">
          <span class="grow"></span>
          <span class="col">{t('push.notify')}</span>
          <span class="col">{t('push.sound')}</span>
        </div>
        {#each PUSH_TYPES as type (type)}
          <div class="row">
            <span class="grow">{typeLabel(type)}</span>
            <span class="col"><Toggle checked={push.alerts[type]} label={`${typeLabel(type)}: ${t('push.notify')}`} onchange={(on) => setAlert(type, on)} /></span>
            <span class="col"><Toggle checked={push.prefs.sound[type]} label={`${typeLabel(type)}: ${t('push.sound')}`} disabled={!push.alerts[type]} onchange={(on) => push.setSound(type, on)} /></span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if push.supported && hasBadge}
    <div class="row">
      <span class="grow">{t('push.badge')}</span>
      <Toggle checked={push.prefs.badge} label={t('push.badge')} onchange={(on) => push.setBadge(on)} />
    </div>
  {/if}

  {#if push.supported && !needsScope && push.status === 'on'}
    <button class="action" disabled={push.permission !== 'granted'} onclick={() => push.test(t('push.testTitle'), t('push.testBody'))}>{t('push.test')}</button>
  {/if}

  {#if push.error}
    <p class="hint warn" role="alert">{t('push.failed', { message: push.error })}</p>
  {/if}
</section>

<style>
  h2 { margin: 0 0 0.6rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .row { display: flex; align-items: center; gap: 0.75rem; min-height: 2.75rem; }
  .row.main { padding: 0.4rem 0.9rem; border-radius: 0.9rem; background: var(--surface); font-weight: 600; }
  .grow { flex: 1; min-width: 0; }
  .col { display: flex; justify-content: center; width: 4.5rem; }
  .head { min-height: 2rem; font-size: 0.75rem; font-weight: 700; color: var(--muted); text-align: center; }
  .types { margin-top: 0.6rem; }
  .hint { margin: 0.5rem 0.2rem; color: var(--muted); font-size: 0.85rem; }
  .hint.warn { color: var(--danger); }
  select { min-height: 2.5rem; border: 1px solid var(--border); border-radius: 0.6rem; background-color: var(--surface); color: var(--text); padding-left: 0.6rem; font: inherit; }
  .action { margin-top: 0.8rem; min-height: 2.75rem; padding: 0 1rem; border: 1px solid var(--border); border-radius: 0.7rem; background: var(--surface); color: var(--text); font-weight: 600; }
  .action:disabled { opacity: 0.5; }
</style>
