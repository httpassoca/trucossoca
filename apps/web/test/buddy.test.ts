import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { SEAT_R, TABLE_R, TABLE_TOP } from '../src/lib/scene/builders';
import { ARM_POSES, BUDDY_EYE, createBuddy, EXPRESSIONS, STOOL_H } from '../src/lib/scene/buddy/model';
import { botOutfit, nickHash, outfitFor, personOutfit, STATE_ORDER, STATE_OUTFITS } from '../src/lib/scene/buddy/molho';
import { reactionsFor } from '../src/lib/scene/buddy/reactions';
import { EYE_H, floorAt, jump, look, presenceLean, presenceStanding, seatSpot, sitDown, stance, standUp, stepWalk, walk, WALK_MIN_R, ZOOM_DIST } from '../src/lib/scene/camera';

const settle = (b: ReturnType<typeof createBuddy>, n = 60) => { for (let i = 0; i < n; i++) b.update(0.05); b.group.updateMatrixWorld(true); };
const worldOf = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

describe('boneco', () => {
  test('sentado com os braços na mesa, as mãos ficam sobre o tampo, à frente do corpo', () => {
    const b = createBuddy({ outfit: { arms: 'OnTable' } });
    b.setSeated(true); settle(b);
    for (const socket of b.handSockets) {
      const p = worldOf(socket);
      expect(p.y).toBeGreaterThan(TABLE_TOP); expect(p.y).toBeLessThan(TABLE_TOP + 0.1);
      expect(p.z).toBeGreaterThan(0.4);
    }
    // o corpo na cadeira alcança a mesa: da cadeira ao tampo há menos que o braço estendido
    expect(SEAT_R - TABLE_R).toBeLessThan(0.5);
  });

  test('a altura dos olhos é a da câmera sentada, e não muda ao sentar', () => {
    const b = createBuddy();
    settle(b);
    const standing = worldOf(b.group.getObjectByName('eyeR')!).y;
    b.setSeated(true); settle(b);
    const seated = worldOf(b.group.getObjectByName('eyeR')!).y;
    expect(Math.abs(standing - BUDDY_EYE)).toBeLessThan(0.03);
    expect(Math.abs(seated - BUDDY_EYE)).toBeLessThan(0.03);
    expect(EYE_H).toBe(BUDDY_EYE);
    expect(STOOL_H).toBeLessThan(0.34); // as pernas saem por cima do assento
  });

  test('o olhar vai nos olhos primeiro e só depois no tronco', () => {
    const b = createBuddy();
    const torso = b.group.getObjectByName('torso')!, pupil = b.group.getObjectByName('pupilR')!;
    b.setLook(0.2, 0); settle(b);
    expect(pupil.position.x).toBeGreaterThan(0.005);
    expect(Math.abs(torso.rotation.y)).toBeLessThan(1e-6);
    b.setLook(1.0, 0); settle(b);
    expect(torso.rotation.y).toBeGreaterThan(0.3);
    expect(torso.rotation.y).toBeLessThanOrEqual(0.6 + 1e-6);
  });

  test('vulto: um material só para tudo, translúcido; primeira pessoa esconde o rosto e o chapéu', () => {
    const g = createBuddy({ ghost: true, outfit: STATE_OUTFITS.RS });
    const mats = new Set<THREE.Material>();
    g.group.traverse((o) => { if (o instanceof THREE.Mesh) mats.add(o.material as THREE.Material); });
    expect(mats.size).toBe(2);
    for (const m of mats) expect((m as THREE.MeshStandardMaterial).transparent).toBe(true);
    const b = createBuddy({ outfit: STATE_OUTFITS.RS });
    b.setFirstPerson(true);
    expect(b.group.getObjectByName('face')!.visible).toBe(false);
    expect(b.group.getObjectByName('hatSlot')!.visible).toBe(false);
    expect(b.group.getObjectByName('shoulderL')!.visible).toBe(true);
    b.setFirstPerson(false);
    expect(b.group.getObjectByName('face')!.visible).toBe(true);
  });

  test('pular e quicar tocam uma vez e voltam ao laço; sentado, o quique não tira as pernas da frente', () => {
    const b = createBuddy();
    b.setSeated(true); b.setAnimation('Idle'); b.bounce();
    expect(b.getAnimation()).toBe('Bounce');
    settle(b, 20);
    expect(b.getAnimation()).toBe('Idle');
    const hip = b.group.getObjectByName('hipL')!;
    expect(hip.rotation.x).toBeLessThan(-1);
    b.setSeated(false); b.setAnimation('Walk'); b.jump();
    expect(b.getAnimation()).toBe('Jump');
    settle(b, 30);
    expect(b.getAnimation()).toBe('Walk');
  });

  test('toda expressão e pose de braço existem; escurecer e voltar preserva as cores', () => {
    const b = createBuddy({ outfit: personOutfit('Zé') });
    for (const e of Object.keys(EXPRESSIONS)) b.setExpression(e as keyof typeof EXPRESSIONS, true);
    for (const a of Object.keys(ARM_POSES)) b.setArms(a as keyof typeof ARM_POSES, true);
    const before = b.materials.body.color.getHex();
    b.setDimmed(true); expect(b.materials.body.color.getHex()).not.toBe(before);
    b.setDimmed(false); expect(b.materials.body.color.getHex()).toBe(before);
    b.dispose();
  });
});

