/**
 * Um cenário (CONTEXT.md): o lugar ao redor da mesa. Traz o chão, o que se vê em volta, as luzes, a mesa, as
 * cadeiras e o desenho do baralho. Tudo procedural, em código, como os bonecos (ADR 0006, ADR 0007). A cena
 * troca de cenário inteiro quando o snapshot da mesa diz outro id.
 */
import type { SceneryId } from '@truco/protocol';
import type { CardId } from '@truco/rules';
import * as THREE from 'three';

/** O desenho das cartas deste cenário. As texturas são null sem DOM (testes): o material fica sem mapa. */
export interface DeckArt {
  face(id: CardId): THREE.Texture | null;
  back: THREE.Texture | null;
  roughness: number;
  metalness: number;
  /** solta as texturas já desenhadas */
  dispose(): void;
}

export interface Scenery {
  id: SceneryId;
  /** tudo do cenário: chão, arredores, luzes, mesa e as quatro cadeiras; entra na cena inteiro e sai inteiro */
  group: THREE.Group;
  /** as cadeiras, uma por cadeira da mesa, já dentro de `group` e no lugar (ver `placeChair` no kit) */
  chairs: THREE.Group[];
  background: THREE.Color;
  fog: THREE.Fog | THREE.FogExp2 | null;
  /** exposição do tone mapping (ACES) */
  exposure: number;
  /** até onde se anda do centro da mesa, em metros */
  walkMaxR: number;
  /** a altura do chão em (x, z) fora da mesa e das cadeiras (uma rua abaixo da calçada, por exemplo); sem isto, zero */
  floorAt?(x: number, z: number): number;
  deck: DeckArt;
  /** por quadro: chamas, bichos, fumaça, luzes que piscam. `t` em segundos desde o começo, `dt` desde o quadro anterior */
  update(t: number, dt: number): void;
  /** um lance da mesa ('raise' quando alguém truca): o que vive no cenário reage, se quiser; opcional */
  react?(kind: string): void;
  /** solta geometrias, materiais e texturas */
  dispose(): void;
}

export type SceneryBuilder = () => Scenery;
