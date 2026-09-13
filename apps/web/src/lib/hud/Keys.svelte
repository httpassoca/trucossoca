<script lang="ts">
  import { canCycleSeats, mayRaise, myTurn } from '../controller';
  import { callName } from '../format';
  import { t } from '../i18n.svelte';
  import { live, ui } from '../state.svelte';
  import Kbd from './Kbd.svelte';

  const snap = $derived(live.snap);
  const h = $derived(snap.game.hand);
  const mine = $derived(myTurn(snap, ui.view));
  const raiseLabel = $derived(h ? callName(snap.game.rules.ladder[h.ladderIdx + 1] ?? 12).toLowerCase() : '');
  const raisable = $derived(mayRaise(snap, ui.view));
  /** enquanto as cartas são dadas, as teclas de jogo esperam */
  const dealing = $derived(ui.dealing);
</script>

<div class="tm-keys">
  {#if !ui.locked && !ui.menuOpen}<span class="tm-k on"><Kbd keys={[t('kbd.click')]} /><span>{t('hud.clickToLook')}</span></span>{/if}
  {#if snap.seat === null}
    <span class="tm-k hot"><Kbd keys={['W', 'A', 'S', 'D']} /><span>{t('hud.walk')}</span></span>
    <span class="tm-k"><Kbd keys={[t('kbd.space')]} /><span>{t('hud.jump')}</span></span>
    <span class="tm-k"><Kbd keys={['Tab']} /><span>{t('hud.nextSeat')}</span></span>
    {#if ui.nearBotSeat >= 0}<span class="tm-k hot"><Kbd keys={[t('kbd.shift')]} /><span>{t('keys.sitBot')}</span></span>{/if}
  {:else if ui.standing}
    <span class="tm-k hot"><Kbd keys={['W', 'A', 'S', 'D']} /><span>{t('hud.walk')}</span></span>
    <span class="tm-k"><Kbd keys={[t('kbd.space')]} /><span>{t('hud.jump')}</span></span>
    <span class="tm-k" class:hot={ui.nearSeat}><Kbd keys={[t('kbd.shift')]} /><span>{t('hud.sit')}</span></span>
  {:else if dealing}
    <span class="tm-k"><span>{t('hud.dealing')}</span></span>
  {:else if mine}
    <span class="tm-k hot"><Kbd keys={['←', '→']} /><span>{t('hud.pick')}</span></span>
    <span class="tm-k hot"><Kbd keys={['↵']} /><span>{t('hud.play')}</span></span>
    <span class="tm-k"><Kbd keys={['1', '2', '3']} /><span>{t('hud.direct')}</span></span>
    {#if raisable}<span class="tm-k hot"><Kbd keys={['T']} /><span>{raiseLabel}</span></span>{/if}
    {#if snap.canCover}<span class="tm-k" class:on={snap.coverNext}><Kbd keys={['C']} /><span>{t('hud.cover', { on: snap.coverNext ? t('yes') : t('no') })}</span></span>{/if}
  {:else if raisable}
    <span class="tm-k"><Kbd keys={['T']} /><span>{t('hud.raise')}</span></span>
  {/if}
  {#if snap.seat !== null && !ui.standing}
    {#if !dealing}<span class="tm-k" class:on={ui.peek}><Kbd keys={[t('kbd.shift')]} /><span>{t('hud.peek')}</span></span>{/if}
    <span class="tm-k"><Kbd keys={[t('kbd.rightClick')]} /><span>{t('hud.zoom')}</span></span>
    <span class="tm-k"><Kbd keys={[t('kbd.space'), t('kbd.space')]} /><span>{t('hud.standUp')}</span></span>
    {#if canCycleSeats(snap)}<span class="tm-k"><Kbd keys={['Tab']} /><span>{t('hud.seat')}</span></span>{/if}
  {/if}
  <span class="tm-k"><Kbd keys={['Esc']} /><span>{t('hud.menu')}</span></span>
</div>
