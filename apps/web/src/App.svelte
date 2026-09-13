<script lang="ts">
  import { onMount } from 'svelte';
  import { newGame, onTableChange } from './lib/controller';
  import Hud from './lib/hud/Hud.svelte';
  import { onKey } from './lib/input';
  import Scene from './lib/scene/Scene.svelte';
  import { table } from './lib/state.svelte';

  onMount(() => {
    const off = table.subscribe(onTableChange);
    newGame();
    return off;
  });
</script>

<svelte:window onkeydown={onKey} />

<Scene />
<Hud />
