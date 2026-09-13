<script lang="ts">
  import { onMount } from 'svelte';
  import { attachTable } from '../controller';
  import Hud from '../hud/Hud.svelte';
  import { onKey } from '../input';
  import Scene from '../scene/Scene.svelte';
  import type { Table } from '../table/table';

  /** A mesa 3D com o HUD, atrás de qualquer `Table` (ADR 0003). `menuOpen`: abre com o menu na frente ou direto na mesa. */
  let { table, menuOpen = true }: { table: Table; menuOpen?: boolean } = $props();

  onMount(() => attachTable(table, { menuOpen }));
</script>

<svelte:window onkeydown={onKey} />

<Scene />
<Hud />
