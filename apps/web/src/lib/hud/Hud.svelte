<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ui } from '../state.svelte';
  import Keys from './Keys.svelte';
  import Log from './Log.svelte';
  import Menu from './Menu.svelte';
  import Prompt from './Prompt.svelte';
  import Score from './Score.svelte';

  /** `room`: a seção da sala no menu, quando há uma sala (online) */
  let { room }: { room?: Snippet } = $props();
</script>

<div id="hud">
  <Score />
  <Prompt />
  <Keys />
  <Log />
  {#if !ui.menuOpen}<div class="tm-crosshair"></div>{/if}
  <Menu {room} />
</div>
