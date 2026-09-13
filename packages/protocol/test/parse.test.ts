import { describe, expect, test } from 'bun:test';
import { defaultRules } from '@truco/rules';
import { NICKNAME_MAX, parseClientMessage, TEAM_NAME_MAX } from '../src/index';

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

  test('aceita as mensagens da sala: cadeira, dupla, regras, fantasmas e começar', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'takeSeat', team: 1 }))).toEqual({ type: 'takeSeat', team: 1 });
    expect(parseClientMessage(JSON.stringify({ type: 'leaveSeat' }))).toEqual({ type: 'leaveSeat' });
    expect(parseClientMessage(JSON.stringify({ type: 'renameTeam', team: 0, name: 'Nós' }))).toEqual({ type: 'renameTeam', team: 0, name: 'Nós' });
    expect(parseClientMessage(JSON.stringify({ type: 'ghostsSeeCards', on: false }))).toEqual({ type: 'ghostsSeeCards', on: false });
    expect(parseClientMessage(JSON.stringify({ type: 'start' }))).toEqual({ type: 'start' });
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
