<script lang="ts">
  import { Canvas } from '@threlte/core';
  import * as THREE from 'three';
  import World from './World.svelte';
</script>

<div class="tm-gl">
  <Canvas shadows toneMapping={THREE.NoToneMapping}>
    <World />
  </Canvas>
</div>
