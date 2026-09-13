/**
 * O vira-lata caramelo da praia. Um cachorro médio articulado: tronco em cápsula com peito e barriga mais clara,
 * pescoço, cabeça com focinho claro, duas orelhas caídas, quatro patas com ombro/quadril e joelho, e o rabo
 * enrolado em cinco gomos. Origem entre as patas, no chão, frente em +z.
 *
 * Vive numa maquininha de estados: deitado (respira, sacode a orelha, bate o rabo), sentado olhando em volta,
 * levantando, trotando até outro canto da areia (patas em trote, corpo quicando) e deitando de novo. Os cantos
 * vêm de uma lista semeada num anel ao redor da mesa, fora das cadeiras, da mesa e do bar; o trote entre dois
 * cantos segue o arco (raio e ângulo interpolados), então nunca corta por cima da mesa. `react('raise')` faz ele
 * levantar a cabeça, arrebitar as orelhas e abanar forte por uns dois segundos.
 */
import * as THREE from 'three';
import { at, capsule, cyl, polar, shadows, sph, type Rng } from '../kit';

export interface Dog {
  group: THREE.Group;
  update(t: number, dt: number): void;
  react(kind: string): void;
}

type State = 'lying' | 'sitting' | 'rising' | 'trotting' | 'settling';
/** Juntas: altura do quadril, inclinação do tronco, [ombro, joelho] × (dianteira esq, dir, traseira esq, dir), pescoço, cabeça, rabo, enrolo, orelha */
interface Pose { hipY: number; pitch: number; legs: number[]; neck: number; head: number; tail: number; curl: number; ear: number }

const POSES: Record<'stand' | 'lie' | 'sit', Pose> = {
  stand: { hipY: 0.365, pitch: 0, legs: [0, 0, 0, 0, 0, 0, 0, 0], neck: -0.8, head: 0.8, tail: 0.9, curl: 0.45, ear: 0 },
  lie: { hipY: 0.14, pitch: 0, legs: [-0.9, -0.67, -0.9, -0.67, -1.4, 2.3, -1.4, 2.3], neck: -1.15, head: 1.0, tail: 1.5, curl: 0.22, ear: 0.15 },
  sit: { hipY: 0.29, pitch: -0.65, legs: [0.65, 0, 0.65, 0, -1.0, 1.9, -1.0, 1.9], neck: -0.55, head: 0.55, tail: 1.45, curl: 0.3, ear: 0 },
};
const clonePose = (p: Pose): Pose => ({ ...p, legs: [...p.legs] });
const lerpPose = (a: Pose, b: Pose, k: number) => {
  a.hipY += (b.hipY - a.hipY) * k; a.pitch += (b.pitch - a.pitch) * k; a.neck += (b.neck - a.neck) * k; a.head += (b.head - a.head) * k;
  a.tail += (b.tail - a.tail) * k; a.curl += (b.curl - a.curl) * k; a.ear += (b.ear - a.ear) * k;
  for (let i = 0; i < 8; i++) a.legs[i] += (b.legs[i] - a.legs[i]) * k;
};
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Os cantos onde o cachorro deita: um anel entre 2.75 e 3.6 m da mesa (as cadeiras vão até 2.2; o bar começa em -6.5). */
export const DOG_RING = { rMin: 2.75, rMax: 3.6 } as const;

