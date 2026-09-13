import { describe, expect, test } from 'bun:test';
import type { GameEvent } from '@truco/rules';
import { formatEvent, renderLine, withHint, type LogLine } from '../src/lib/format';
import { HintBook } from '../src/lib/i18n';
import { emptySnapshot, type TableSnapshot } from '../src/lib/table/table';

function snap(): TableSnapshot {
  const s = emptySnapshot();
  return { ...s, game: { ...s.game, handNo: 1 }, seats: ['Ana', 'Tião', 'Bia', 'Zé'].map((name) => ({ name, bot: false, botControlled: false })), teams: ['Nós', 'Eles'] };
}
const raise: GameEvent = { type: 'raise', seat: 3, to: 4 };
const decline: GameEvent = { type: 'respond', seat: 0, action: 'decline', value: 2, winnerTeam: 1 };
const dezHand: GameEvent = { type: 'newHand', mao: 1, special: 'dez', value: 4, decider: 1 };
const ferroHand: GameEvent = { type: 'newHand', mao: 1, special: 'ferro', value: 4, decider: null };
const play: GameEvent = { type: 'play', seat: 2, id: '4c', covered: false, kind: 'kill', seed: 1 };
const line = (e: GameEvent) => formatEvent(e, snap())!;

describe('formatEvent', () => {
  test('a mesma linha rende nas duas línguas, com as chamadas em português nas duas', () => {
    const l = line(raise);
    expect(renderLine('pt', l).text).toBe('Zé pediu TRUCO! (4)');
    expect(renderLine('en', l).text).toBe('Zé called TRUCO! (4)');
    expect(renderLine('en', line(decline)).text).toBe('Ana: Corro! Eles take 2.');
    expect(renderLine('pt', line(decline)).text).toBe('Ana: Corro! Eles leva 2.');
    expect(renderLine('en', line(dezHand)).text).toContain('Mão de dez');
    expect(renderLine('en', line(ferroHand)).text).toContain('Mão de ferro');
  });

  test('a etiqueta da linha conta a mão e a vaza na língua da pessoa', () => {
    const l = line(play);
    expect(renderLine('pt', l).tag).toBe('m1·v1');
    expect(renderLine('en', l).tag).toBe('h1·t1');
  });

  test('a carta é só valor e naipe, nas duas línguas', () => {
    expect(renderLine('pt', line(play)).text).toBe('Bia matou com 4♣');
    expect(renderLine('en', line(play)).text).toBe('Bia killed with 4♣');
  });

  test('cada evento diz qual dica em inglês introduz', () => {
    expect(line(raise).hint).toBe('truco');
    expect(line({ type: 'raise', seat: 3, to: 6 }).hint).toBe('seis');
    expect(line({ type: 'raise', seat: 3, to: 12 }).hint).toBe('doze');
    expect(line(decline).hint).toBe('corro');
    expect(line(dezHand).hint).toBe('dezHand');
    expect(line(ferroHand).hint).toBe('ferroHand');
    expect(line(play).hint).toBeUndefined();
    expect(line({ type: 'respond', seat: 0, action: 'accept', value: 4 }).hint).toBeUndefined();
  });
});

describe('withHint', () => {
  test('em inglês a dica fica na primeira linha de cada chamada, e só nela', () => {
    const book = new HintBook(null);
    const first = withHint(line(raise), 'en', book);
    const second = withHint(line(raise), 'en', book);
    expect(first.hint).toBe('truco');
    expect(second.hint).toBeUndefined();
    expect(renderLine('en', first).hint).toContain('4');
    expect(renderLine('en', second).hint).toBeUndefined();
    expect(withHint(line(decline), 'en', book).hint).toBe('corro');
  });

  test('em português não há dica, e a chance não se gasta', () => {
    const book = new HintBook(null);
    const l: LogLine = withHint(line(raise), 'pt', book);
    expect(l.hint).toBeUndefined();
    expect(renderLine('pt', l).hint).toBeUndefined();
    // a pessoa troca para inglês depois: a dica ainda está por dar
    expect(withHint(line(raise), 'en', book).hint).toBe('truco');
  });

  test('a linha que ganhou a dica em inglês a esconde quando o log rende em português', () => {
    const l = withHint(line(raise), 'en', new HintBook(null));
    expect(renderLine('en', l).hint).toBeDefined();
    expect(renderLine('pt', l).hint).toBeUndefined();
  });
});

test('a coberta alheia é só "carta coberta", nas duas línguas', () => {
  const l = formatEvent({ type: 'play', seat: 1, id: null, covered: true, kind: 'cover', seed: 1 }, snap())!;
  expect(renderLine('pt', l).text).toBe('Tião jogou carta coberta');
  expect(renderLine('en', l).text).toBe('Tião played a covered card');
});
