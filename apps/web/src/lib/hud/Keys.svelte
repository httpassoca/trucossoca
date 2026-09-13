<script lang="ts">
  import { canRaise, coverAllowed } from '@truco/rules';
  import { humanControls } from '../controller';
  import { callName } from '../format';
  import { game, ui } from '../state.svelte';
  import Kbd from './Kbd.svelte';

  const h = $derived(game.hand);
  const myTurn = $derived(!!h && h.phase === 'play' && humanControls(ui.view) && h.turn === ui.view);
  const raiseLabel = $derived(h ? callName(game.rules.ladder[h.ladderIdx + 1] ?? 12).toLowerCase() : '');
  const mayRaise = $derived(!!h && humanControls(ui.view) && canRaise(game, ui.view));
  const mayCover = $derived(coverAllowed(game));
</script>

<div class="tm-keys">
  {#if !ui.locked && !ui.menuOpen}<span class="tm-k on"><Kbd keys={['clique']} /><span>na mesa para olhar com o mouse</span></span>{/if}
  {#if myTurn}
    <span class="tm-k hot"><Kbd keys={['←', '→']} /><span>escolher</span></span>
    <span class="tm-k hot"><Kbd keys={['↵']} /><span>jogar</span></span>
    <span class="tm-k"><Kbd keys={['1', '2', '3']} /><span>direto</span></span>
    {#if mayRaise}<span class="tm-k hot"><Kbd keys={['T']} /><span>{raiseLabel}</span></span>{/if}
    {#if mayCover}<span class="tm-k" class:on={ui.coverNext}><Kbd keys={['C']} /><span>coberta: {ui.coverNext ? 'sim' : 'não'}</span></span>{/if}
  {:else if mayRaise}
    <span class="tm-k"><Kbd keys={['T']} /><span>trucar</span></span>
  {/if}
  <span class="tm-k"><Kbd keys={['Tab']} /><span>cadeira</span></span>
  <span class="tm-k"><Kbd keys={['Esc']} /><span>menu</span></span>
</div>
