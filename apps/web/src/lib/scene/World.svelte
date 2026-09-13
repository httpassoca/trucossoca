<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import type { SceneryId } from '@truco/protocol';
  import type { Seat } from '@truco/rules';
  import { onDestroy, onMount, untrack } from 'svelte';
  import * as THREE from 'three';
  import { bus, freeCamera, myTurn } from '../controller';
  import { rememberedNickname } from '../identity';
  import { bounce, installPointerLock } from '../input';
  import { live, ui } from '../state.svelte';
  import { PRESENCE_INTERVAL, type Presence } from '../table/table';
  import { buildCards, disposeGhost, ghostOpacity, makeCharacter, makeGhost, nameCharacter, nameGhost, sayTo, seatAngle, seatDir, SEAT_R, dressCards, type Character, type Ghost } from './builders';
  import type { Buddy } from './buddy/model';
  import { reactionsFor, type Reaction } from './buddy/reactions';
  import { angleDelta, BASE_PITCH, BOUNCE_Y, EYE_H, floorAt, FOV, look, nearSeat, presenceStanding, seatSpot, spawnSeat, stance, standSpot, stepWalk, walk, walkBounds, zoom, ZOOM_DIST, ZOOM_FOV } from './camera';
  import { aimBuddy, aimPresence } from './gaze';
  import { layoutCards } from './layout';
  import { SCENERY_BUILDERS } from './scenery';
  import type { Scenery } from './scenery/scenery';

  const { scene, canvas, renderer } = useThrelte();

  const cards = buildCards();
  const SEATS: Seat[] = [0, 1, 2, 3];
  /** offline, a cadeira local chama-se "Você"/"You" conforme a língua: o molho vem do apelido lembrado, para ser o mesmo de quando joga online */
  const molhoKey = (s: Seat, name: string) => (live.snap.restart === 'newGame' && s === live.snap.seat ? rememberedNickname() ?? name : name);
  const chars: Character[] = SEATS.map((s) => makeCharacter(s, live.snap.seats[s].name, live.snap.seats[s].bot, molhoKey(s, live.snap.seats[s].name)));
  const cardList = Object.values(cards);

  /** o cenário montado agora; troca inteiro quando o snapshot diz outro id (o baralho, a névoa e a cerca vão junto) */
  let scenery = $state.raw<Scenery | null>(null);
  const sceneryId = $derived(live.snap.scenery);
  function mountScenery(id: SceneryId) {
    if (scenery?.id === id) return;
    scenery?.dispose();
    const next = SCENERY_BUILDERS[id]();
    scene.background = next.background; scene.fog = next.fog;
    renderer.toneMappingExposure = next.exposure;
    walkBounds.maxR = next.walkMaxR; walkBounds.floorAt = next.floorAt ?? (() => 0);
    dressCards(cards, next.deck);
    scenery = next;
  }
  $effect(() => { const id = sceneryId; untrack(() => mountScenery(id)); });

  /** os outros fantasmas, um vulto por membro sem cadeira; seguem a presença que mandam (ou ficam parados onde nasceram) */
  let ghosts = $state.raw<Ghost[]>([]);

  let camera = $state<THREE.PerspectiveCamera>();
  const camTarget = new THREE.Vector3(), fwd = new THREE.Vector3(), start = seatSpot(0);
  const clock = new THREE.Clock();
  /** a própria presença: a última mandada e quando; sai no máximo dez vezes por segundo, e só quando muda */
  let lastPresence: Presence | null = null, lastPresenceAt = 0;
  /** reações agendadas (cada boneco reage com um atraso próprio) */
  const timers = new Set<number>();

  bus.say = (seat, text) => sayTo(chars[seat], text);
  bus.react = (events) => { for (const e of events) for (const r of reactionsFor(e)) schedule(r); };

  /** Uma reação: chega com um atraso e um tempo próprios, e ao acabar volta à cara e aos braços de repouso, se nada mais novo chegou. */
  function schedule(r: Reaction) {
    const c = chars[r.seat], token = ++c.reaction;
    const delay = Math.random() * 250, hold = r.hold * (0.85 + Math.random() * 0.3);
    const after = (ms: number, f: () => void) => { const id = window.setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); };
    after(delay, () => {
      if (c.reaction !== token) return;
      c.buddy.setExpression(r.expression);
      if (r.arms) c.buddy.setArms(r.arms);
      if (r.bounce) { if (c.buddy.isSeated()) c.buddy.bounce(); else c.buddy.jump(); }
      if (r.hold > 0) after(hold, () => { if (c.reaction === token) rest(c.buddy); });
    });
  }
  const rest = (b: Buddy) => { b.setExpression(b.getOutfit().expression ?? 'Neutral'); b.setArms(b.isSeated() ? 'OnTable' : 'Relaxed'); };
  /** Troca de laço sem reiniciar o que já toca (um pulo no meio só anota para onde voltar). */
  const loop = (b: Buddy, want: 'Idle' | 'Walk') => { if (b.getAnimation() !== want) b.setAnimation(want); };

  onMount(() => installPointerLock(canvas));
  onDestroy(() => { for (const id of timers) clearTimeout(id); for (const c of chars) c.buddy.dispose(); for (const gh of ghosts) disposeGhost(gh); scenery?.dispose(); });

  // relayout sempre que a mesa muda de snapshot (ou a cadeira/carta escolhida); nomes e molhos seguem quem senta; cadeira assumida escurece
  $effect(() => { const s = live.snap; layoutCards(s.game, { view: ui.view, sel: ui.sel, myTurn: myTurn(s, ui.view) }, cards); });
  $effect(() => { live.snap.seats.forEach((seat, s) => { nameCharacter(chars[s], seat.name, seat.bot, molhoKey(s as Seat, seat.name)); chars[s].buddy.setDimmed(seat.botControlled); }); });
  // um vulto por fantasma: nasce de pé atrás de uma cadeira (a i-ésima) até a presença dele chegar; some com quem sai
  $effect(() => {
    const list = live.snap.ghosts;
    const kept = ghosts.filter((gh) => list.some((m) => m.id === gh.id));
    for (const gh of ghosts) if (!kept.includes(gh)) disposeGhost(gh);
    list.forEach((m, i) => {
      const gh = kept.find((x) => x.id === m.id);
      if (gh) { nameGhost(gh, m.name); ghostOpacity(gh, m.connected); }
      else kept.push(makeGhost(m.id, m.name, standSpot(spawnSeat(i))));
    });
    if (kept.length !== ghosts.length || kept.some((gh, i) => gh !== ghosts[i])) ghosts = kept;
  });

  const round = (v: number) => Math.round(v * 1000) / 1000;
  const samePresence = (a: Presence, b: Presence) => a.x === b.x && a.y === b.y && a.z === b.z && a.yaw === b.yaw && a.pitch === b.pitch;
  const speedOf = (g: THREE.Object3D, prev: THREE.Vector3, dt: number) => { const v = Math.hypot(g.position.x - prev.x, g.position.z - prev.z) / Math.max(dt, 1e-3); prev.copy(g.position); return v; };

  /** Um corpo que anda: segue o alvo, anda quando se move, pula quando sai do chão. `own` segue a câmera sem suavizar. */
  function walker(g: THREE.Object3D, buddy: Buddy, at: { x: number; y: number; z: number; yaw: number }, own: boolean, wasAir: boolean, dt: number, prev: THREE.Vector3) {
    if (own) { g.position.set(at.x, at.y, at.z); g.rotation.y = at.yaw; }
    else {
      g.position.x += (at.x - g.position.x) * 0.2; g.position.z += (at.z - g.position.z) * 0.2; g.position.y += (at.y - g.position.y) * 0.35;
      g.rotation.y += angleDelta(at.yaw, g.rotation.y) * 0.2;
    }
    const air = at.y - floorAt(at.x, at.z) > 0.05;
    if (air && !wasAir) buddy.jump();
    loop(buddy, speedOf(g, prev, dt) > 0.25 ? 'Walk' : 'Idle');
    return air;
  }

  useTask(() => {
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime, now = performance.now();
    for (const g of cardList) {
      g.position.lerp(g.userData.tp, 0.12); g.quaternion.slerp(g.userData.tq, 0.12);
      if (Math.abs(g.userData.b - g.userData.tb) > 0.002) {
        g.userData.b += (g.userData.tb - g.userData.b) * 0.06;
        for (const m of g.children as THREE.Mesh[]) (m.material as THREE.MeshStandardMaterial).color.setScalar(g.userData.b);
      }
    }
    scenery?.update(t, dt);
    const cam = camera; if (!cam) return;
    const snap = live.snap, acting = snap.acting, table = live.table;
    const ghost = snap.seat === null, free = freeCamera(snap);
    // a barra de teclas lê a postura daqui (o estado da câmera não é reativo); iguais não disparam nada
    ui.standing = stance.standing; ui.nearSeat = stance.standing && snap.seat !== null && nearSeat(snap.seat);
    look.yaw += (look.tyaw - look.yaw) * 0.25; look.pitch += (look.tpitch - look.pitch) * 0.25;
    if (free) {
      // solta (fantasma ou de pé): anda e pula pela mesa, olhar absoluto
      stepWalk(dt);
      zoom.t += (0 - zoom.t) * 0.15;
      camTarget.set(walk.x, EYE_H + walk.y, walk.z);
      cam.position.x += (camTarget.x - cam.position.x) * 0.35; cam.position.z += (camTarget.z - cam.position.z) * 0.35;
      cam.position.y = camTarget.y;
      cam.rotation.set(look.pitch, look.yaw, 0, 'YXZ');
    } else {
      // sentada: nos olhos do boneco; o botão direito avança na direção do olhar
      zoom.t += ((zoom.on ? 1 : 0) - zoom.t) * 0.15;
      cam.rotation.set(BASE_PITCH + look.pitch, seatAngle(ui.view) + look.yaw, 0, 'YXZ');
      cam.getWorldDirection(fwd);
      camTarget.copy(seatSpot(ui.view)).addScaledVector(fwd, ZOOM_DIST * zoom.t);
      cam.position.lerp(camTarget, 0.2);
    }
    const fov = FOV + (ZOOM_FOV - FOV) * zoom.t;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    // a própria presença para os outros, quando muda, no ritmo que o servidor repassa
    if (table && now - lastPresenceAt >= PRESENCE_INTERVAL) {
      const y = free ? walk.y : now - bounce.at < 220 ? BOUNCE_Y : 0;
      const p = { x: round(cam.position.x), y: round(y), z: round(cam.position.z), yaw: round(cam.rotation.y), pitch: round(cam.rotation.x) };
      if (!lastPresence || !samePresence(lastPresence, p)) { table.setPresence(p); lastPresence = p; lastPresenceAt = now; }
    }

    const ctx = { game: snap.game, view: free ? -1 as const : ui.view, camera: cam, chars, cards, lastPlay: bus.lastPlay, acting };
    chars.forEach((c) => {
      const seat = snap.seats[c.seat];
      const mine = !ghost && c.seat === snap.seat;          // a cadeira que esta pessoa controla
      const own = !free && c.seat === ui.view;               // o boneco em cuja cabeça a câmera está
      const p = seat.bot || mine ? undefined : table?.presenceOf(c.seat);
      const standing = mine ? stance.standing : !!p && presenceStanding(c.seat, p);
      if (standing) {
        if (!c.standing) { c.standing = true; c.buddy.setSeated(false); c.buddy.setArms('Relaxed'); c.buddy.setLean(0); }
        const at = mine ? { x: walk.x, y: walk.y, z: walk.z, yaw: look.yaw } : p!;
        c.air = walker(c.g, c.buddy, at, mine, c.air, dt, c.prev);
        c.buddy.setLook(0, mine ? 0 : THREE.MathUtils.clamp(p!.pitch, -0.7, 0.5));
        c.buddy.setFirstPerson(mine);
      } else {
        if (c.standing) { c.standing = false; c.air = false; c.buddy.setSeated(true); c.buddy.setArms('OnTable'); loop(c.buddy, 'Idle'); c.g.position.copy(seatDir(c.seat).multiplyScalar(SEAT_R)); c.g.rotation.y = seatAngle(c.seat); c.prev.copy(c.g.position); }
        c.buddy.setFirstPerson(own);
        if (own) {
          c.buddy.setLook(look.yaw, look.pitch); c.buddy.setLean(zoom.t);
          if (mine && bounce.at !== c.bounced) { c.bounced = bounce.at; if (bounce.at) c.buddy.bounce(); }
        } else if (p) {
          // quem senta e mandou para onde olha, mostra isso; um quique chega como altura
          aimPresence(c, p);
          const up = p.y > 0.05; if (up && !c.air) c.buddy.bounce(); c.air = up;
        } else aimBuddy(c, now, t, ctx);   // bots (e quem nunca mandou) olham pelo jogo
      }
      const shown = !own;
      c.label.visible = shown && c.seat !== acting;
      c.labelOn.visible = shown && c.seat === acting;
      c.buddy.setTalking(now < c.talkUntil);
      if (c.bubble.visible && now > c.bubbleUntil) c.bubble.visible = false;
      c.buddy.update(dt);
    });
    // os outros fantasmas seguem a presença que mandaram; quem parou fica onde está
    ghosts.forEach((gh) => {
      const p = table?.presenceOf(gh.id); if (p) gh.target = p;
      gh.air = walker(gh.g, gh.buddy, gh.target, false, gh.air, dt, gh.prev);
      gh.buddy.setLook(0, THREE.MathUtils.clamp(gh.target.pitch, -0.7, 0.5));
      gh.buddy.update(dt);
    });
  });
</script>

<!-- longe o bastante para o céu e a cidade dos cenários -->
<T.PerspectiveCamera makeDefault fov={FOV} near={0.05} far={400} bind:ref={camera}
  position={[start.x, start.y, start.z]} rotation={[BASE_PITCH, 0, 0, 'YXZ']} />

<!-- o cenário traz chão, arredores, luzes, mesa e cadeiras -->
{#if scenery}
  <T is={scenery.group} />
{/if}
{#each chars as c (c.seat)}
  <T is={c.g} />
{/each}
{#each ghosts as gh (gh.id)}
  <T is={gh.g} />
{/each}
{#each cardList as g (g.userData.id)}
  <T is={g} />
{/each}
