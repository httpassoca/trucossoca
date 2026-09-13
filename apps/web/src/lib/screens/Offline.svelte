<script lang="ts">
  import { onMount } from 'svelte';
  import { newGame, onTableChange } from '../controller';
  import Hud from '../hud/Hud.svelte';
  import { onKey } from '../input';
  import Scene from '../scene/Scene.svelte';
  import { table } from '../state.svelte';

  // a mesa offline: motor e bots no navegador, sem servidor. Ao sair da tela os bots param de jogar sozinhos.
  onMount(() => {
    table.subscribe(onTableChange);
    newGame();
    return () => table.dispose();
  });
</script>

<svelte:window onkeydown={onKey} />

<Scene />
<Hud />
