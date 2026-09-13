<script lang="ts">
  import { promptAct, promptOf } from '../controller';
  import { callName } from '../format';
  import { live } from '../state.svelte';
  import Kbd from './Kbd.svelte';

  const snap = $derived(live.snap);
  const game = $derived(snap.game);
  const p = $derived(promptOf(snap));
  const q = $derived(game.hand?.pending ?? null);
  const more = $derived(q && q.toIdx + 1 < game.rules.ladder.length ? callName(game.rules.ladder[q.toIdx + 1]).replace('!', '') : null);
</script>

{#if p}
  <div class="ss-card elevated tm-prompt">
    <div class="body">
      {#if p.kind === 'respond' && q}
        <h3 class="tm-title">{snap.seats[q.by].name}: {callName(q.to)}</h3>
        <p class="tm-text">A mão passa a valer {q.to}. Correr entrega {q.from}.</p>
        <div class="tm-row">
          <button class="ss-btn primary" type="button" onclick={() => promptAct('accept')}>Aceitar <Kbd keys={['↵']} /></button>
          <button class="ss-btn" type="button" onclick={() => promptAct('decline')}>Correr <Kbd keys={['X']} /></button>
          {#if more}<button class="ss-btn danger" type="button" onclick={() => promptAct('raise')}>Pedir {more} <Kbd keys={['R']} /></button>{/if}
        </div>
      {:else if p.kind === 'dez'}
        <h3 class="tm-title">Mão de dez</h3>
        <p class="tm-text">{game.rules.maoDeDezPeek ? 'As cartas do parceiro estão viradas para você. ' : ''}Jogar vale {game.hand?.value}; correr entrega 2.</p>
        <div class="tm-row">
          <button class="ss-btn primary" type="button" onclick={() => promptAct('play')}>Jogar <Kbd keys={['↵']} /></button>
          <button class="ss-btn" type="button" onclick={() => promptAct('run')}>Correr <Kbd keys={['X']} /></button>
        </div>
      {:else if p.kind === 'over'}
        <h3 class="tm-title">Fim de jogo: {snap.teams[game.winner!]}</h3>
        <p class="tm-text">{game.scores[0]} × {game.scores[1]}</p>
        {#if snap.canRestart}<div class="tm-row"><button class="ss-btn primary" type="button" onclick={() => promptAct('new')}>Nova partida <Kbd keys={['↵']} /></button></div>{/if}
      {/if}
    </div>
  </div>
{/if}
