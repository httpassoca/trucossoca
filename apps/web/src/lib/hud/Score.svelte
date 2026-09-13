<script lang="ts">
  import { live, ui } from '../state.svelte';
  import { callName } from '../format';

  const snap = $derived(live.snap);
  const game = $derived(snap.game);
  const h = $derived(game.hand);
  const names = $derived(snap.seats.map((s) => s.name));
  const meta = $derived(h ? `mão vale ${h.value} · vaza ${Math.min(h.played.length, 3)} · mão de ${names[game.mao]}` : '');
  const turn = $derived.by(() => {
    if (!h) return '';
    if (game.over) return 'Fim de jogo.';
    if (h.phase === 'over') return 'Mão encerrada.';
    if (h.phase === 'respond') return `${snap.acting === -1 ? '…' : names[snap.acting]} responde ao ${callName(h.pending!.to)}`;
    if (h.phase === 'dezDecision') return `${snap.teams[h.decider!]} decide se joga.`;
    return h.turn === snap.seat ? 'Sua vez.' : `Vez de ${names[h.turn]}.`;
  });
</script>

<div class="ss-card tm-score">
  <div class="head"><span class="title">placar</span><span class="meta">{meta}</span></div>
  <div class="body tm-metrics">
    <div class="ss-metric"><span class="label">{snap.teams[0]}</span><span class="val">{game.scores[0]}</span></div>
    <div class="ss-metric"><span class="label">{snap.teams[1]}</span><span class="val">{game.scores[1]}</span></div>
  </div>
  <div class="foot">
    <span>{turn}</span>
    {#if snap.seat === null}<span class="ss-badge neutral">fantasma</span>{/if}
    {#if snap.seat !== null && snap.seats[snap.seat].botControlled}<span class="ss-badge caution" title="você ficou parada e alguém passou a cadeira a um bot; qualquer jogada sua a retoma">bot joga por você · jogue para retomar</span>{/if}
    {#if h && h.special !== 'normal'}<span class="ss-badge caution">{h.special === 'dez' ? 'mão de dez' : 'mão de ferro'}</span>{/if}
  </div>
</div>
