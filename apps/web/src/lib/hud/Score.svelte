<script lang="ts">
  import { teamOf, type Team } from '@truco/rules';
  import { t } from '../i18n.svelte';
  import { live, ui } from '../state.svelte';

  /**
   * O placar numa linha só, no alto e no centro: dupla 0 e pontos, as três vazas dela, o valor da mão (ou a mão especial,
   * ou "sua vez"), as três vazas da dupla 1, pontos e nome. A seta marca a dupla de quem age. O resto a cena e o log contam.
   */
  const snap = $derived(live.snap);
  const game = $derived(snap.game);
  const h = $derived(game.hand);
  /** a dupla de quem a mesa espera algo agora */
  const actingTeam = $derived<Team | null>(snap.acting === -1 ? null : teamOf(snap.acting));
  const mine = $derived(snap.seat !== null && snap.acting === snap.seat);

  type Pip = 'won' | 'lost' | 'tie' | 'pending';
  const GLYPH: Record<Pip, string> = { won: '●', lost: '○', tie: '◐', pending: '' };
  /** as três vazas da mão como a dupla `team` as viu: ganha, perdida, empatada ou ainda por jogar */
  function pips(team: Team): Pip[] {
    const results = h?.results ?? [];
    return [0, 1, 2].map((k) => (k >= results.length ? 'pending' : results[k] === null ? 'tie' : results[k] === team ? 'won' : 'lost'));
  }
  const chip = $derived.by(() => {
    if (game.over) return { text: t('score.gameOver'), kind: 'over' };
    if (!h) return null;
    if (ui.dealing) return { text: t('hud.dealing'), kind: 'value' };
    if (mine) return { text: t('score.yourTurn'), kind: 'mine' };
    if (h.special === 'dez') return { text: t('score.dez'), kind: 'special', icon: '◆', title: t('badge.dez') };
    if (h.special === 'ferro') return { text: t('score.ferro'), kind: 'special', icon: '▲', title: t('badge.ferro') };
    return { text: t('score.vale', { value: h.value }), kind: 'value' };
  });
  const actingName = $derived(snap.acting === -1 ? '' : t('score.acting', { name: snap.seats[snap.acting].name }));
</script>

{#snippet trickPips(team: Team)}
  <span class="tm-pips">
    {#each pips(team) as p, k (k)}<span class="tm-pip {p}" role="img" aria-label={t(`score.pip.${p}`)}>{GLYPH[p]}</span>{/each}
  </span>
{/snippet}

<div class="ss-card tm-score" role="status" aria-label={t('score.label')}>
  <span class="tm-team" class:acting={actingTeam === 0} title={actingTeam === 0 ? actingName : ''}>
    <span class="tm-turn" aria-hidden="true">{actingTeam === 0 ? '▶' : ''}</span>
    <span class="tm-name">{snap.teams[0]}</span>
    <span class="tm-pts">{game.scores[0]}</span>
  </span>
  {@render trickPips(0)}
  {#if chip}<span class="tm-chip {chip.kind}" title={chip.title ?? ''}>{#if chip.icon}<span class="tm-ico" aria-hidden="true">{chip.icon}</span>{/if}{chip.text}</span>{/if}
  {@render trickPips(1)}
  <span class="tm-team right" class:acting={actingTeam === 1} title={actingTeam === 1 ? actingName : ''}>
    <span class="tm-pts">{game.scores[1]}</span>
    <span class="tm-name">{snap.teams[1]}</span>
    <span class="tm-turn" aria-hidden="true">{actingTeam === 1 ? '◀' : ''}</span>
  </span>
  {#if snap.seat === null}<span class="ss-badge neutral">{t('badge.ghost')}</span>{/if}
  {#if snap.seat !== null && snap.seats[snap.seat].botControlled}<span class="ss-badge caution" title={t('badge.botForYou.title')}>{t('badge.botForYou')}</span>{/if}
</div>
