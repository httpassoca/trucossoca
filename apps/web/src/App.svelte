<script lang="ts">
  import { route } from './lib/route.svelte';
  import Home from './lib/screens/Home.svelte';
  import Offline from './lib/screens/Offline.svelte';
  import Room from './lib/screens/Room.svelte';
</script>

{#if route.current.name === 'room'}
  {#key route.current.code}<Room code={route.current.code} />{/key}
{:else if route.current.name === 'offline'}
  <Offline />
{:else}
  <Home />
{/if}
