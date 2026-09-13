<script lang="ts">
  import { Canvas } from '@threlte/core';
  import * as THREE from 'three';
  import World from './World.svelte';
</script>

<div class="tm-gl">
  <!-- sombras suaves e ACES: os cenários foram desenhados para esta luz (ADR 0007) -->
  <Canvas shadows={THREE.PCFSoftShadowMap} toneMapping={THREE.ACESFilmicToneMapping}>
    <World />
  </Canvas>
</div>
