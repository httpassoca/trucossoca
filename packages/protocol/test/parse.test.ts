import { describe, expect, test } from 'bun:test';
import { defaultRules } from '@truco/rules';
import { DEAL_MS, isScenery, NICKNAME_MAX, parseClientMessage, TEAM_NAME_MAX } from '../src/index';

describe('parseClientMessage', () => {
  test('aceita join, nickname e ping', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'join', nickname: 'Zé' }))).toEqual({ type: 'join', nickname: 'Zé' });
    expect(parseClientMessage(JSON.stringify({ type: 'nickname', nickname: 'Dita' }))).toEqual({ type: 'nickname', nickname: 'Dita' });
    expect(parseClientMessage(JSON.stringify({ type: 'ping' }))).toEqual({ type: 'ping' });
  });

  test('rejeita JSON quebrado, tipos desconhecidos e campos errados', () => {
    expect(parseClientMessage('{')).toBeNull();
    expect(parseClientMessage('"join"')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'fly' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'join' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'join', nickname: 42 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'join', nickname: 'x'.repeat(NICKNAME_MAX * 10) }))).toBeNull();
  });

  test('passar uma cadeira a um bot leva o id do membro', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'handToBot', member: 'm2' }))).toEqual({ type: 'handToBot', member: 'm2' });
    expect(parseClientMessage(JSON.stringify({ type: 'handToBot' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'handToBot', member: 2 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'handToBot', member: 'm'.repeat(100) }))).toBeNull();
  });

  test('aceita as mensagens da sala: cadeira, dupla, regras, fantasmas e começar', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'takeSeat', team: 1 }))).toEqual({ type: 'takeSeat', team: 1 });
    expect(parseClientMessage(JSON.stringify({ type: 'leaveSeat' }))).toEqual({ type: 'leaveSeat' });
    expect(parseClientMessage(JSON.stringify({ type: 'renameTeam', team: 0, name: 'Nós' }))).toEqual({ type: 'renameTeam', team: 0, name: 'Nós' });
    expect(parseClientMessage(JSON.stringify({ type: 'ghostsSeeCards', on: false }))).toEqual({ type: 'ghostsSeeCards', on: false });
    expect(parseClientMessage(JSON.stringify({ type: 'start' }))).toEqual({ type: 'start' });
    expect(parseClientMessage(JSON.stringify({ type: 'scenery', scenery: 'graveyard' }))).toEqual({ type: 'scenery', scenery: 'graveyard' });
  });

  test('cenário fora da lista é rejeitado', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'scenery', scenery: 'lua' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'scenery' }))).toBeNull();
    expect(isScenery('graveyard')).toBe(true);
    expect(isScenery('lua')).toBe(false);
    expect(isScenery(undefined)).toBe(false);
  });

  test('a coreografia de dar as cartas tem um tamanho fixo, em ms', () => {
    expect(DEAL_MS).toBe(4500);
  });

  test('dupla fora de 0/1, nome de dupla comprido demais ou toggle sem booleano são rejeitados', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'takeSeat', team: 2 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'takeSeat', team: '0' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'renameTeam', team: 0, name: 'x'.repeat(TEAM_NAME_MAX * 10) }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'ghostsSeeCards', on: 'sim' }))).toBeNull();
  });

  test('regras chegam inteiras, só com os campos conhecidos', () => {
    const sent = { ...defaultRules, allowCovered: false, coverFromTrick: 1, extra: 'lixo' };
    const parsed = parseClientMessage(JSON.stringify({ type: 'rules', rules: sent }));
    expect(parsed).toEqual({ type: 'rules', rules: { ...defaultRules, allowCovered: false, coverFromTrick: 1 } });
  });

  test('regras com campo faltando, tipo errado ou escada fora de ordem são rejeitadas', () => {
    const bad = (patch: Record<string, unknown>) => parseClientMessage(JSON.stringify({ type: 'rules', rules: { ...defaultRules, ...patch } }));
    const { target: _t, ...missing } = defaultRules;
    expect(parseClientMessage(JSON.stringify({ type: 'rules', rules: missing }))).toBeNull();
    expect(bad({ allowCovered: 'yes' })).toBeNull();
    expect(bad({ ladder: [2, 4, 3] })).toBeNull();
    expect(bad({ ladder: [] })).toBeNull();
    expect(bad({ target: 0 })).toBeNull();
    expect(bad({ target: 12.5 })).toBeNull();
    expect(bad({ coverFromTrick: 4 })).toBeNull();
    expect(bad({ tieLeader: 'pé' })).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'rules' }))).toBeNull();
  });
});

