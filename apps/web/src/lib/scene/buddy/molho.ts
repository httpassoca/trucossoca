/**
 * O molho de cada apelido. Uma pessoa recebe um sorteio semeado pelo apelido: o mesmo apelido tem o mesmo molho
 * em toda tela e toda sala, sem ninguém escolher nada. Um bot recebe um dos seis molhos regionais, pelo nome.
 */
import type { ArmPoseName, ExpressionName, Outfit } from './model';

/** Seis molhos regionais, feitos à mão: os bots vestem estes. */
export const STATE_OUTFITS: Record<'MG' | 'RJ' | 'RS' | 'AM' | 'PE' | 'MT', Outfit> = {
  MG: { // Uai, sô. Café passado, pão de queijo e calma.
    skin: '#c98b5a', belly: '#f0dcc0',
    hair: { kind: 'flat', color: '#3b2a1e' }, facialHair: { kind: 'mustache', color: '#3b2a1e' },
    top: { kind: 'cardigan', color: '#6b4a2b', accent: '#d9c7a3' }, footwear: { kind: 'sneaker', color: '#5b6f3a' },
    propR: 'coffeeMug', propL: 'paoDeQueijo', expression: 'Calm',
  },
  RJ: { // Sol, sunga, óculos escuros e água de coco.
    skin: '#8a5a3a', belly: '#c8916a',
    hair: { kind: 'curly', color: '#c99a4a' }, eyewear: { kind: 'sunglasses', color: '#15161a', accent: '#15161a' },
    top: { kind: 'openShirt', color: '#f2c53d', accent: '#1f8a4c' }, neck: { kind: 'canga', color: '#1fa1d2' },
    footwear: { kind: 'flipflop', color: '#1f6fd1', accent: '#f4f0e8' }, propR: 'coconut', propL: 'football', expression: 'Happy',
  },
  RS: { // Chapéu de aba larga, lenço maragato, pala e chimarrão.
    skin: '#e8b89a', belly: '#f6e6d6',
    hair: { kind: 'flat', color: '#2b1d14' }, facialHair: { kind: 'thickMustache', color: '#2b1d14' },
    hat: { kind: 'gaucho', color: '#2a2420', accent: '#c8322b' }, neck: { kind: 'bandana', color: '#c8322b' },
    top: { kind: 'poncho', color: '#7a2e2e', accent: '#e8d8b0' }, footwear: { kind: 'boot', color: '#3a2a1e' },
    propR: 'chimarrao', expression: 'Proud',
  },
  AM: { // Chapéu de palha, tacacá, guaraná e uma arara no ombro.
    skin: '#a86b3c', belly: '#dcb48c',
    hair: { kind: 'long', color: '#1a1412' }, hat: { kind: 'straw', color: '#d8b46a', accent: '#d62828' },
    top: { kind: 'openShirt', color: '#2f8f5b', accent: '#f4d35e' }, pet: { kind: 'arara', side: 'L' },
    footwear: { kind: 'flipflop', color: '#3aa655', accent: '#f4f0e8' }, propR: 'tacaca', expression: 'Laughing',
  },
  PE: { // Frevo na sombrinha, chapéu de couro na cabeça.
    skin: '#5c3b2a', belly: '#9a6a4a',
    hair: { kind: 'curly', color: '#1a1412' }, hat: { kind: 'leather', color: '#8a5a2b' },
    top: { kind: 'vest', color: '#e63946', accent: '#ffb703', accent2: '#2a9d8f' }, footwear: { kind: 'sneaker', color: '#ffb703' },
    propR: 'sombrinha', expression: 'Cheeky',
  },
  MT: { // Chapéu de carandá, tereré gelado e cara de sol.
    skin: '#d59a6a', belly: '#f2dcc2',
    hair: { kind: 'buzz', color: '#4a3527' }, facialHair: { kind: 'goatee', color: '#4a3527' },
    hat: { kind: 'cowboy', color: '#c9a46a', accent: '#3a2a1e' }, top: { kind: 'jacket', color: '#8b3a2f', accent: '#f1e3c8' },
    footwear: { kind: 'boot', color: '#5a3b22' }, propR: 'terere', expression: 'Smug',
  },
};
export const STATE_ORDER = ['MG', 'RJ', 'RS', 'AM', 'PE', 'MT'] as const;