describe('molho', () => {
  test('o mesmo apelido dá o mesmo molho, sem espaços ou maiúsculas contarem; apelidos diferentes diferem', () => {
    expect(personOutfit('Zé')).toEqual(personOutfit(' zé '));
    expect(nickHash('Dita')).toBe(nickHash('dita'));
    const names = ['Ana', 'Bruno', 'Carla', 'Dito', 'Edu', 'Fê', 'Gui', 'Helô'];
    const seen = new Set(names.map((n) => JSON.stringify(personOutfit(n))));
    expect(seen.size).toBe(names.length);
  });

  test('cada molho sorteado monta um boneco válido', () => {
    for (const n of ['Você', 'You', 'passoca', 'x', '🙂', 'Maria Clara']) {
      const o = personOutfit(n);
      expect(o.skin).toMatch(/^#/); expect(o.hair).toBeDefined(); expect(o.footwear).toBeDefined();
      const b = createBuddy({ outfit: o }); settle(b, 3); b.dispose();
    }
  });

  test('bots vestem um dos seis molhos regionais; a pose de braço vem de quem senta', () => {
    for (const n of ['Tião', 'Dita', 'Zé', 'Bot 4']) expect(Object.values(STATE_OUTFITS)).toContainEqual(botOutfit(n));
    expect(STATE_ORDER).toHaveLength(6);
    expect(outfitFor('Tião', true, 'OnTable').arms).toBe('OnTable');
    expect(outfitFor('Ana', false, 'Relaxed').arms).toBe('Relaxed');
    expect(outfitFor('Ana', false, 'Relaxed').hair).toEqual(personOutfit('Ana').hair);
  });
});

describe('reações', () => {
  test('truco: quem pede fica convencido de braço erguido, a dupla junto, os adversários surpresos', () => {
    const r = reactionsFor({ type: 'raise', seat: 1, to: 4 });
    expect(r.find((x) => x.seat === 1)).toMatchObject({ expression: 'Smug', arms: 'Raise' });
    expect(r.find((x) => x.seat === 3)).toMatchObject({ expression: 'Smug' });
    expect(r.filter((x) => x.expression === 'Surprised').map((x) => x.seat).sort()).toEqual([0, 2]);
  });
  test('correr entristece a dupla e diverte a outra; fim de jogo faz a dupla vencedora comemorar quicando', () => {
    const r = reactionsFor({ type: 'respond', seat: 0, action: 'decline', value: 4, winnerTeam: 1 });
    expect(r.find((x) => x.seat === 0)).toMatchObject({ expression: 'Sad', arms: 'Shrug' });
    expect(r.filter((x) => x.expression === 'Cheeky')).toHaveLength(2);
    const g = reactionsFor({ type: 'gameOver', winner: 1 });
    expect(g.filter((x) => x.bounce).map((x) => x.seat).sort()).toEqual([1, 3]);
    expect(g.every((x) => x.hold >= 4000)).toBe(true);
  });
  test('vaza empatada surpreende todos; jogada não reage', () => {
    expect(reactionsFor({ type: 'trick', n: 1, winner: null, bestSeat: null })).toHaveLength(4);
    expect(reactionsFor({ type: 'play', seat: 0, id: '4c', covered: false, kind: 'lead', seed: 1 })).toHaveLength(0);
  });
});

describe('andar e pular', () => {
  const reset = () => { walk.keys.clear(); walk.x = 0; walk.z = 3; walk.y = 0; walk.vy = 0; walk.airborne = false; look.yaw = 0; look.tyaw = 0; look.pitch = 0; look.tpitch = 0; stance.standing = false; };
  const run = (s: number) => { for (let i = 0; i < s / 0.016; i++) stepWalk(0.016); };

  test('a mesa é chão elevado dentro dela e o banquinho sob cada cadeira; andar até um banquinho sobe nele', () => {
    expect(floorAt(0, 0)).toBe(TABLE_TOP);
    expect(floorAt(0, SEAT_R)).toBe(STOOL_H);
    expect(floorAt(0, 4)).toBe(0);
    reset(); walk.keys.add('KeyW'); run(3);
    expect(walk.y).toBe(STOOL_H);
  });

  test('no chão, andar para a mesa esbarra nela; pulando, sobe no tampo e anda em cima', () => {
    // entre duas cadeiras (na diagonal), para não subir num banquinho no caminho
    reset(); walk.x = 2.1; walk.z = 2.1; look.yaw = Math.PI / 4; walk.keys.add('KeyW'); run(3);
    expect(Math.hypot(walk.x, walk.z)).toBeCloseTo(WALK_MIN_R, 2);
    expect(walk.y).toBe(0);
    expect(jump()).toBe(true); expect(jump()).toBe(false);
    run(0.8); walk.keys.clear(); run(0.5);
    expect(walk.y).toBe(TABLE_TOP);
    expect(Math.hypot(walk.x, walk.z)).toBeLessThan(TABLE_R);
    walk.keys.clear(); walk.keys.add('KeyS'); run(3);
    expect(walk.y).toBe(0);
    expect(Math.hypot(walk.x, walk.z)).toBeGreaterThan(WALK_MIN_R - 1e-6);
  });

  test('levantar da cadeira 2 põe a pessoa de pé sobre o banquinho, olhando para onde olhava, e já pulando', () => {
    reset(); look.yaw = 0.3; look.pitch = 0.1;
    standUp(2);
    expect(stance.standing).toBe(true);
    expect(walk.airborne).toBe(true); expect(walk.vy).toBeGreaterThan(0);
    expect(Math.hypot(walk.x, walk.z)).toBeCloseTo(SEAT_R, 5);
    expect(look.yaw).toBeCloseTo(Math.PI + 0.3, 5);
    run(1.5);
    expect(walk.y).toBe(STOOL_H);
    sitDown();
    expect(stance.standing).toBe(false); expect(look.yaw).toBe(0);
  });

  test('os outros leem da presença: longe da cadeira ou à altura do banquinho é de pé; a posição diz a inclinação', () => {
    const s = seatSpot(0);
    const seated = { x: s.x, y: 0, z: s.z, yaw: 0, pitch: 0 };
    expect(presenceStanding(0, seated)).toBe(false);
    expect(presenceStanding(0, { ...seated, y: 0.12 })).toBe(false);     // quique
    expect(presenceStanding(0, { ...seated, y: STOOL_H })).toBe(true);   // de pé no banquinho
    expect(presenceStanding(0, { ...seated, z: s.z + 1 })).toBe(true);
    expect(presenceLean(0, seated)).toBe(0);
    expect(presenceLean(0, { ...seated, z: s.z - ZOOM_DIST })).toBeCloseTo(1, 5);
    expect(presenceLean(0, { ...seated, z: s.z - ZOOM_DIST / 2 })).toBeCloseTo(0.5, 5);
  });
});
