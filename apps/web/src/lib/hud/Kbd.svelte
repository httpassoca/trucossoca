<script lang="ts">
  import { t } from '../i18n.svelte';
  let { keys, or = false }: { keys: string[]; or?: boolean } = $props();
</script>

<span class="ss-kbd">
  {#each keys as k, i}
    {#if i > 0 && or}<span class="or">{t('kbd.or')}</span>{/if}<span class="key">{k}</span>
  {/each}
</span>
