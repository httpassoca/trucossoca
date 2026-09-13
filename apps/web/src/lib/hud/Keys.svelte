<script lang="ts">
  import { mayRaise, myTurn } from '../controller';
  import { callName } from '../format';
  import { t } from '../i18n.svelte';
  import { live, ui } from '../state.svelte';
  import Kbd from './Kbd.svelte';

  const snap = $derived(live.snap);
  const h = $derived(snap.game.hand);
  const mine = $derived(myTurn(snap, ui.view));
  const raiseLabel = $derived(h ? callName(snap.game.rules.ladder[h.ladderIdx + 1] ?? 12).toLowerCase() : '');
  const raisable = $derived(mayRaise(snap, ui.view));
</script>

<div class="tm-keys">
  {#if !ui.locked && !ui.menuOpen}<span class="tm-k on"><Kbd keys={[t('kbd.click')]} /><span>{t('hud.clickToLook')}</span></span>{/if}
  {#if snap.seat === null}
    <span class="tm-k hot"><Kbd keys={['W', 'A', 'S', 'D']} /><span>{t('hud.walk')}</span></span>
    <span class="tm-k"><Kbd keys={['Tab']} /><span>{t('hud.nextSeat')}</span></span>
  {:else if mine}
    <span class="tm-k hot"><Kbd keys={['←', '→']} /><span>{t('hud.pick')}</span></span>
    <span class="tm-k hot"><Kbd keys={['↵']} /><span>{t('hud.play')}</span></span>
    <span class="tm-k"><Kbd keys={['1', '2', '3']} /><span>{t('hud.direct')}</span></span>
    {#if raisable}<span class="tm-k hot"><Kbd keys={['T']} /><span>{raiseLabel}</span></span>{/if}
    {#if snap.canCover}<span class="tm-k" class:on={snap.coverNext}><Kbd keys={['C']} /><span>{t('hud.cover', { on: snap.coverNext ? t('yes') : t('no') })}</span></span>{/if}
  {:else if raisable}
    <span class="tm-k"><Kbd keys={['T']} /><span>{t('hud.raise')}</span></span>
  {/if}
  {#if snap.seat !== null}<span class="tm-k"><Kbd keys={['Tab']} /><span>{t('hud.seat')}</span></span>{/if}
  <span class="tm-k"><Kbd keys={['Esc']} /><span>{t('hud.menu')}</span></span>
</div>
