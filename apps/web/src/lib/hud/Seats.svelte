<script lang="ts">
  import type { Seat } from '@truco/rules';
  import { setView } from '../controller';
  import { t } from '../i18n.svelte';
  import { live, ui } from '../state.svelte';
</script>

<div class="ss-segmented tm-seats" role="radiogroup" aria-label={t('seats.label')}>
  {#each live.snap.seats as seat, s (s)}
    <button type="button" role="radio" class="segment" class:selected={ui.view === s} aria-checked={ui.view === s} onclick={() => setView(s as Seat)}>
      {seat.name}{#if seat.bot}<span class="tm-bot" title={t('badge.bot')}>{t('seats.bot')}</span>{:else if seat.botControlled}<span class="tm-bot" title={t('badge.botPlaying.title')}>{t('seats.botPlaying')}</span>{/if}
    </button>
  {/each}
</div>
