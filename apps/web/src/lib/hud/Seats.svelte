<script lang="ts">
  import type { Seat } from '@truco/rules';
  import { setView } from '../controller';
  import { live, ui } from '../state.svelte';
</script>

<div class="ss-segmented tm-seats" role="radiogroup" aria-label="cadeira">
  {#each live.snap.seats as seat, s (s)}
    <button type="button" role="radio" class="segment" class:selected={ui.view === s} aria-checked={ui.view === s} onclick={() => setView(s as Seat)}>
      {seat.name}{#if seat.bot}<span class="tm-bot" title="bot">·bot</span>{:else if seat.botControlled}<span class="tm-bot" title="um bot joga por esta pessoa até ela voltar">·bot jogando</span>{/if}
    </button>
  {/each}
</div>
