<script lang="ts">
  import type { Seat } from '@truco/rules';
  import { setView } from '../controller';
  import { NAMES, ui } from '../state.svelte';
</script>

<div class="ss-segmented tm-seats" role="radiogroup" aria-label="cadeira">
  {#each NAMES as name, s}
    <button type="button" role="radio" class="segment" class:selected={ui.view === s} aria-checked={ui.view === s} onclick={() => setView(s as Seat)}>{name}</button>
  {/each}
</div>
