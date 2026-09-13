<script lang="ts">
  import { live, NAMES, TEAMS, ui } from '../state.svelte';
  import { callName } from '../format';

  const snap = $derived(live.snap);
  const game = $derived(snap.game);
  const h = $derived(game.hand);
  const meta = $derived(h ? `mão vale ${h.value} · vaza ${Math.min(h.played.length, 3)} · mão de ${NAMES[game.mao].toLowerCase()}` : '');
  const turn = $derived.by(() => {
    if (!h) return '';
    if (game.over) return 'Fim de jogo.';
    if (h.phase === 'over') return 'Mão encerrada.';
    if (h.phase === 'respond') return `${snap.acting === -1 ? '…' : NAMES[snap.acting]} responde ao ${callName(h.pending!.to)}`;
    if (h.phase === 'dezDecision') return `${TEAMS[h.decider!]} decide se joga.`;
    return h.turn === ui.view ? 'Sua vez.' : `Vez de ${NAMES[h.turn]}.`;
  });
</script>

<div class="ss-card tm-score">
  <div class="head"><span class="title">placar</span><span class="meta">{meta}</span></div>
  <div class="body tm-metrics">
    <div class="ss-metric"><span class="label">nós</span><span class="val">{game.scores[0]}</span></div>
    <div class="ss-metric"><span class="label">eles</span><span class="val">{game.scores[1]}</span></div>
  </div>
  <div class="foot">
    <span>{turn}</span>
    {#if h && h.special !== 'normal'}<span class="ss-badge caution">{h.special === 'dez' ? 'mão de dez' : 'mão de ferro'}</span>{/if}
  </div>
</div>
