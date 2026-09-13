<script lang="ts">
  import { openRoom } from '../rooms';
  import { navigate, roomPath } from '../route.svelte';

  let code = $state('');
  let opening = $state(false);
  let error = $state('');

  async function open() {
    opening = true; error = '';
    try { await openRoom(); } catch { error = 'Não deu para abrir a sala. O servidor está fora do ar?'; } finally { opening = false; }
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
      <div class="heading"><span class="title">truco mineiro</span><span class="desc">mesa 3D · dois contra dois · com amigos ou contra bots</span></div>
    </div>
    <div class="body">
      <button class="ss-btn primary" type="button" onclick={open} disabled={opening}>{opening ? 'Abrindo…' : 'Abrir uma sala'}</button>
      <form class="tm-form" onsubmit={enter}>
        <label class="ss-field">
          <span class="lbl">Entrar com código</span>
          <span class="control"><input class="ss-input tm-code-input" bind:value={code} placeholder="ABCD" maxlength="8" autocapitalize="characters" spellcheck="false" /></span>
        </label>
        <button class="ss-btn" type="submit" disabled={!code.trim()}>Entrar</button>
      </form>
      {#if error}<p class="tm-error">{error}</p>{/if}
      <button class="ss-btn ghost" type="button" onclick={() => navigate('/offline')}>Jogar offline contra bots</button>
    </div>
  </div>
</div>