/** FNV-1a de 32 bits do apelido, sem espaços nas pontas e sem maiúsculas: "Zé" e "zé " são a mesma pessoa. */
export function nickHash(name: string): number {
  let h = 0x811c9dc5;
  for (const ch of name.trim().toLowerCase()) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** mulberry32: gerador pequeno e determinístico a partir da semente. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKINS = ['#f2c9a5', '#e8b89a', '#d9a37c', '#c98b5a', '#b98261', '#a86b3c', '#8a5a3a', '#5c3b2a'];
const HAIR_COLORS = ['#1a1412', '#2b1d14', '#3b2a1e', '#4a3527', '#8c5a2b', '#c99a4a', '#3d3d3d', '#a8a8a8'];
const CLOTH = ['#c8402e', '#3a6ea5', '#4f9d5a', '#e8b53a', '#8b3a2f', '#6b4a2b', '#2a9d8f', '#8338ec', '#f2c53d', '#1f8a4c', '#3a5a8a', '#e63946'];
const LIGHT = ['#f6ead4', '#d9c7a3', '#e8e2d2', '#f1e3c8', '#f4d35e', '#ffb703', '#cfe3ff'];
const HAIRS = ['flat', 'curly', 'spiky', 'buzz', 'long', 'bun'] as const;
const HATS = ['gaucho', 'cowboy', 'straw', 'leather', 'cap', 'headband'] as const;
const FACIAL = ['mustache', 'thickMustache', 'goatee', 'beard'] as const;
const EYEWEAR = ['sunglasses', 'roundGlasses'] as const;
const NECKS = ['bandana', 'canga', 'necklace'] as const;
const TOPS = ['cardigan', 'sweater', 'jacket', 'openShirt', 'vest', 'poncho'] as const;
const SHOES = ['sneaker', 'flipflop', 'boot'] as const;
const PROPS = ['coffeeMug', 'paoDeQueijo', 'chimarrao', 'terere', 'sombrinha', 'coconut', 'football', 'guarana', 'tacaca'] as const;
const MOODS: ExpressionName[] = ['Neutral', 'Happy', 'Calm', 'Smug', 'Proud', 'Cheeky'];

/** Um molho sorteado pelo apelido: cada vaga sai de uma lista curada, algumas com chance de ficar vazia. */
export function personOutfit(name: string): Outfit {
  const r = rng(nickHash(name));
  const from = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const chance = (p: number) => r() < p;
  const skin = from(SKINS), hairColor = from(HAIR_COLORS);
  const o: Outfit = {
    skin, belly: from(LIGHT),
    hair: { kind: from(HAIRS), color: hairColor },
    footwear: { kind: from(SHOES), color: from(CLOTH), accent: from(LIGHT) },
    expression: from(MOODS),
  };
  if (chance(0.4)) o.hat = { kind: from(HATS), color: from(CLOTH), accent: from(LIGHT) };
  if (chance(0.3)) o.facialHair = { kind: from(FACIAL), color: hairColor };
  if (chance(0.25)) o.eyewear = { kind: from(EYEWEAR), color: from(CLOTH), accent: '#15161a' };
  if (chance(0.3)) o.neck = { kind: from(NECKS), color: from(CLOTH), side: chance(0.5) ? 'L' : 'R' };
  if (chance(0.85)) o.top = { kind: from(TOPS), color: from(CLOTH), accent: from(LIGHT), accent2: from(CLOTH) };
  if (chance(0.5)) o.propR = from(PROPS);
  if (chance(0.2)) o.propL = from(PROPS);
  if (chance(0.05)) o.pet = { kind: 'arara', side: chance(0.5) ? 'L' : 'R' };
  return o;
}

/** Um bot veste um dos molhos regionais, escolhido pelo nome. */
export function botOutfit(name: string): Outfit {
  return STATE_OUTFITS[STATE_ORDER[nickHash(name) % STATE_ORDER.length]];
}

/** O molho de quem ocupa uma cadeira ou anda pela mesa; `arms` é decidido por quem senta, não pelo molho. */
export function outfitFor(name: string, bot: boolean, arms?: ArmPoseName): Outfit {
  return { ...(bot ? botOutfit(name) : personOutfit(name)), arms };
}
