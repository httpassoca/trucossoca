<script lang="ts">
  import { ui } from '../state.svelte';
  import Keys from './Keys.svelte';
  import Log from './Log.svelte';
  import Menu from './Menu.svelte';
  import Prompt from './Prompt.svelte';
  import Score from './Score.svelte';
  import Seats from './Seats.svelte';
</script>

<div id="hud">
  <Score />
  <Seats />
  <Prompt />
  <Keys />
  <Log />
  {#if !ui.menuOpen}<div class="tm-crosshair"></div>{/if}
  <Menu />
</div>
