<script lang="ts">
  import { callName } from '../format';
  import { t } from '../i18n.svelte';
  import { live } from '../state.svelte';

  const snap = $derived(live.snap);
  const game = $derived(snap.game);
  const h = $derived(game.hand);
  const names = $derived(snap.seats.map((s) => s.name));
  const meta = $derived(h ? t('score.meta', { value: h.value, trick: Math.min(h.played.length, 3), name: names[game.mao] }) : '');
  const turn = $derived.by(() => {
    if (!h) return '';
    if (game.over) return t('score.gameOver');
    if (h.phase === 'over') return t('score.handOver');
    if (h.phase === 'respond') return t('score.responds', { name: snap.acting === -1 ? '…' : names[snap.acting], call: callName(h.pending!.to) });
    if (h.phase === 'dezDecision') return t('score.decides', { team: snap.teams[h.decider!] });
    return h.turn === snap.seat ? t('score.yourTurn') : t('score.turnOf', { name: names[h.turn] });
  });
</script>

<div class="ss-card tm-score">
  <div class="head"><span class="title">{t('score.title')}</span><span class="meta">{meta}</span></div>
  <div class="body tm-metrics">
    <div class="ss-metric"><span class="label">{snap.teams[0]}</span><span class="val">{game.scores[0]}</span></div>
    <div class="ss-metric"><span class="label">{snap.teams[1]}</span><span class="val">{game.scores[1]}</span></div>
  </div>
  <div class="foot">
    <span>{turn}</span>
    {#if snap.seat === null}<span class="ss-badge neutral">{t('badge.ghost')}</span>{/if}
    {#if snap.seat !== null && snap.seats[snap.seat].botControlled}<span class="ss-badge caution" title={t('badge.botForYou.title')}>{t('badge.botForYou')}</span>{/if}
    {#if h && h.special !== 'normal'}<span class="ss-badge caution">{h.special === 'dez' ? t('badge.dez') : t('badge.ferro')}</span>{/if}
  </div>
</div>
