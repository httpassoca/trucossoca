import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { monteSpot, SEAT_R, seatDir, TABLE_R, TABLE_TOP } from '../src/lib/scene/builders';
import { buildBar } from '../src/lib/scene/scenery/bar';
import { SEAT_BACK_Z, SEAT_FOOT_R, SEAT_H } from '../src/lib/scene/scenery/kit';

const worldOf = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

describe('cenário: bar de praia', () => {
  const sc = buildBar();
  sc.group.updateMatrixWorld(true);

  test('quatro cadeiras de plástico, uma em cada cadeira da mesa, com o assento na altura do boneco', () => {
    expect(sc.chairs).toHaveLength(4);
    sc.chairs.forEach((c, s) => {
      const want = seatDir(s as 0 | 1 | 2 | 3).multiplyScalar(SEAT_R);
      expect(c.position.distanceTo(want)).toBeLessThan(1e-6);
      const seat = c.getObjectByName('seat') as THREE.Mesh;
      const top = worldOf(seat).y + (seat.geometry as THREE.BoxGeometry).parameters.height / 2;
      expect(Math.abs(top - SEAT_H)).toBeLessThan(0.01);
      // cabe no raio que `floorAt` considera assento, e o encosto fica atrás do corpo sentado
      let back = 0;
      c.traverse((o) => { if (o instanceof THREE.Mesh) { const p = o.position; expect(Math.hypot(p.x, p.z)).toBeLessThan(SEAT_FOOT_R); if (p.y > SEAT_H + 0.1) { back++; expect(p.z).toBeGreaterThanOrEqual(SEAT_BACK_Z); } } });
      expect(back).toBeGreaterThan(0);
    });
  });

  test('nada em cima da mesa invade as cartas: o centro (raio 0.6) e os quatro lugares do monte (0.25 em volta)', () => {
    const montes = ([0, 1, 2, 3] as const).map(monteSpot);
    let props = 0;
    sc.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.name === 'tableTop' || o.name === 'tableLip') return;
      const p = worldOf(o);
      if (p.y < TABLE_TOP || p.y > TABLE_TOP + 0.4) return;
      const r = Math.hypot(p.x, p.z);
      if (r > TABLE_R) return;
      props++;
      expect(r).toBeGreaterThan(0.6);
      for (const m of montes) expect(Math.hypot(p.x - m.x, p.z - m.z)).toBeGreaterThan(0.25);
    });
    expect(props).toBeGreaterThan(20);
  });

  test('o mar começa fora do raio de andar, e a areia é o chão', () => {
    const seas: THREE.Mesh[] = [];
    sc.group.traverse((o) => { if (o instanceof THREE.Mesh && (o.name === 'sea' || o.name === 'seaFar')) seas.push(o); });
    expect(seas.length).toBeGreaterThanOrEqual(2);
    for (const s of seas) {
      const bb = new THREE.Box3().setFromObject(s);
      expect(bb.min.x).toBeGreaterThan(sc.walkMaxR);
    }
    expect(sc.floorAt!(0, 0)).toBe(0);
    expect(sc.floorAt!(5, 3)).toBe(0);
    expect(sc.floorAt!(12, 0)).toBeLessThan(-0.25);
  });

  test('o cachorro deita na areia fora da mesa e das cadeiras, e continua fora depois de um minuto passeando', () => {
    const dog = sc.group.getObjectByName('dog');
    expect(dog).toBeDefined(); expect(dog).toBe(sc.dog.group);
    const check = () => {
      const p = dog!.position;
      expect(Math.hypot(p.x, p.z)).toBeGreaterThan(TABLE_R);
      for (const c of sc.chairs) expect(Math.hypot(p.x - c.position.x, p.z - c.position.z)).toBeGreaterThan(SEAT_FOOT_R);
      expect(p.z).toBeGreaterThan(-6.4);   // nem dentro do quiosque
    };
    check();
    let moved = false; const start = dog!.position.clone();
    for (let i = 1; i <= 60 * 30; i++) {
      sc.update(i / 30, 1 / 30); check();
      if (dog!.position.distanceTo(start) > 0.5) moved = true;
    }
    expect(moved).toBe(true);
  });

  test('sem DOM as cartas ficam sem textura, e o resto do contrato responde', () => {
    expect(sc.deck.face('7h')).toBeNull();
    expect(sc.deck.back).toBeNull();
    expect(sc.id).toBe('bar');
    expect(sc.walkMaxR).toBe(6.4);
    let sun = 0;
    sc.group.traverse((o) => { if (o instanceof THREE.DirectionalLight && o.castShadow) sun++; });
    expect(sun).toBe(1);
    sc.update(0.5, 0.016);
    expect(() => sc.react!('raise')).not.toThrow();
    expect(() => sc.dog.react('raise')).not.toThrow();
    sc.update(1.0, 0.016);
    sc.update(3.5, 0.016);
    sc.dispose();
  });
});
