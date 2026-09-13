<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import type { Seat } from '@truco/rules';
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { bus, myTurn } from '../controller';
  import { installPointerLock } from '../input';
  import { live, ui } from '../state.svelte';
  import { PRESENCE_INTERVAL, type Presence } from '../table/table';
  import { buildCards, disposeGhost, makeCharacter, makeGhost, nameCharacter, nameGhost, PRESETS, sayTo, seatAngle, seatDir, TABLE_R, TABLE_TOP, type Character, type Ghost } from './builders';
  import { angleDelta, BASE_PITCH, CAM_DIST, CAM_H, GHOST_EYE, look, spawnSeat, standSpot, stepWalk, walk } from './camera';
  import { aimHead, aimHeadPresence } from './gaze';
  import { layoutCards } from './layout';

  const { scene, canvas } = useThrelte();
  scene.background = new THREE.Color(0x232323);
  scene.fog = new THREE.Fog(0x232323, 4, 11);

  const cards = buildCards();
  const chars: Character[] = PRESETS.map((p, s) => makeCharacter(s as Seat, p, live.snap.seats[s].name));
  const cardList = Object.values(cards);

  /** os outros fantasmas, um vulto por membro sem cadeira; seguem a presença que mandam (ou ficam parados onde nasceram) */
  let ghosts = $state.raw<Ghost[]>([]);

  let camera = $state<THREE.PerspectiveCamera>();
  const camTarget = new THREE.Vector3();
  const clock = new THREE.Clock();
  /** a própria presença: a última mandada e quando; sai no máximo dez vezes por segundo, e só quando muda */
  let lastPresence: Presence | null = null, lastPresenceAt = 0;

  bus.say = (seat, text) => sayTo(chars[seat], text);

  onMount(() => installPointerLock(canvas));

  // relayout sempre que a mesa muda de snapshot (ou a cadeira/carta escolhida); nomes sobre as cabeças seguem quem senta
  $effect(() => { const s = live.snap; layoutCards(s.game, { view: ui.view, sel: ui.sel, myTurn: myTurn(s, ui.view) }, cards); });
  $effect(() => { live.snap.seats.forEach((seat, s) => nameCharacter(chars[s], seat.name)); });
  // um vulto por fantasma: nasce de pé atrás de uma cadeira (a i-ésima) até a presença dele chegar; some com quem sai
  $effect(() => {
    const list = live.snap.ghosts;
    const kept = ghosts.filter((gh) => list.some((m) => m.id === gh.id));
    for (const gh of ghosts) if (!kept.includes(gh)) disposeGhost(gh);
    list.forEach((m, i) => {
      const gh = kept.find((x) => x.id === m.id);
      if (gh) { nameGhost(gh, m.name); gh.mat.opacity = m.connected ? 0.4 : 0.18; }
      else kept.push(makeGhost(m.id, m.name, standSpot(spawnSeat(i))));
    });
    if (kept.length !== ghosts.length || kept.some((gh, i) => gh !== ghosts[i])) ghosts = kept;
  });

  const round = (v: number) => Math.round(v * 1000) / 1000;
  const samePresence = (a: Presence, b: Presence) => a.x === b.x && a.z === b.z && a.yaw === b.yaw && a.pitch === b.pitch;

  useTask(() => {
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime, now = performance.now();
    for (const g of cardList) {
      g.position.lerp(g.userData.tp, 0.12); g.quaternion.slerp(g.userData.tq, 0.12);
      if (Math.abs(g.userData.b - g.userData.tb) > 0.002) {
        g.userData.b += (g.userData.tb - g.userData.b) * 0.06;
        for (const m of g.children as THREE.Mesh[]) (m.material as THREE.MeshLambertMaterial).color.setScalar(g.userData.b);
      }
    }
    const cam = camera; if (!cam) return;
    const snap = live.snap, acting = snap.acting, table = live.table;
    const ghost = snap.seat === null;
    look.yaw += (look.tyaw - look.yaw) * 0.25; look.pitch += (look.tpitch - look.pitch) * 0.25;
    if (ghost) {
      // fantasma: anda solto pela mesa, olhar absoluto
      stepWalk(dt);
      camTarget.set(walk.x, GHOST_EYE, walk.z);
      cam.position.lerp(camTarget, 0.35);
      cam.rotation.set(look.pitch, look.yaw, 0, 'YXZ');
    } else {
      camTarget.copy(seatDir(ui.view).multiplyScalar(CAM_DIST)).setY(CAM_H);
      cam.position.lerp(camTarget, 0.1);
      cam.rotation.set(BASE_PITCH + look.pitch, seatAngle(ui.view) + look.yaw, 0, 'YXZ');
    }
    // a própria presença para os outros, quando muda, no ritmo que o servidor repassa
    if (table && now - lastPresenceAt >= PRESENCE_INTERVAL) {
      const p = { x: round(cam.position.x), z: round(cam.position.z), yaw: round(cam.rotation.y), pitch: round(cam.rotation.x) };
      if (!lastPresence || !samePresence(lastPresence, p)) { table.setPresence(p); lastPresence = p; lastPresenceAt = now; }
    }

    const ctx = { game: snap.game, view: ghost ? -1 as const : ui.view, camera: cam, chars, cards, lastPlay: bus.lastPlay, acting };
    chars.forEach((c, i) => {
      const shown = ghost || c.seat !== ui.view; // a própria cabeça não aparece na frente da câmera
      c.head.visible = shown;
      c.label.visible = shown && c.seat !== acting;
      c.labelOn.visible = shown && c.seat === acting;
      c.head.position.y = 1.35 + Math.sin(t * 1.3 + i) * 0.006;
      // quem senta e mandou para onde olha, mostra isso; bots (e quem nunca mandou) olham pelo jogo
      const p = snap.seats[c.seat].bot ? undefined : table?.presenceOf(c.seat);
      if (p && c.seat !== ui.view) aimHeadPresence(c, p); else aimHead(c, now, t, ctx);
      c.torso.scale.y = 1 + Math.sin(t * 1.3 + i) * 0.008;
      c.mouth.scale.y = now < c.mouthUntil ? 3.5 + Math.sin(now / 60) * 1.5 : 1;
      if (c.bubble.visible && now > c.bubbleUntil) c.bubble.visible = false;
    });
    // os outros fantasmas seguem a presença que mandaram; quem parou fica onde está
    ghosts.forEach((gh, i) => {
      const p = table?.presenceOf(gh.id); if (p) gh.target = p;
      gh.g.position.x += (gh.target.x - gh.g.position.x) * 0.2;
      gh.g.position.z += (gh.target.z - gh.g.position.z) * 0.2;
      gh.g.position.y = Math.sin(t * 1.1 + i) * 0.02;
      gh.g.rotation.y += angleDelta(gh.target.yaw, gh.g.rotation.y) * 0.2;
      gh.head.rotation.x += (THREE.MathUtils.clamp(gh.target.pitch, -0.9, 0.9) - gh.head.rotation.x) * 0.2;
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
{#each ghosts as gh (gh.id)}
  <T is={gh.g} />
{/each}
{#each cardList as g (g.userData.id)}
  <T is={g} />
{/each}