export function buildDog(rng: Rng): Dog {
  const { rr, rnd } = rng;
  const std = (color: number, roughness = 0.95) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  const fur = std(0xc9893c), light = std(0xe8c48e), dark = std(0x1a1410, 0.4), padMat = std(0x3a2a20, 0.8);

  const group = new THREE.Group(); group.name = 'dog';
  const torso = new THREE.Group(); group.add(torso);
  const body = capsule(0.13, 0.3, fur, 14); body.rotation.x = Math.PI / 2; torso.add(body);
  const chest = at(sph(0.135, fur, 14), 0, -0.005, 0.12); chest.scale.set(1.05, 0.95, 1.1); torso.add(chest);
  const belly = at(capsule(0.112, 0.26, light, 12), 0, -0.035, 0.02); belly.rotation.x = Math.PI / 2; torso.add(belly);

  /* pescoço e cabeça */
  const neck = new THREE.Group(); neck.position.set(0, 0.07, 0.19); torso.add(neck);
  neck.add(at(cyl(0.05, 0.068, 0.17, fur, 10), 0, 0.08, 0));
  const head = new THREE.Group(); head.position.set(0, 0.165, 0); neck.add(head);
  const skull = at(sph(0.1, fur, 16), 0, 0.03, 0.02); skull.scale.set(1, 0.92, 1.05); head.add(skull);
  const muzzle = at(cyl(0.042, 0.06, 0.13, light, 10), 0, -0.005, 0.125); muzzle.rotation.x = Math.PI / 2; head.add(muzzle);
  head.add(at(sph(0.024, dark, 8), 0, 0.015, 0.195));   // nariz
  for (const sx of [-1, 1]) head.add(at(sph(0.016, dark, 8), sx * 0.045, 0.065, 0.095));   // olhos
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * 0.085, 0.095, -0.01); head.add(e); ears.push(e);
    const flap = at(sph(0.05, fur, 10), 0, -0.065, 0); flap.scale.set(0.6, 1.35, 0.35); e.add(flap);
  }

  /* patas: ombro/quadril no tronco, joelho no meio, almofada na ponta */
  const legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
  for (const [sx, z] of [[-1, 0.17], [1, 0.17], [-1, -0.17], [1, -0.17]]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.09, -0.02, z); torso.add(hip);
    hip.add(at(cyl(0.037, 0.03, 0.17, fur, 8), 0, -0.085, 0));
    const knee = new THREE.Group(); knee.position.y = -0.17; hip.add(knee);
    knee.add(at(cyl(0.028, 0.024, 0.16, fur, 8), 0, -0.08, 0));
    const paw = at(sph(0.032, light, 8), 0, -0.16, 0.015); paw.scale.set(1, 0.7, 1.2); knee.add(paw);
    knee.add(at(sph(0.012, padMat, 6), 0, -0.178, 0.03));
    legs.push({ hip, knee });
  }

  /* rabo enrolado: cinco gomos, cada um dobrando um pouco mais */
  const tail = new THREE.Group(); tail.position.set(0, 0.06, -0.22); torso.add(tail);
  const tailSegs: THREE.Group[] = []; let parent: THREE.Object3D = tail;
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Group(); s.position.y = i ? 0.072 : 0; parent.add(s); tailSegs.push(s);
    s.add(at(cyl(0.02 - i * 0.003, 0.023 - i * 0.003, 0.078, i === 4 ? light : fur, 8), 0, 0.038, 0));
    parent = s;
  }
  shadows(group);

  /* ---------- os cantos e o estado ---------- */
  const spots: { r: number; a: number }[] = [];
  for (let i = 0; i < 7; i++) spots.push({ r: rr(DOG_RING.rMin, DOG_RING.rMax), a: i * (Math.PI * 2 / 7) + 0.5 + rr(-0.2, 0.2) });
  let spot = 0;
  const cur = clonePose(POSES.lie), target = clonePose(POSES.lie);
  let state: State = 'lying', timer = rr(6, 12), yaw = 0, yawTarget = 0;
  let excite = 0, earFlick = [0, 0], flickIn = rr(2, 5), thump = 0, thumpIn = rr(2, 6), lookYaw = 0, lookIn = rr(1.5, 4);
  const trot = { r0: 0, a0: 0, r1: 0, a1: 0, da: 0, len: 1, u: 0, phase: 0 };
  const _p = new THREE.Vector3(), _q = new THREE.Vector3();
  const faceTable = () => wrapAngle(Math.atan2(-group.position.x, -group.position.z) + 0.5);   // de lado para a mesa, olhando o jogo

  const place = (r: number, a: number) => { const p = polar(r, a); group.position.set(p.x, 0, p.z); };
  place(spots[0].r, spots[0].a); yaw = yawTarget = faceTable(); group.rotation.y = yaw;

  const enter = (s: State) => {
    state = s;
    if (s === 'lying') { Object.assign(target, clonePose(POSES.lie)); timer = rr(8, 18); yawTarget = faceTable(); }
    if (s === 'sitting') { Object.assign(target, clonePose(POSES.sit)); timer = rr(4, 8); }
    if (s === 'rising') { Object.assign(target, clonePose(POSES.stand)); timer = 0.9; planTrot(); }
    if (s === 'settling') { Object.assign(target, clonePose(POSES.lie)); timer = 1.1; yawTarget = faceTable(); }
    if (s === 'trotting') { trot.u = 0; trot.phase = 0; Object.assign(target, clonePose(POSES.stand)); }
  };
  /** escolhe o próximo canto e o arco até ele (raio e ângulo interpolados, pelo lado mais curto) */
  function planTrot() {
    const next = (spot + 1 + Math.floor(rnd() * (spots.length - 1))) % spots.length;
    const from = spots[spot], to = spots[next]; spot = next;
    trot.r0 = from.r; trot.a0 = from.a; trot.r1 = to.r; trot.a1 = to.a; trot.da = wrapAngle(to.a - from.a);
    trot.len = Math.max(0.5, Math.hypot(to.r - from.r, (from.r + to.r) / 2 * trot.da));
  }
  /** ponto do arco em `u` ∈ [0, 1] */
  const arc = (u: number, out: THREE.Vector3) => { const r = trot.r0 + (trot.r1 - trot.r0) * u, a = trot.a0 + trot.da * u; return out.set(Math.sin(a) * r, 0, Math.cos(a) * r); };

  return {
    group,
    react(kind) { if (kind === 'raise') excite = 2.2; },
    update(t, dt) {
      dt = Math.min(dt, 0.1);
      timer -= dt; excite = Math.max(0, excite - dt);
      // a máquina
      if (state === 'lying' && timer <= 0) enter(rnd() < 0.5 ? 'sitting' : 'rising');
      else if (state === 'sitting' && timer <= 0) enter(rnd() < 0.4 ? 'settling' : 'rising');
      else if (state === 'rising' && timer <= 0) enter('trotting');
      else if (state === 'settling' && timer <= 0) enter('lying');
      else if (state === 'trotting') {
        trot.u = Math.min(1, trot.u + dt * 1.2 / trot.len); trot.phase += dt * Math.PI * 2 * 2.6;
        arc(trot.u, _p); group.position.copy(_p);
        arc(Math.min(1, trot.u + 0.02), _q).sub(_p); if (_q.lengthSq() > 1e-6) yawTarget = Math.atan2(_q.x, _q.z);
        if (trot.u >= 1) enter('settling');
      }
      if (state === 'rising') { arc(0.02, _q).sub(group.position); yawTarget = Math.atan2(_q.x, _q.z); }
      // pose alvo mais o que o instante pede
      const k = 1 - Math.exp(-dt * 6);
      lerpPose(cur, target, k);
      yaw += wrapAngle(yawTarget - yaw) * (1 - Math.exp(-dt * 4)); group.rotation.y = yaw;
      const resting = state === 'lying' || state === 'sitting';
      const perk = excite > 0 ? Math.min(1, excite / 0.4) : 0;
      // respiração, olhar em volta, orelha, rabo
      const breath = resting ? 0.03 * Math.sin(t * 1.6) : 0.02 * Math.sin(t * 6);
      torso.scale.set(1, 1 + breath, 1);
      lookIn -= dt; if (lookIn <= 0) { lookIn = rr(1.5, 4); lookYaw = resting ? rr(-0.6, 0.6) : 0; }
      head.rotation.y += ((perk ? 0 : lookYaw) - head.rotation.y) * (1 - Math.exp(-dt * 3));
      flickIn -= dt; if (flickIn <= 0) { flickIn = rr(2, 6); earFlick[Math.floor(rnd() * 2)] = 1; }
      thumpIn -= dt; if (thumpIn <= 0 && state === 'lying') { thumpIn = rr(3, 8); thump = 1.6; } thump = Math.max(0, thump - dt);
      const wagAmp = perk ? 0.9 : thump > 0 ? 0.6 : state === 'trotting' ? 0.35 : 0.08, wagHz = perk ? 11 : thump > 0 ? 3.5 : 2.2;
      // aplica as juntas
      let hipY = cur.hipY, neckX = cur.neck, headX = cur.head;
      if (perk) { neckX += (-0.5 - neckX) * perk * 0.8; headX += (0.5 - headX) * perk * 0.8; }
      if (state === 'trotting') hipY += 0.015 * Math.sin(trot.phase * 2);
      torso.position.y = hipY; torso.rotation.x = cur.pitch;
      neck.rotation.x = neckX; head.rotation.x = headX;
      legs.forEach((l, i) => {
        let hip = cur.legs[i * 2], knee = cur.legs[i * 2 + 1];
        if (state === 'trotting') { const ph = trot.phase + (i === 0 || i === 3 ? 0 : Math.PI); hip += -0.45 * Math.sin(ph); knee += 0.75 * Math.max(0, Math.cos(ph)); }
        l.hip.rotation.x = hip; l.knee.rotation.x = knee;
      });
      ears.forEach((e, i) => {
        earFlick[i] = Math.max(0, earFlick[i] - dt * 3.5);
        const flick = Math.sin(earFlick[i] * Math.PI) * 0.7;
        e.rotation.z = (i ? -1 : 1) * ((0.45 + cur.ear) * (1 - perk * 0.6) + 0.1 * perk);
        e.rotation.x = -0.2 - 0.6 * perk + flick;
      });
      tail.rotation.x = cur.tail; tail.rotation.z = Math.sin(t * Math.PI * 2 * wagHz) * wagAmp;
      tailSegs.forEach((s, i) => { s.rotation.x = i ? cur.curl + 0.1 * perk : 0; });
    },
  };
}
