<script lang="ts">
  import { tick } from 'svelte';
  import { closesTrick, opensHand, renderHandHead, renderLine } from '../format';
  import { i18n } from '../i18n.svelte';
  import { ui } from '../state.svelte';
  let el = $state<HTMLDivElement>();
  $effect(() => { void ui.log.length; tick().then(() => { if (el) el.scrollTop = el.scrollHeight; }); });
</script>

<!-- cada mão abre com um cabeçalho (número, valor, quem carteia) e cada vaza fechada deixa um traço -->
<div class="ss-logs tm-log" data-size-variant="lg" aria-live="polite">
  <div class="viewport">
    <div class="scroll" bind:this={el}>
      {#each ui.log as l, i (i)}
        {@const r = renderLine(i18n.lang, l)}
        {#if opensHand(l)}<div class="ln tm-log-head">{renderHandHead(i18n.lang, l)}</div>{/if}
        <div class="ln"><span class="t">{r.tag}</span><span class="msg">{r.text}{#if r.hint}<span class="tm-log-hint">{r.hint}</span>{/if}</span></div>
        {#if closesTrick(l)}<hr class="tm-log-sep" />{/if}
      {/each}
    </div>
  </div>
</div>
