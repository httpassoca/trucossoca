import { describe, expect, test } from 'bun:test';
import type { ServerMessage } from '@truco/protocol';
import { RoomHost, type Socket } from '../src/host';
import { silentLog } from '../src/log';
import { DISCONNECT_GRACE } from '../src/room';

/** O mínimo de um socket do Bun que o host usa, com o que ele fez guardado. */
function fakeSocket(token: string) {
  const ws = {
    data: { code: 'ABCD', token }, sent: [] as string[], closedWith: null as number | null, terminated: false,
    send(d: string) { ws.sent.push(d); }, close(code?: number) { ws.closedWith = code ?? 1000; }, terminate() { ws.terminated = true; },
  };
  return ws as unknown as Socket & typeof ws;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const say = (host: RoomHost, ws: Socket, msg: object) => host.message(ws, JSON.stringify(msg));

describe('host: silêncio no socket', () => {
  test('quem fica em silêncio pelo tempo limite é derrubado como se tivesse caído; ping mantém vivo', async () => {
    const host = new RoomHost('ABCD', silentLog, () => {}, { silence: 40 });
    const a = fakeSocket('token-a'), b = fakeSocket('token-b');
    host.connect(a); say(host, a, { type: 'join', nickname: 'Zé' });
    const heardAt = Date.now();
    host.connect(b); say(host, b, { type: 'join', nickname: 'Dita' });
    await sleep(25);
    say(host, b, { type: 'ping' });
    await sleep(25); // a: 50 ms calado; b: 25 ms
    expect(a.terminated).toBe(true);
    expect(b.terminated).toBe(false);
    expect(host.state.members.map((m) => [m.nickname, m.connected])).toEqual([['Zé', false], ['Dita', true]]);
    expect(host.connections).toBe(1);
    // a tolerância de Zé conta desde o último sinal de vida dele, não desde que o silêncio foi notado
    const drop = host.state.timers.find((t) => t.kind === 'drop')!;
    expect(drop.at).toBeGreaterThanOrEqual(heardAt + DISCONNECT_GRACE);
    expect(drop.at).toBeLessThan(heardAt + DISCONNECT_GRACE + 20);
    // o fechamento que o Bun avisa depois não conta duas vezes
    host.disconnect(a);
    expect(host.state.members.filter((m) => !m.connected)).toHaveLength(1);
    host.dispose();
  });

  test('a aba que assumiu o lugar de outra não herda o silêncio da velha', async () => {
    const host = new RoomHost('ABCD', silentLog, () => {}, { silence: 40 });
    const old = fakeSocket('token-a');
    host.connect(old); say(host, old, { type: 'join', nickname: 'Zé' });
    await sleep(30);
    const fresh = fakeSocket('token-a');
    host.connect(fresh);
    expect(old.closedWith).not.toBeNull();
    await sleep(25); // a velha teria vencido agora; a nova tem 25 ms
    expect(fresh.terminated).toBe(false);
    expect(host.state.members[0].connected).toBe(true);
    host.dispose();
  });
});

describe('host: presença', () => {
  const presences = (ws: { sent: string[] }) => ws.sent.map((d) => JSON.parse(d) as ServerMessage).filter((m) => m.type === 'presence');

  test('a presença de um membro chega aos outros (nunca de volta a ele) no máximo uma vez por intervalo, sempre a mais recente', async () => {
    const host = new RoomHost('ABCD', silentLog, () => {}, { presenceInterval: 40 });
    const a = fakeSocket('token-a'), b = fakeSocket('token-b'), c = fakeSocket('token-c');
    host.connect(a); say(host, a, { type: 'join', nickname: 'Zé' });
    host.connect(b); say(host, b, { type: 'join', nickname: 'Dita' });
    host.connect(c); // visitante sem apelido: também vê a mesa chegar
    const activity = host.state.lastActivity;
    for (let i = 1; i <= 4; i++) say(host, a, { type: 'presence', presence: { x: i, z: 0, yaw: 0, pitch: 0 } });
    // a primeira sai na hora; as do meio caem; a última sai quando a janela abre
    expect(presences(b)).toEqual([{ type: 'presence', member: 'm1', presence: { x: 1, z: 0, yaw: 0, pitch: 0 } }]);
    expect(presences(a)).toEqual([]);
    await sleep(60);
    expect(presences(b).map((m) => (m as { presence: { x: number } }).presence.x)).toEqual([1, 4]);
    expect(presences(c).map((m) => (m as { presence: { x: number } }).presence.x)).toEqual([1, 4]);
    // presença não é atividade da sala
    expect(host.state.lastActivity).toBe(activity);
    host.dispose();
  });

  test('presença de quem ainda não entrou com apelido é descartada', () => {
    const host = new RoomHost('ABCD', silentLog, () => {}, { presenceInterval: 40 });
    const a = fakeSocket('token-a'), v = fakeSocket('token-v');
    host.connect(a); say(host, a, { type: 'join', nickname: 'Zé' });
    host.connect(v);
    say(host, v, { type: 'presence', presence: { x: 1, z: 0, yaw: 0, pitch: 0 } });
    expect(presences(a)).toEqual([]);
    host.dispose();
  });
});