describe('parseClientMessage: as jogadas', () => {
  test('aceita jogar (com coberta), trucar, responder, decidir a mão de dez e revanche', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'play', id: '4c', covered: false }))).toEqual({ type: 'play', id: '4c', covered: false });
    expect(parseClientMessage(JSON.stringify({ type: 'play', id: 'As', covered: true }))).toEqual({ type: 'play', id: 'As', covered: true });
    expect(parseClientMessage(JSON.stringify({ type: 'raise' }))).toEqual({ type: 'raise' });
    for (const action of ['accept', 'decline', 'raise'] as const) expect(parseClientMessage(JSON.stringify({ type: 'respond', action }))).toEqual({ type: 'respond', action });
    for (const action of ['play', 'run'] as const) expect(parseClientMessage(JSON.stringify({ type: 'decideDez', action }))).toEqual({ type: 'decideDez', action });
    expect(parseClientMessage(JSON.stringify({ type: 'rematch' }))).toEqual({ type: 'rematch' });
  });

  test('carta que não existe, coberta sem booleano ou resposta desconhecida são rejeitadas', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'play', id: '8c', covered: false }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'play', id: '4x', covered: false }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'play', id: 4, covered: false }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'play', id: '4c' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'play', id: '4c', covered: 'sim' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'respond', action: 'fold' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'respond' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'decideDez', action: 'accept' }))).toBeNull();
  });
});

describe('parseClientMessage: fantasmas', () => {
  test('presença leva posição no chão e olhar, todos números finitos', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { x: 1.5, y: 0.4, z: -2, yaw: 0.3, pitch: -0.1 } }))).toEqual({ type: 'presence', presence: { x: 1.5, y: 0.4, z: -2, yaw: 0.3, pitch: -0.1 } });
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { x: 1, z: 2, yaw: 0, pitch: 0 } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { x: 1, y: -2, z: 2, yaw: 0, pitch: 0 } }))).toBeNull();
    // um degrau abaixo do chão (a rua de um cenário) passa
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { x: 1, y: -0.08, z: 2, yaw: 0, pitch: 0 } }))).not.toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { x: 1, y: 0, z: 2, yaw: 0 } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { x: '1', y: 0, z: 2, yaw: 0, pitch: 0 } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { x: 1e9, y: 0, z: 2, yaw: 0, pitch: 0 } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'presence' }))).toBeNull();
  });

  test('a presença pode dizer que a pessoa está olhando as cartas: ausente = não; fora de booleano é rejeitada', () => {
    const base = { x: 1, y: 0, z: 2, yaw: 0, pitch: 0 };
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { ...base, peek: true } }))).toEqual({ type: 'presence', presence: { ...base, peek: true } });
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { ...base, peek: false } }))).toEqual({ type: 'presence', presence: base });
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: base }))).toEqual({ type: 'presence', presence: base });
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { ...base, peek: 'sim' } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'presence', presence: { ...base, peek: 1 } }))).toBeNull();
  });

  test('sentar no lugar de um bot leva a cadeira', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'takeBotSeat', seat: 3 }))).toEqual({ type: 'takeBotSeat', seat: 3 });
    expect(parseClientMessage(JSON.stringify({ type: 'takeBotSeat', seat: 4 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'takeBotSeat' }))).toBeNull();
  });
});
