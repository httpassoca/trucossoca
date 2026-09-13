<script lang="ts">
  import { onMount } from 'svelte';
  import { newGame } from './lib/controller';
  import Hud from './lib/hud/Hud.svelte';
  import { onKey } from './lib/input';
  import Scene from './lib/scene/Scene.svelte';

  onMount(() => { newGame(); });
</script>

<svelte:window onkeydown={onKey} />

<Scene />
<Hud />
