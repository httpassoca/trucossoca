<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import type { Seat } from '@truco/rules';
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { bus, myTurn } from '../controller';
  import { installPointerLock } from '../input';
  import { live, NAMES, ui } from '../state.svelte';
  import { buildCards, makeCharacter, PRESETS, sayTo, seatDir, TABLE_R, TABLE_TOP, type Character } from './builders';
  import { BASE_PITCH, CAM_DIST, CAM_H, look } from './camera';
  import { aimHead } from './gaze';
  import { layoutCards } from './layout';
  import { seatAngle } from './builders';

  const { scene, canvas } = useThrelte();
  scene.background = new THREE.Color(0x232323);
  scene.fog = new THREE.Fog(0x232323, 4, 11);

  const cards = buildCards();
  const chars: Character[] = PRESETS.map((p, s) => makeCharacter(s as Seat, p, NAMES[s]));
  const cardList = Object.values(cards);

  let camera = $state<THREE.PerspectiveCamera>();
  const camTarget = new THREE.Vector3();
  const clock = new THREE.Clock();

  bus.say = (seat, text) => sayTo(chars[seat], text);

  onMount(() => installPointerLock(canvas));

  // relayout sempre que a mesa muda de snapshot (ou a cadeira/carta escolhida)
  $effect(() => { const s = live.snap; layoutCards(s.game, { view: ui.view, sel: ui.sel, myTurn: myTurn(s, ui.view) }, cards); });

  useTask(() => {
    const now = performance.now(), t = clock.getElapsedTime();
    for (const g of cardList) {
      g.position.lerp(g.userData.tp, 0.12); g.quaternion.slerp(g.userData.tq, 0.12);
      if (Math.abs(g.userData.b - g.userData.tb) > 0.002) {
        g.userData.b += (g.userData.tb - g.userData.b) * 0.06;
        for (const m of g.children as THREE.Mesh[]) (m.material as THREE.MeshLambertMaterial).color.setScalar(g.userData.b);
      }
    }
    const cam = camera; if (!cam) return;
    camTarget.copy(seatDir(ui.view).multiplyScalar(CAM_DIST)).setY(CAM_H);
    cam.position.lerp(camTarget, 0.1);
    look.yaw += (look.tyaw - look.yaw) * 0.25; look.pitch += (look.tpitch - look.pitch) * 0.25;
    cam.rotation.set(BASE_PITCH + look.pitch, seatAngle(ui.view) + look.yaw, 0, 'YXZ');

    const snap = live.snap, acting = snap.acting;
    const ctx = { game: snap.game, view: ui.view, camera: cam, chars, cards, lastPlay: bus.lastPlay, acting };
    chars.forEach((c, i) => {
      c.head.visible = c.seat !== ui.view;
      c.label.visible = c.seat !== ui.view && c.seat !== acting;
      c.labelOn.visible = c.seat !== ui.view && c.seat === acting;
      c.head.position.y = 1.35 + Math.sin(t * 1.3 + i) * 0.006;
      aimHead(c, now, t, ctx);
      c.torso.scale.y = 1 + Math.sin(t * 1.3 + i) * 0.008;
      c.mouth.scale.y = now < c.mouthUntil ? 3.5 + Math.sin(now / 60) * 1.5 : 1;
      if (c.bubble.visible && now > c.bubbleUntil) c.bubble.visible = false;
    });
  });
</script>

<T.PerspectiveCamera makeDefault fov={62} near={0.05} far={50} bind:ref={camera}
  position={[0, CAM_H, CAM_DIST]} rotation={[BASE_PITCH, 0, 0, 'YXZ']} />

<T.HemisphereLight args={[0x8a8a8a, 0x1a1a1a, 0.55]} />
<T.DirectionalLight position={[2.5, 5, 1.5]} intensity={0.45} castShadow
  oncreate={(l) => { l.shadow.mapSize.set(2048, 2048); const c = l.shadow.camera; c.left = c.bottom = -4; c.right = c.top = 4; c.updateProjectionMatrix(); }} />
<T.PointLight position={[0, 2.3, 0]} color={0xffe7c2} intensity={1.4} distance={6.5} decay={1.4} />

<!-- chão + mesa (cenário cinza estático) -->
<T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
  <T.PlaneGeometry args={[30, 30]} />
  <T.MeshLambertMaterial color={0x2e2e2e} />
</T.Mesh>
<T.Mesh position.y={TABLE_TOP - 0.04} castShadow receiveShadow>
  <T.CylinderGeometry args={[TABLE_R, TABLE_R, 0.08, 48]} />
  <T.MeshLambertMaterial color={0x5d6b5f} />
</T.Mesh>
<T.Mesh position.y={TABLE_TOP - 0.02} rotation.x={Math.PI / 2}>
  <T.TorusGeometry args={[TABLE_R, 0.035, 8, 48]} />
  <T.MeshLambertMaterial color={0x555049} />
</T.Mesh>
<T.Mesh position.y={0.34} castShadow>
  <T.CylinderGeometry args={[0.12, 0.35, 0.68, 12]} />
  <T.MeshLambertMaterial color={0x4a4a4a} />
</T.Mesh>

{#each chars as c (c.seat)}
  <T is={c.g} />
{/each}
{#each cardList as g (g.userData.id)}
  <T is={g} />
{/each}
