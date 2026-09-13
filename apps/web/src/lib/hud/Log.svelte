<script lang="ts">
  import { tick } from 'svelte';
  import { ui } from '../state.svelte';
  let el = $state<HTMLDivElement>();
  $effect(() => { void ui.log.length; tick().then(() => { if (el) el.scrollTop = el.scrollHeight; }); });
</script>

<div class="ss-logs tm-log" aria-live="polite">
  <div class="viewport">
    <div class="scroll" bind:this={el}>
      {#each ui.log as l}
        <div class="ln"><span class="t">{l.tag}</span><span class="msg">{l.text}</span></div>
      {/each}
    </div>
  </div>
</div>
