<script lang="ts">
  import LangSwitch from '../hud/LangSwitch.svelte';
  import { t } from '../i18n.svelte';
  import { openRoom } from '../rooms';
  import { navigate, roomPath } from '../route.svelte';

  let code = $state('');
  let opening = $state(false);
  let failed = $state(false);

  async function open() {
    opening = true; failed = false;
    try { await openRoom(); } catch { failed = true; } finally { opening = false; }
  }
  function enter(e: SubmitEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) navigate(roomPath(c));
  }
</script>

<div class="tm-screen">
  <div class="ss-card elevated tm-panel">
    <div class="head">
      <div class="heading"><span class="title">truco mineiro</span><span class="desc">{t('home.tagline')}</span></div>
      <LangSwitch />
    </div>
    <div class="body">
      <button class="ss-btn primary" type="button" onclick={open} disabled={opening}>{opening ? t('home.opening') : t('home.open')}</button>
      <form class="tm-form" onsubmit={enter}>
        <label class="ss-field">
          <span class="lbl">{t('home.enterCode')}</span>
          <span class="control"><input class="ss-input tm-code-input" bind:value={code} placeholder="ABCD" maxlength="8" autocapitalize="characters" spellcheck="false" /></span>
        </label>
        <button class="ss-btn" type="submit" disabled={!code.trim()}>{t('home.enter')}</button>
      </form>
      {#if failed}<p class="tm-error">{t('home.openFailed')}</p>{/if}
      <button class="ss-btn ghost" type="button" onclick={() => navigate('/offline')}>{t('home.offline')}</button>
    </div>
  </div>
</div>
