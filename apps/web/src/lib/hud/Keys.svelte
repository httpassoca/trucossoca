<script lang="ts">
  import { mayRaise, myTurn } from '../controller';
  import { callName } from '../format';
  import { live, ui } from '../state.svelte';
  import Kbd from './Kbd.svelte';

  const snap = $derived(live.snap);
  const h = $derived(snap.game.hand);
  const mine = $derived(myTurn(snap, ui.view));
  const raiseLabel = $derived(h ? callName(snap.game.rules.ladder[h.ladderIdx + 1] ?? 12).toLowerCase() : '');
  const raisable = $derived(mayRaise(snap, ui.view));
</script>

<div class="tm-keys">
  {#if !ui.locked && !ui.menuOpen}<span class="tm-k on"><Kbd keys={['clique']} /><span>na mesa para olhar com o mouse</span></span>{/if}
  {#if snap.seat === null}
    <span class="tm-k hot"><Kbd keys={['W', 'A', 'S', 'D']} /><span>andar</span></span>
    <span class="tm-k"><Kbd keys={['Tab']} /><span>atrás da próxima cadeira</span></span>
  {:else if mine}
    <span class="tm-k hot"><Kbd keys={['←', '→']} /><span>escolher</span></span>
    <span class="tm-k hot"><Kbd keys={['↵']} /><span>jogar</span></span>
    <span class="tm-k"><Kbd keys={['1', '2', '3']} /><span>direto</span></span>
    {#if raisable}<span class="tm-k hot"><Kbd keys={['T']} /><span>{raiseLabel}</span></span>{/if}
    {#if snap.canCover}<span class="tm-k" class:on={snap.coverNext}><Kbd keys={['C']} /><span>coberta: {snap.coverNext ? 'sim' : 'não'}</span></span>{/if}
  {:else if raisable}
    <span class="tm-k"><Kbd keys={['T']} /><span>trucar</span></span>
  {/if}
  {#if snap.seat !== null}<span class="tm-k"><Kbd keys={['Tab']} /><span>cadeira</span></span>{/if}
  <span class="tm-k"><Kbd keys={['Esc']} /><span>menu</span></span>
</div>
