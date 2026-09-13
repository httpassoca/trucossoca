import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { SEAT_R, seatDir, TABLE_R, TABLE_TOP } from '../src/lib/scene/builders';
import { buildBar } from '../src/lib/scene/scenery/bar';
import { SEAT_BACK_Z, SEAT_FOOT_R, SEAT_H } from '../src/lib/scene/scenery/kit';

const worldOf = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

describe('cenário: bar de esquina', () => {
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

  test('nada em cima da mesa invade as cartas: o centro (raio 0.6) e o monte (0.62, -0.62)', () => {
    const stock = new THREE.Vector3(0.62, 0, -0.62);
    sc.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.name === 'tableTop' || o.name === 'tableLip') return;
      const p = worldOf(o);
      if (p.y < TABLE_TOP || p.y > TABLE_TOP + 0.4) return;
      const r = Math.hypot(p.x, p.z);
      if (r > TABLE_R) return;
      expect(r).toBeGreaterThan(0.6);
      expect(Math.hypot(p.x - stock.x, p.z - stock.z)).toBeGreaterThan(0.25);
    });
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
    sc.update(1.0, 0.016);
    sc.dispose();
  });
});
