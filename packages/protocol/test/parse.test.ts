import { describe, expect, test } from 'bun:test';
import { NICKNAME_MAX, parseClientMessage } from '../src/index';

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
});
