<script lang="ts">
  import LangSwitch from '../hud/LangSwitch.svelte';
  import RulesPanel from '../hud/RulesPanel.svelte';
  import { t } from '../i18n.svelte';
  import { rememberedScenery, rememberScenery } from '../identity';
  import { openRoom } from '../rooms';
  import { navigate, roomPath } from '../route.svelte';
  import { setRules, ui } from '../state.svelte';

  /** O início: à esquerda os caminhos (abrir sala, entrar, offline, assistir); à direita as regras e o cenário, que valem para todos eles. */
  let code = $state('');
  let opening = $state(false);
  let failed = $state(false);
  let scenery = $state(rememberedScenery());

  async function open() {
    opening = true; failed = false;
    try { await openRoom({ rules: $state.snapshot(ui.rules), scenery }); } catch { failed = true; } finally { opening = false; }
  }
  function enter(e: SubmitEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) navigate(roomPath(c));
  }
</script>

<div class="tm-screen">
  <div class="ss-card elevated tm-panel tm-home">
    <div class="body tm-home-cols">
      <div class="tm-home-col">
        <div class="tm-home-title">
          <h1 class="tm-brand">truco mineiro</h1>
          <p class="tm-tagline">{t('home.tagline')}</p>
          <LangSwitch />
        </div>
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
        <button class="ss-btn ghost" type="button" onclick={() => navigate('/offline/assistir')}>{t('home.watch')}</button>
      </div>
      <div class="tm-home-col tm-section">
        <h4>{t('home.rules')} <span style="text-transform:none;letter-spacing:0">{t('home.rules.sub')}</span></h4>
        <RulesPanel rules={ui.rules} onchange={setRules} {scenery} onscenery={(s) => { scenery = s; rememberScenery(s); }} />
      </div>
    </div>
  </div>
</div>
