import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import type { Seat } from '@truco/rules';
import { seatDir, SEAT_R } from '../src/lib/scene/builders';
import { buildGraveyard } from '../src/lib/scene/scenery/graveyard';
import { SEAT_BACK_Z, SEAT_FOOT_R, SEAT_H } from '../src/lib/scene/scenery/kit';

describe('cenário: cemitério', () => {
  test('monta sem DOM: quatro cadeiras nos lugares, assento na altura do banquinho, luz com sombra, baralho sem textura', () => {
    const sc = buildGraveyard();
    expect(sc.id).toBe('graveyard');
    sc.group.updateMatrixWorld(true);
    expect(sc.chairs.length).toBe(4);
    sc.chairs.forEach((chair, s) => {
      const want = seatDir(s as Seat).multiplyScalar(SEAT_R);
      const got = chair.getWorldPosition(new THREE.Vector3());
      expect(got.distanceTo(want)).toBeLessThan(1e-6);
      const seat = chair.getObjectByName('seat') as THREE.Mesh;
      expect(seat).toBeDefined();
      const bb = new THREE.Box3().setFromObject(seat);
      expect(Math.abs(bb.max.y - SEAT_H)).toBeLessThan(0.01);
      // cabe no raio que `floorAt` considera assento, e o encosto fica atrás do corpo sentado
      let back = 0;
      chair.traverse((o) => { if (o instanceof THREE.Mesh) { const p = o.position; expect(Math.hypot(p.x, p.z)).toBeLessThan(SEAT_FOOT_R); if (p.y > SEAT_H + 0.1) { back++; expect(p.z).toBeGreaterThanOrEqual(SEAT_BACK_Z); } } });
      expect(back).toBeGreaterThan(0);
    });
    // sem DOM, as texturas ficam nulas e nada quebra
    expect(sc.deck.face('4c')).toBeNull();
    expect(sc.deck.back).toBeNull();
    let shadowSun = 0;
    sc.group.traverse((o) => { if (o instanceof THREE.DirectionalLight && o.castShadow) shadowSun++; });
    expect(shadowSun).toBeGreaterThanOrEqual(1);
    expect(sc.walkMaxR).toBe(6.4);
    sc.update(0.5, 0.016);
    sc.dispose();
  });
});
