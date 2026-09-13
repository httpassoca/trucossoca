<script lang="ts">
  import { tick } from 'svelte';
  import { renderLine } from '../format';
  import { i18n } from '../i18n.svelte';
  import { ui } from '../state.svelte';
  let el = $state<HTMLDivElement>();
  $effect(() => { void ui.log.length; tick().then(() => { if (el) el.scrollTop = el.scrollHeight; }); });
</script>

<div class="ss-logs tm-log" aria-live="polite">
  <div class="viewport">
    <div class="scroll" bind:this={el}>
      {#each ui.log as l}
        {@const r = renderLine(i18n.lang, l)}
        <div class="ln"><span class="t">{r.tag}</span><span class="msg">{r.text}{#if r.hint}<span class="tm-log-hint">{r.hint}</span>{/if}</span></div>
      {/each}
    </div>
  </div>
</div>
